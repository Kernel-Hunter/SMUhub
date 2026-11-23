/**
 * Campus Voice API tests. Need a running MongoDB; use their own throwaway database (smuhub_test_voice by default,
 * override with MONGODB_URI_TEST_VOICE), dropped at the end.
 *   npm test
 */
import { after, before, beforeEach, describe, it } from 'node:test'
import assert from 'node:assert/strict'
import jwt from 'jsonwebtoken'
import mongoose from 'mongoose'
import request from 'supertest'
import { createApp } from '../src/app.js'
import { loadConfig } from '../src/config/env.js'
import { SESSION_COOKIE } from '../src/lib/session.js'
import { LIMITS } from '../src/lib/threads.js'
import { User } from '../src/models/User.js'
import { Thread } from '../src/models/Thread.js'
import { Reply } from '../src/models/Reply.js'
import { Ledger } from '../src/models/Ledger.js'

const MONGO = process.env.MONGODB_URI_TEST_VOICE ?? 'mongodb://127.0.0.1:27017/smuhub_test_voice'
const SECRET = 'test-secret-that-is-long-enough-for-hs256-signing'
const app = createApp(loadConfig({ NODE_ENV: 'test', MONGODB_URI: MONGO, JWT_SECRET: SECRET, ALLOWED_EMAIL_DOMAINS: 'medtech.tn,msb.tn' }))

let lina = '', omar = '', sami = ''
const cookie = (id: string) => `${SESSION_COOKIE}=${jwt.sign({}, SECRET, { subject: id, expiresIn: 60 })}`
const as = (id: string) => ({
  get: (path: string) => request(app).get(path).set('Cookie', cookie(id)),
  post: (path: string, body?: object) => request(app).post(path).set('Cookie', cookie(id)).send(body ?? {}),
})
const POST = { title: 'The library closes too early in exam weeks', body: 'Exam season is when we need the study space most.', category: 'facilities' }
const publish = (id = lina, over: object = {}) => as(id).post('/api/voice', { ...POST, ...over })
const ledger = () => Ledger.find({}).lean()

// Nothing that identifies Lina may appear in a response about her anonymous content.
const assertNoLina = (res: { text: string }, where: string) => {
  for (const needle of [lina, 'Lina', 'Haddad', 'lina.haddad', '@']) assert.ok(!res.text.includes(needle), `${where} leaks "${needle}"`)
}

before(async () => {
  await mongoose.connect(MONGO, { serverSelectionTimeoutMS: 3000 })
  await mongoose.connection.dropDatabase()
  await Ledger.syncIndexes() // unique refKey
})
after(async () => {
  await mongoose.connection.dropDatabase()
  await mongoose.disconnect()
})
beforeEach(async () => {
  // Ledger.deleteMany throws on purpose (append-only); tests clear the collection directly.
  await Promise.all([User.deleteMany({}), Thread.deleteMany({}), Reply.deleteMany({}), Ledger.collection.deleteMany({})])
  const base = { passwordHash: 'x', major: 'CS', year: 2 }
  lina = (await User.create({ ...base, email: 'lina.haddad@medtech.tn', firstName: 'Lina', lastName: 'Haddad' }))._id.toString()
  omar = (await User.create({ ...base, email: 'omar.jaziri@msb.tn', firstName: 'Omar', lastName: 'Jaziri' }))._id.toString()
  sami = (await User.create({ ...base, email: 'sami.kefi@msb.tn', firstName: 'Sami', lastName: 'Kefi' }))._id.toString()
})

describe('posting and listing', () => {
  it('requires a session', async () => {
    assert.equal((await request(app).get('/api/voice')).status, 401)
    assert.equal((await request(app).post('/api/voice').send(POST)).status, 401)
  })

  it('creates a named post with its category and never exposes emails', async () => {
    const res = await publish()
    assert.equal(res.status, 201)
    assert.equal(res.body.thread.kind, 'voice')
    assert.equal(res.body.thread.category, 'facilities')
    assert.equal(res.body.thread.author.name, 'Lina Haddad')
    assert.equal(res.body.thread.mine, true)
    assert.ok(!res.text.includes('@'), 'response must not contain an email')
  })

  it('rejects a missing or unknown category, a short title and a short body', async () => {
    assert.equal((await publish(lina, { category: undefined })).status, 400)
    assert.equal((await publish(lina, { category: 'gossip' })).status, 400)
    assert.equal((await publish(lina, { title: 'Short' })).status, 400)
    assert.equal((await publish(lina, { body: 'Too short' })).status, 400)
    assert.equal((await publish(lina, { anonymous: 'yes' })).status, 400)
  })

  it(`shares the ${LIMITS.threadsPerHour} posts per hour budget with questions, then answers 429`, async () => {
    const q = { title: 'What does a LEFT JOIN return?', body: 'Lab 4 uses it and I do not see the difference.', courseCode: 'CS224' }
    assert.equal((await as(lina).post('/api/questions', q)).status, 201)
    for (let i = 1; i < LIMITS.threadsPerHour; i++) assert.equal((await publish(lina, { title: `${POST.title} ${i}` })).status, 201)
    const res = await publish()
    assert.equal(res.status, 429)
    assert.equal(res.body.error.code, 'rate_limited')
  })

  it('filters by category and search term, and sorts by votes', async () => {
    const a = (await publish()).body.thread
    await publish(lina, { title: 'Grades take five weeks to come out', body: 'Several courses, same story every semester.', category: 'academics' })
    await as(omar).post(`/api/voice/${a.id}/vote`)
    const byCat = (await as(omar).get('/api/voice?category=academics')).body.threads
    assert.deepEqual(byCat.map((t: { category: string }) => t.category), ['academics'])
    assert.equal((await as(omar).get('/api/voice?category=gossip')).body.threads.length, 0)
    const search = (await as(omar).get('/api/voice?q=five%20WEEKS')).body.threads
    assert.equal(search.length, 1)
    const top = (await as(omar).get('/api/voice?sort=top')).body.threads
    assert.equal(top[0].id, a.id)
  })

  it('lists only voice posts, and questions only questions', async () => {
    await publish()
    await as(lina).post('/api/questions', { title: 'What does a LEFT JOIN return?', body: 'Lab 4 uses it and I do not see the difference.', courseCode: 'CS224' })
    const voice = (await as(omar).get('/api/voice')).body.threads
    assert.deepEqual(voice.map((t: { kind: string }) => t.kind), ['voice'])
    const qa = (await as(omar).get('/api/questions')).body.threads
    assert.deepEqual(qa.map((t: { kind: string }) => t.kind), ['question'])
  })
})

describe('anonymity', () => {
  it('hides the author of an anonymous post and reply everywhere, and only tells the author it is theirs', async () => {
    const created = await publish(lina, { anonymous: true })
    assert.equal(created.status, 201)
    assert.equal(created.body.thread.author, null)
    assert.equal(created.body.thread.mine, true)
    assertNoLina(created, 'create')
    const id = created.body.thread.id

    const reply = await as(lina).post(`/api/voice/${id}/replies`, { body: 'Adding details: it was closed on Sunday too.', anonymous: true })
    assert.equal(reply.status, 201)
    assert.equal(reply.body.reply.author, null)
    assert.equal(reply.body.reply.mine, true)
    assertNoLina(reply, 'reply create')

    const list = await as(omar).get('/api/voice')
    assert.equal(list.body.threads[0].author, null)
    assert.equal(list.body.threads[0].mine, false)
    assertNoLina(list, 'list')

    const search = await as(omar).get('/api/voice?q=Lina')
    assertNoLina(search, 'search')

    const one = await as(omar).get(`/api/voice/${id}`)
    assert.equal(one.body.thread.author, null)
    assert.equal(one.body.thread.mine, false)
    assert.equal(one.body.replies[0].author, null)
    assert.equal(one.body.replies[0].mine, false)
    assertNoLina(one, 'get')

    const vote = await as(omar).post(`/api/voice/${id}/vote`)
    assert.equal(vote.status, 200)
    assertNoLina(vote, 'vote')

    const replyVote = await as(omar).post(`/api/voice/replies/${reply.body.reply.id}/vote`)
    assert.equal(replyVote.status, 200)
    assertNoLina(replyVote, 'reply vote')

    // The author sees `mine` but still no author object.
    const own = await as(lina).get(`/api/voice/${id}`)
    assert.equal(own.body.thread.mine, true)
    assert.equal(own.body.thread.author, null)
    assert.equal(own.body.replies[0].mine, true)
  })

  it('shows the name on a named reply to an anonymous post', async () => {
    const t = (await publish(lina, { anonymous: true })).body.thread
    await as(omar).post(`/api/voice/${t.id}/replies`, { body: 'Same here, twice last week.' })
    const one = (await as(sami).get(`/api/voice/${t.id}`)).body
    assert.equal(one.thread.author, null)
    assert.equal(one.replies[0].author.name, 'Omar Jaziri')
  })

  it('lists named voice posts on the profile but never anonymous ones', async () => {
    await publish(lina, { title: 'Shoutout to the IT team for the Wi-Fi', category: 'praise' })
    const secret = (await publish(lina, { title: 'Grades take five weeks to come out', category: 'academics', anonymous: true })).body.thread
    const res = await as(omar).get(`/api/users/${lina}`)
    assert.equal(res.status, 200)
    assert.deepEqual(res.body.threads.map((t: { title: string }) => t.title), ['Shoutout to the IT team for the Wi-Fi'])
    assert.equal(res.body.threads[0].category, 'praise')
    assert.ok(!res.text.includes(secret.id), 'the anonymous post id must not be on the profile')
    assert.ok(!res.text.includes('five weeks'), 'the anonymous post must not be on the profile')
  })
})

describe('votes', () => {
  it('blocks voting on your own post', async () => {
    const t = (await publish()).body.thread
    const res = await as(lina).post(`/api/voice/${t.id}/vote`)
    assert.equal(res.status, 403)
    assert.equal(res.body.error.code, 'self_vote')
    assert.equal((await ledger()).length, 0)
  })

  it('counts a vote once, keeps it final, and pays the author voiceUp XP once', async () => {
    const t = (await publish()).body.thread
    const first = await as(omar).post(`/api/voice/${t.id}/vote`)
    assert.equal(first.status, 200)
    assert.equal(first.body.thread.votes, 1)
    assert.equal(first.body.thread.iVoted, true)
    const again = await as(omar).post(`/api/voice/${t.id}/vote`)
    assert.equal(again.status, 409)
    assert.equal(again.body.error.code, 'already_voted')
    const rows = await ledger()
    assert.equal(rows.length, 1)
    assert.equal(rows[0].user.toString(), lina)
    assert.equal(rows[0].kind, 'voice_upvoted')
    assert.equal(rows[0].points, 1)
    assert.equal(rows[0].refKey, `tv:${omar}:${t.id}`)
  })

  it('pays no XP for an anonymous post, so XP changes cannot reveal its author', async () => {
    const t = (await publish(lina, { anonymous: true })).body.thread
    assert.equal((await as(omar).post(`/api/voice/${t.id}/vote`)).status, 200)
    assert.equal((await Thread.findById(t.id))!.votes, 1)
    assert.equal((await ledger()).length, 0)
  })

  it('counts parallel votes from the same student once', async () => {
    const t = (await publish()).body.thread
    const results = await Promise.all(Array.from({ length: 6 }, () => as(omar).post(`/api/voice/${t.id}/vote`)))
    assert.equal(results.filter((r) => r.status === 200).length, 1)
    assert.equal(results.filter((r) => r.status === 409).length, 5)
    assert.equal((await Thread.findById(t.id))!.votes, 1)
    assert.equal((await ledger()).length, 1)
  })

  it('reply votes: once, final, never your own, and pay no XP', async () => {
    const t = (await publish()).body.thread
    const r = (await as(omar).post(`/api/voice/${t.id}/replies`, { body: 'Agreed, 10pm would help a lot.' })).body.reply
    assert.equal((await as(omar).post(`/api/voice/replies/${r.id}/vote`)).status, 403)
    const ok = await as(lina).post(`/api/voice/replies/${r.id}/vote`)
    assert.equal(ok.status, 200)
    assert.equal(ok.body.reply.votes, 1)
    assert.equal((await as(lina).post(`/api/voice/replies/${r.id}/vote`)).status, 409)
    const parallel = await Promise.all(Array.from({ length: 4 }, () => as(sami).post(`/api/voice/replies/${r.id}/vote`)))
    assert.equal(parallel.filter((x) => x.status === 200).length, 1)
    assert.equal((await Reply.findById(r.id))!.votes, 2)
    assert.equal((await ledger()).length, 0)
  })
})

describe('replies', () => {
  it('validates, counts replies and shares the reply rate limit', async () => {
    const t = (await publish()).body.thread
    assert.equal((await as(omar).post(`/api/voice/${t.id}/replies`, { body: 'x' })).status, 400)
    for (let i = 0; i < LIMITS.repliesPer10Min; i++) assert.equal((await as(omar).post(`/api/voice/${t.id}/replies`, { body: `Reply ${i}` })).status, 201)
    const res = await as(omar).post(`/api/voice/${t.id}/replies`, { body: 'One more' })
    assert.equal(res.status, 429)
    assert.equal((await as(omar).get(`/api/voice/${t.id}`)).body.thread.replyCount, LIMITS.repliesPer10Min)
  })
})

describe('voice and question ids are not interchangeable', () => {
  it('a question never opens, takes votes or replies as a voice post, and the other way round', async () => {
    const q = (await as(lina).post('/api/questions', { title: 'What does a LEFT JOIN return?', body: 'Lab 4 uses it and I do not see the difference.', courseCode: 'CS224' })).body.thread
    const v = (await publish()).body.thread
    assert.equal((await as(omar).get(`/api/voice/${q.id}`)).status, 404)
    assert.equal((await as(omar).post(`/api/voice/${q.id}/vote`)).status, 404)
    assert.equal((await as(omar).post(`/api/voice/${q.id}/replies`, { body: 'Hello there' })).status, 404)
    assert.equal((await as(omar).get(`/api/questions/${v.id}`)).status, 404)
    assert.equal((await as(omar).post(`/api/questions/${v.id}/vote`)).status, 404)
    assert.equal((await as(omar).post(`/api/questions/${v.id}/replies`, { body: 'Hello there' })).status, 404)
    assert.equal((await as(omar).get('/api/voice/not-an-id')).status, 404)
    assert.equal((await ledger()).length, 0)
  })

  it('a reply id only takes votes through its own API, so a voice reply never pays answer XP', async () => {
    const q = (await as(lina).post('/api/questions', { title: 'What does a LEFT JOIN return?', body: 'Lab 4 uses it and I do not see the difference.', courseCode: 'CS224' })).body.thread
    const v = (await publish(lina)).body.thread
    const answer = (await as(omar).post(`/api/questions/${q.id}/replies`, { body: 'It keeps every row on the left.' })).body.reply
    const voiceReply = (await as(omar).post(`/api/voice/${v.id}/replies`, { body: 'Agreed, 10pm would help.' })).body.reply
    assert.equal((await as(lina).post(`/api/questions/replies/${voiceReply.id}/vote`)).status, 404)
    assert.equal((await as(lina).post(`/api/questions/replies/${voiceReply.id}/accept`)).status, 404)
    assert.equal((await as(lina).post(`/api/voice/replies/${answer.id}/vote`)).status, 404)
    assert.equal((await ledger()).length, 0)
    assert.equal((await Reply.findById(voiceReply.id))!.votes, 0)
    assert.equal((await Reply.findById(answer.id))!.votes, 0)
  })
})
