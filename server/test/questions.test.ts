/**
 * Q&A API tests. Need a running MongoDB; use their own throwaway database (smuhub_test_qa by default,
 * so they never collide with the auth tests when both files run in parallel).
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
import { User } from '../src/models/User.js'
import { Thread } from '../src/models/Thread.js'
import { Reply } from '../src/models/Reply.js'
import { LIMITS } from '../src/routes/questions.js'
import { dropTestDb } from './db.js'

const MONGO = process.env.MONGODB_URI_TEST_QA ?? 'mongodb://127.0.0.1:27017/smuhub_test_qa'
const SECRET = 'test-secret-that-is-long-enough-for-hs256-signing'
const app = createApp(loadConfig({ NODE_ENV: 'test', MONGODB_URI: MONGO, JWT_SECRET: SECRET, ALLOWED_EMAIL_DOMAINS: 'medtech.tn,msb.tn' }))

let asker = '', helper = ''
const cookie = (id: string) => `${SESSION_COOKIE}=${jwt.sign({}, SECRET, { subject: id, expiresIn: 60 })}`
const as = (id: string) => ({
  get: (path: string) => request(app).get(path).set('Cookie', cookie(id)),
  post: (path: string, body?: object) => request(app).post(path).set('Cookie', cookie(id)).send(body ?? {}),
})
const QUESTION = { title: 'What does a LEFT JOIN return?', body: 'Lab 4 uses it and I do not see the difference.', courseCode: 'CS224' }
const ask = (id = asker, over: object = {}) => as(id).post('/api/questions', { ...QUESTION, ...over })

before(async () => {
  await mongoose.connect(MONGO, { serverSelectionTimeoutMS: 3000 })
  await mongoose.connection.dropDatabase()
})
after(dropTestDb)
beforeEach(async () => {
  await Promise.all([User.deleteMany({}), Thread.deleteMany({}), Reply.deleteMany({})])
  const base = { passwordHash: 'x', major: 'CS', year: 2 }
  asker = (await User.create({ ...base, email: 'lina.haddad@medtech.tn', firstName: 'Lina', lastName: 'Haddad' }))._id.toString()
  helper = (await User.create({ ...base, email: 'omar.jaziri@msb.tn', firstName: 'Omar', lastName: 'Jaziri' }))._id.toString()
})

describe('asking and listing', () => {
  it('requires a session', async () => {
    assert.equal((await request(app).get('/api/questions')).status, 401)
    assert.equal((await request(app).post('/api/questions').send(QUESTION)).status, 401)
  })

  it('creates a question and never exposes emails', async () => {
    const res = await ask()
    assert.equal(res.status, 201)
    assert.equal(res.body.thread.title, QUESTION.title)
    assert.equal(res.body.thread.author.name, 'Lina Haddad')
    assert.equal(res.body.thread.mine, true)
    assert.ok(!JSON.stringify(res.body).includes('@'), 'response must not contain an email')
  })

  it('rejects an unknown course, a short title and a short body', async () => {
    assert.equal((await ask(asker, { courseCode: 'FAKE999' })).status, 400)
    assert.equal((await ask(asker, { title: 'Short' })).status, 400)
    assert.equal((await ask(asker, { body: 'Too short' })).status, 400)
  })

  it(`allows ${LIMITS.threadsPerHour} questions per hour, then answers 429`, async () => {
    for (let i = 0; i < LIMITS.threadsPerHour; i++) assert.equal((await ask(asker, { title: `${QUESTION.title} ${i}` })).status, 201)
    const res = await ask()
    assert.equal(res.status, 429)
    assert.equal(res.body.error.code, 'rate_limited')
  })

  it('keeps the hourly limit with parallel requests', async () => {
    const res = await Promise.all(Array.from({ length: 20 }, (_, i) => ask(asker, { title: `${QUESTION.title} ${i}` })))
    assert.equal(res.filter((r) => r.status === 201).length, LIMITS.threadsPerHour)
    assert.equal(res.filter((r) => r.status === 429).length, 20 - LIMITS.threadsPerHour)
    assert.equal(await Thread.countDocuments({ author: asker }), LIMITS.threadsPerHour)
  })

  it('filters by course, search term and unsolved, and sorts by votes', async () => {
    const a = (await ask()).body.thread
    await ask(asker, { title: 'How do I compute a variance?', body: 'Exercise 2 of the statistics series.', courseCode: 'MATH210' })
    await as(helper).post(`/api/questions/${a.id}/vote`)
    const byCourse = (await as(helper).get('/api/questions?course=math210')).body.threads
    assert.deepEqual(byCourse.map((t: { courseCode: string }) => t.courseCode), ['MATH210'])
    const bySearch = (await as(helper).get('/api/questions?q=left join')).body.threads
    assert.equal(bySearch.length, 1)
    const top = (await as(helper).get('/api/questions?sort=top')).body.threads
    assert.equal(top[0].id, a.id)
    await Thread.updateOne({ _id: a.id }, { solved: true })
    const open = (await as(helper).get('/api/questions?unsolved=1')).body.threads
    assert.ok(open.every((t: { solved: boolean }) => !t.solved))
  })

  it('answers 404 for unknown or malformed ids', async () => {
    assert.equal((await as(asker).get('/api/questions/not-an-id')).status, 404)
    assert.equal((await as(asker).get(`/api/questions/${new mongoose.Types.ObjectId()}`)).status, 404)
  })
})

describe('votes', () => {
  it('blocks voting on your own question', async () => {
    const q = (await ask()).body.thread
    const res = await as(asker).post(`/api/questions/${q.id}/vote`)
    assert.equal(res.status, 403)
    assert.equal(res.body.error.code, 'self_vote')
  })

  it('counts one vote per student, and votes are final', async () => {
    const q = (await ask()).body.thread
    const first = await as(helper).post(`/api/questions/${q.id}/vote`)
    assert.equal(first.status, 200)
    assert.equal(first.body.thread.votes, 1)
    assert.equal(first.body.thread.iVoted, true)
    const again = await as(helper).post(`/api/questions/${q.id}/vote`)
    assert.equal(again.status, 409)
    assert.equal((await Thread.findById(q.id))!.votes, 1)
  })

  it('does not double count parallel votes', async () => {
    const q = (await ask()).body.thread
    await Promise.all(Array.from({ length: 5 }, () => as(helper).post(`/api/questions/${q.id}/vote`)))
    assert.equal((await Thread.findById(q.id))!.votes, 1)
  })

  it('applies the same rules to answers', async () => {
    const q = (await ask()).body.thread
    const r = (await as(helper).post(`/api/questions/${q.id}/replies`, { body: 'Every row of the left table.' })).body.reply
    assert.equal((await as(helper).post(`/api/questions/replies/${r.id}/vote`)).status, 403)
    assert.equal((await as(asker).post(`/api/questions/replies/${r.id}/vote`)).status, 200)
    assert.equal((await as(asker).post(`/api/questions/replies/${r.id}/vote`)).status, 409)
    assert.equal((await Reply.findById(r.id))!.votes, 1)
  })
})

describe('answers and accepting', () => {
  it('adds an answer and counts it on the question', async () => {
    const q = (await ask()).body.thread
    const res = await as(helper).post(`/api/questions/${q.id}/replies`, { body: 'It keeps unmatched rows with NULLs.' })
    assert.equal(res.status, 201)
    const full = (await as(asker).get(`/api/questions/${q.id}`)).body
    assert.equal(full.thread.replyCount, 1)
    assert.equal(full.replies.length, 1)
  })

  it(`allows ${LIMITS.repliesPer10Min} answers per 10 minutes, then answers 429`, async () => {
    const q = (await ask()).body.thread
    for (let i = 0; i < LIMITS.repliesPer10Min; i++) assert.equal((await as(helper).post(`/api/questions/${q.id}/replies`, { body: `Answer ${i}` })).status, 201)
    assert.equal((await as(helper).post(`/api/questions/${q.id}/replies`, { body: 'One more' })).status, 429)
  })

  it('keeps the answer limit with parallel requests', async () => {
    const q = (await ask()).body.thread
    const res = await Promise.all(Array.from({ length: 20 }, (_, i) => as(helper).post(`/api/questions/${q.id}/replies`, { body: `Answer ${i}` })))
    assert.equal(res.filter((r) => r.status === 201).length, LIMITS.repliesPer10Min)
    assert.equal(await Reply.countDocuments({ author: helper }), LIMITS.repliesPer10Min)
  })

  it('only lets the asker accept, never their own answer, and only once', async () => {
    const q = (await ask()).body.thread
    const theirs = (await as(helper).post(`/api/questions/${q.id}/replies`, { body: 'Helper answer' })).body.reply
    const own = (await as(asker).post(`/api/questions/${q.id}/replies`, { body: 'Asker answer' })).body.reply
    assert.equal((await as(helper).post(`/api/questions/replies/${theirs.id}/accept`)).status, 403)
    const self = await as(asker).post(`/api/questions/replies/${own.id}/accept`)
    assert.equal(self.status, 403)
    assert.equal(self.body.error.code, 'own_answer')
    const ok = await as(asker).post(`/api/questions/replies/${theirs.id}/accept`)
    assert.equal(ok.status, 200)
    assert.equal(ok.body.reply.accepted, true)
    assert.equal((await Thread.findById(q.id))!.solved, true)
    const twice = await as(asker).post(`/api/questions/replies/${theirs.id}/accept`)
    assert.equal(twice.status, 409)
    assert.equal((await Reply.findById(theirs.id))!.accepted, true)
  })
})
