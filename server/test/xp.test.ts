/**
 * XP, profile and leaderboard tests. Need a running MongoDB; use their own throwaway database
 * (smuhub_test_xp by default, so they never collide with the other test files running in parallel).
 *   npm test
 */
import { after, before, beforeEach, describe, it } from 'node:test'
import assert from 'node:assert/strict'
import jwt from 'jsonwebtoken'
import mongoose, { type Types } from 'mongoose'
import request from 'supertest'
import { createApp } from '../src/app.js'
import { loadConfig } from '../src/config/env.js'
import { SESSION_COOKIE } from '../src/lib/session.js'
import { DAY, XP_RULES, award, compensate } from '../src/lib/xp.js'
import { Ledger } from '../src/models/Ledger.js'
import { User } from '../src/models/User.js'
import { Thread } from '../src/models/Thread.js'
import { Reply } from '../src/models/Reply.js'

const MONGO = process.env.MONGODB_URI_TEST_XP ?? 'mongodb://127.0.0.1:27017/smuhub_test_xp'
const SECRET = 'test-secret-that-is-long-enough-for-hs256-signing'
const app = createApp(loadConfig({ NODE_ENV: 'test', MONGODB_URI: MONGO, JWT_SECRET: SECRET, ALLOWED_EMAIL_DOMAINS: 'medtech.tn,msb.tn' }))

type Id = Types.ObjectId
let lina: Id, omar: Id, sara: Id
const cookie = (id: Id) => `${SESSION_COOKIE}=${jwt.sign({}, SECRET, { subject: id.toString(), expiresIn: 60 })}`
const as = (id: Id) => ({
  get: (path: string) => request(app).get(path).set('Cookie', cookie(id)),
  post: (path: string, body?: object) => request(app).post(path).set('Cookie', cookie(id)).send(body ?? {}),
  patch: (path: string, body?: object) => request(app).patch(path).set('Cookie', cookie(id)).send(body ?? {}),
})
let n = 0
const give = (user: Id, actor: Id | 'system', points = 1, over: object = {}) =>
  award({ user, actor, kind: 'question_upvoted', points, refKey: `test:${++n}`, label: 'Test', ...over })
// Inserted rows bypass award(): used to set up history (old rows, a nearly full day).
const row = (user: Id, actor: Id | null, points: number, msAgo = 0) =>
  Ledger.create({ user, actor, kind: 'answer_accepted', points, refKey: `row:${++n}`, label: 'History', createdAt: new Date(Date.now() - msAgo) })
const total = async (user: Id) => (await Ledger.find({ user })).reduce((s, l) => s + l.points, 0)
const QUESTION = { title: 'What does a LEFT JOIN return?', body: 'Lab 4 uses it and I do not see the difference.', courseCode: 'CS224' }

before(async () => {
  await mongoose.connect(MONGO, { serverSelectionTimeoutMS: 3000 })
  await mongoose.connection.dropDatabase()
  await Promise.all([User.syncIndexes(), Ledger.syncIndexes()]) // the unique refKey index must exist
})
after(async () => {
  await mongoose.connection.dropDatabase()
  await mongoose.disconnect()
})
beforeEach(async () => {
  // The ledger refuses deletes through the app, so tests clear it with the raw driver.
  await Promise.all([User.deleteMany({}), Thread.deleteMany({}), Reply.deleteMany({}), Ledger.collection.deleteMany({})])
  const base = { passwordHash: 'x', major: 'CS', year: 2 }
  lina = (await User.create({ ...base, email: 'lina.haddad@medtech.tn', firstName: 'Lina', lastName: 'Haddad' }))._id
  omar = (await User.create({ ...base, email: 'omar.jaziri@msb.tn', firstName: 'Omar', lastName: 'Jaziri' }))._id
  sara = (await User.create({ ...base, email: 'sara.mejri@medtech.tn', firstName: 'Sara', lastName: 'Mejri' }))._id
})

describe('award()', () => {
  it('blocks self-awards, but lets the system award', async () => {
    assert.equal(await give(lina, lina, 5), 0)
    assert.equal(await Ledger.countDocuments(), 0)
    assert.equal(await give(lina, 'system', 30, { kind: 'resource_verified' }), 30)
    assert.equal((await Ledger.findOne({ user: lina }))!.actor, null)
  })

  it('pays a refKey once, even with parallel requests', async () => {
    const ev = { kind: 'answer_accepted' as const, refKey: 'accept:once', label: 'Accepted' }
    assert.equal(await award({ user: lina, actor: omar, points: 15, ...ev }), 15)
    assert.equal(await award({ user: lina, actor: omar, points: 15, ...ev }), 0)
    const paid = await Promise.all(Array.from({ length: 5 }, () => award({ user: omar, actor: sara, points: 2, kind: 'answer_upvoted', refKey: 'rv:parallel', label: 'Up' })))
    assert.equal(paid.reduce((s, p) => s + p, 0), 2)
    assert.equal(await Ledger.countDocuments({ refKey: 'rv:parallel' }), 1)
  })

  it(`clamps the daily cap of ${XP_RULES.dailyXpCap} XP, then pays 0`, async () => {
    await row(lina, sara, XP_RULES.dailyXpCap - 5)
    assert.equal(await give(lina, omar, 15), 5)
    assert.equal(await give(lina, omar, 2), 0)
    assert.equal(await total(lina), XP_RULES.dailyXpCap)
  })

  it('only counts the last 24 hours for the daily cap', async () => {
    await row(lina, sara, XP_RULES.dailyXpCap, DAY + 60_000)
    assert.equal(await give(lina, omar, 15), 15)
  })

  it(`allows ${XP_RULES.pairWeeklyCap} paying interactions per pair per week`, async () => {
    for (let i = 0; i < XP_RULES.pairWeeklyCap; i++) assert.equal(await give(lina, omar), 1)
    assert.equal(await give(lina, omar), 0)
    assert.equal(await give(lina, sara), 1, 'another classmate can still give points')
    assert.equal(await give(omar, lina), 1, 'the cap is per direction')
  })

  it('forgets pair interactions older than 7 days', async () => {
    for (let i = 0; i < XP_RULES.pairWeeklyCap; i++) await row(lina, omar, 1, 8 * DAY)
    assert.equal(await give(lina, omar), 1)
  })

  it('ignores zero and negative points', async () => {
    assert.equal(await give(lina, omar, 0), 0)
    assert.equal(await give(lina, omar, -5), 0)
    assert.equal(await Ledger.countDocuments(), 0)
  })

  it('compensates removed content with one negative row, once', async () => {
    await award({ user: lina, actor: omar, kind: 'resource_helpful', points: 5, refKey: 'helpful:o:res1', label: 'Helpful' })
    await award({ user: lina, actor: sara, kind: 'resource_helpful', points: 5, refKey: 'helpful:s:res1', label: 'Helpful' })
    await award({ user: lina, actor: sara, kind: 'resource_helpful', points: 5, refKey: 'helpful:s:res2', label: 'Helpful' })
    assert.equal(await compensate({ user: lina, match: /:res1$/, refKey: 'remove:res1', label: 'Removed' }), -10)
    assert.equal(await compensate({ user: lina, match: /:res1$/, refKey: 'remove:res1', label: 'Removed' }), 0)
    assert.equal(await total(lina), 5)
    assert.equal((await Ledger.findOne({ refKey: 'remove:res1' }))!.kind, 'removal_penalty')
  })
})

describe('ledger is append-only', () => {
  it('rejects every update and delete from the app', async () => {
    await give(lina, omar, 1, { refKey: 'tv:x:y' })
    const q = { refKey: 'tv:x:y' }
    await assert.rejects(Ledger.updateOne(q, { points: 100 }).exec(), /append-only/)
    await assert.rejects(Ledger.updateMany(q, { points: 100 }).exec(), /append-only/)
    await assert.rejects(Ledger.findOneAndUpdate(q, { points: 100 }).exec(), /append-only/)
    await assert.rejects(Ledger.replaceOne(q, { points: 100 }).exec(), /append-only/)
    await assert.rejects(Ledger.deleteOne(q).exec(), /append-only/)
    await assert.rejects(Ledger.deleteMany({}).exec(), /append-only/)
    await assert.rejects(Ledger.findOneAndDelete(q).exec(), /append-only/)
    await assert.rejects(Ledger.bulkWrite([{ deleteOne: { filter: q } }]), /append-only/)
    const doc = (await Ledger.findOne(q))!
    doc.points = 100
    await assert.rejects(doc.save(), /append-only/)
    await assert.rejects(doc.deleteOne(), /append-only/)
    const kept = (await Ledger.findOne(q))!
    assert.equal(kept.points, 1)
  })
})

describe('Q&A pays the author', () => {
  it('upvoted question +1, upvoted answer +2, accepted answer +15', async () => {
    const q = (await as(lina).post('/api/questions', QUESTION)).body.thread
    assert.equal((await as(omar).post(`/api/questions/${q.id}/vote`)).status, 200)
    const r = (await as(omar).post(`/api/questions/${q.id}/replies`, { body: 'Every row of the left table.' })).body.reply
    assert.equal((await as(lina).post(`/api/questions/replies/${r.id}/vote`)).status, 200)
    assert.equal((await as(lina).post(`/api/questions/replies/${r.id}/accept`)).status, 200)

    assert.equal(await total(lina), XP_RULES.points.questionUp)
    assert.equal(await total(omar), XP_RULES.points.answerUp + XP_RULES.points.accepted)
    const keys = (await Ledger.find().sort({ createdAt: 1 })).map((l) => [l.refKey, l.kind])
    assert.deepEqual(keys, [
      [`tv:${omar}:${q.id}`, 'question_upvoted'],
      [`rv:${lina}:${r.id}`, 'answer_upvoted'],
      [`accept:${q.id}`, 'answer_accepted'],
    ])
    assert.equal((await as(lina).get('/api/me')).body.me.xp, 1)
  })

  it('pays nothing for refused votes and accepts', async () => {
    const q = (await as(lina).post('/api/questions', QUESTION)).body.thread
    assert.equal((await as(lina).post(`/api/questions/${q.id}/vote`)).status, 403)
    await as(omar).post(`/api/questions/${q.id}/vote`)
    assert.equal((await as(omar).post(`/api/questions/${q.id}/vote`)).status, 409)
    const own = (await as(lina).post(`/api/questions/${q.id}/replies`, { body: 'My own answer' })).body.reply
    assert.equal((await as(lina).post(`/api/questions/replies/${own.id}/accept`)).status, 403)
    assert.equal(await total(lina), 1)
    assert.equal(await Ledger.countDocuments(), 1)
  })
})

describe('GET /api/me and /api/me/xp', () => {
  it('requires a session', async () => {
    for (const path of ['/api/me', '/api/me/xp', '/api/leaderboard', `/api/users/${new mongoose.Types.ObjectId()}`]) {
      assert.equal((await request(app).get(path)).status, 401, path)
    }
    assert.equal((await request(app).patch('/api/me').send({ bio: 'x' })).status, 401)
  })

  it('returns the Me shape with all-time XP, weekly XP and rank, without the email', async () => {
    await row(lina, omar, 40, 10 * DAY)
    await give(lina, omar, 2)
    await row(omar, lina, 100, 10 * DAY)
    const res = await as(lina).get('/api/me')
    assert.equal(res.status, 200)
    const me = res.body.me
    assert.deepEqual(Object.keys(me).sort(), ['bio', 'courses', 'handle', 'id', 'joinedAt', 'major', 'name', 'rank', 'role', 'uploads', 'weeklyXp', 'xp', 'year'])
    assert.equal(me.id, lina.toString())
    assert.equal(me.name, 'Lina Haddad')
    assert.equal(me.xp, 42)
    assert.equal(me.weeklyXp, 2)
    assert.equal(me.rank, 2)
    assert.equal(me.role, 'student')
    assert.equal(me.uploads, 0)
    assert.deepEqual(me.courses, [])
    assert.equal(typeof me.joinedAt, 'number')
    assert.ok(!JSON.stringify(res.body).includes('@'), 'response must not contain an email')
    assert.equal((await as(sara).get('/api/me')).body.me.rank, 0, 'no XP yet: not ranked')
  })

  it('lists the ledger newest first, 50 rows max', async () => {
    await Ledger.insertMany(Array.from({ length: 55 }, (_, i) => ({ user: lina, actor: omar, kind: 'answer_upvoted', points: 2, refKey: `bulk:${i}`, label: `Row ${i}`, createdAt: new Date(Date.now() - (55 - i) * 60_000) })))
    await row(omar, lina, 5)
    const rows = (await as(lina).get('/api/me/xp')).body.rows
    assert.equal(rows.length, 50)
    assert.equal(rows[0].label, 'Row 54')
    assert.ok(rows.every((r: { at: number }, i: number) => i === 0 || rows[i - 1].at >= r.at))
    assert.deepEqual(Object.keys(rows[0]).sort(), ['at', 'id', 'kind', 'label', 'points'])
  })
})

describe('PATCH /api/me', () => {
  it('updates major, year, bio and courses, never the name', async () => {
    const res = await as(lina).patch('/api/me', { name: 'Hacker', major: '  Data   Science ', year: 3, bio: 'Happy to help with SQL.', courses: ['cs224', 'MATH210', 'CS224'] })
    assert.equal(res.status, 200)
    const me = res.body.me
    assert.equal(me.name, 'Lina Haddad')
    assert.equal(me.major, 'Data Science')
    assert.equal(me.year, 3)
    assert.equal(me.bio, 'Happy to help with SQL.')
    assert.deepEqual(me.courses, ['CS224', 'MATH210'])
    const saved = (await User.findById(lina))!
    assert.equal(saved.firstName, 'Lina')
    assert.equal(saved.bio, 'Happy to help with SQL.')
  })

  it('keeps the current major when an empty one is sent', async () => {
    assert.equal((await as(lina).patch('/api/me', { major: '  ', bio: '' })).body.me.major, 'CS')
  })

  it('rejects invalid input', async () => {
    const bad = [{ year: 7 }, { year: 0 }, { year: 2.5 }, { year: '3' }, { major: 'x'.repeat(41) }, { bio: 'x'.repeat(241) },
      { courses: ['FAKE999'] }, { courses: 'CS224' }, { courses: Array.from({ length: 13 }, () => 'CS224') }]
    for (const body of bad) {
      const res = await as(lina).patch('/api/me', body)
      assert.equal(res.status, 400, JSON.stringify(body))
      assert.equal(res.body.error.code, 'invalid_input')
    }
    const saved = (await User.findById(lina))!
    assert.equal(saved.year, 2)
    assert.deepEqual([...saved.courses], [])
  })
})

describe('GET /api/leaderboard', () => {
  it('ranks by XP over the week or all time, with isMe', async () => {
    await row(lina, sara, 100, 10 * DAY) // old: all time only
    await give(omar, lina, 1)
    await give(omar, sara, 1)
    await give(sara, omar, 1)
    const all = (await as(sara).get('/api/leaderboard?period=all')).body.rows
    assert.deepEqual(all.map((r: { user: { name: string }; xp: number; rank: number }) => [r.user.name, r.xp, r.rank]), [['Lina Haddad', 100, 1], ['Omar Jaziri', 2, 2], ['Sara Mejri', 1, 3]])
    assert.deepEqual(all.map((r: { isMe: boolean }) => r.isMe), [false, false, true])
    const week = await as(sara).get('/api/leaderboard?period=week')
    assert.equal(week.status, 200)
    assert.deepEqual(week.body.rows.map((r: { user: { name: string }; xp: number }) => [r.user.name, r.xp]), [['Omar Jaziri', 2], ['Sara Mejri', 1]])
    assert.deepEqual(Object.keys(all[0]).sort(), ['isMe', 'rank', 'uploads', 'user', 'xp'])
    assert.ok(!JSON.stringify(all).includes('@'), 'response must not contain an email')
  })

  it('gives tied students the same rank, like /api/me', async () => {
    await give(lina, sara, 2)
    await give(omar, sara, 2)
    await give(sara, lina, 1)
    const rows = (await as(lina).get('/api/leaderboard?period=all')).body.rows
    assert.deepEqual(rows.map((r: { rank: number }) => r.rank), [1, 1, 3])
    assert.equal((await as(omar).get('/api/me')).body.me.rank, 1)
    assert.equal((await as(sara).get('/api/me')).body.me.rank, 3)
  })

  it('rejects an unknown period', async () => {
    assert.equal((await as(lina).get('/api/leaderboard?period=year')).status, 400)
  })
})

describe('GET /api/users/:id', () => {
  it('returns the public profile, never the email or anonymous content', async () => {
    await User.updateOne({ _id: lina }, { bio: 'SQL nerd' })
    const pub = (await as(lina).post('/api/questions', QUESTION)).body.thread
    await Thread.create({ ...QUESTION, title: 'A secret anonymous question', author: lina, anonymous: true })
    await as(lina).post(`/api/questions/${pub.id}/replies`, { body: 'Answer on my own question' })
    const other = (await as(omar).post('/api/questions', { ...QUESTION, title: 'How do I compute a variance?' })).body.thread
    const mine = (await as(lina).post(`/api/questions/${other.id}/replies`, { body: 'Use the mean of squares.' })).body.reply
    await as(omar).post(`/api/questions/replies/${mine.id}/accept`)
    await Reply.create({ thread: other.id, body: 'Anonymous accepted', author: lina, anonymous: true, accepted: true })

    const res = await as(omar).get(`/api/users/${lina}`)
    assert.equal(res.status, 200)
    const p = res.body
    assert.deepEqual(Object.keys(p).sort(), ['acceptedAnswers', 'resources', 'threads', 'user'])
    assert.deepEqual(Object.keys(p.user).sort(), ['bio', 'handle', 'id', 'joinedAt', 'major', 'name', 'rank', 'xp', 'year'])
    assert.equal(p.user.name, 'Lina Haddad')
    assert.equal(p.user.bio, 'SQL nerd')
    assert.equal(p.user.xp, XP_RULES.points.accepted)
    assert.equal(p.user.rank, 1)
    assert.deepEqual(p.resources, [])
    assert.deepEqual(p.threads.map((t: { title: string }) => t.title), [QUESTION.title])
    assert.equal(p.threads[0].mine, false)
    assert.equal(p.acceptedAnswers, 1)
    assert.ok(!JSON.stringify(p).includes('@'), 'response must not contain an email')
    assert.ok(!JSON.stringify(p).includes('secret anonymous'), 'anonymous content must not be listed')
  })

  it('answers 404 for unknown or malformed ids', async () => {
    assert.equal((await as(lina).get('/api/users/not-an-id')).status, 404)
    assert.equal((await as(lina).get(`/api/users/${new mongoose.Types.ObjectId()}`)).status, 404)
  })
})
