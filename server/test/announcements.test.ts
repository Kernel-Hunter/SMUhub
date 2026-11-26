/**
 * Announcements API tests. Need a running MongoDB; use their own throwaway database (smuhub_test_announcements by default,
 * override with MONGODB_URI_TEST_ANNOUNCEMENTS), dropped at the end.
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
import { Ledger } from '../src/models/Ledger.js'
import { Announcement } from '../src/models/Announcement.js'
import { LIMITS } from '../src/routes/announcements.js'

const MONGO = process.env.MONGODB_URI_TEST_ANNOUNCEMENTS ?? 'mongodb://127.0.0.1:27017/smuhub_test_announcements'
const SECRET = 'test-secret-that-is-long-enough-for-hs256-signing'
const app = createApp(loadConfig({ NODE_ENV: 'test', MONGODB_URI: MONGO, JWT_SECRET: SECRET, ALLOWED_EMAIL_DOMAINS: 'medtech.tn,msb.tn' }))

const DAY = 86_400_000
let lina = '', omar = '', admin = ''
const cookie = (id: string) => `${SESSION_COOKIE}=${jwt.sign({}, SECRET, { subject: id, expiresIn: 60 })}`
const as = (id: string) => ({
  get: (path: string) => request(app).get(path).set('Cookie', cookie(id)),
  post: (path: string, body?: object) => request(app).post(path).set('Cookie', cookie(id)).send(body ?? {}),
  del: (path: string) => request(app).delete(path).set('Cookie', cookie(id)),
})
const NOTICE = { title: 'CS324 lab moved to room B12', body: 'This week only, the Thursday lab is in room B12 on the first floor.', courseCode: 'CS324' }
const post = (id = lina, over: object = {}) => as(id).post('/api/announcements', { ...NOTICE, ...over })
const titles = (res: request.Response) => res.body.announcements.map((a: { title: string }) => a.title)

before(async () => {
  await mongoose.connect(MONGO, { serverSelectionTimeoutMS: 3000 })
  await mongoose.connection.dropDatabase()
})
after(async () => {
  await mongoose.connection.dropDatabase()
  await mongoose.disconnect()
})
beforeEach(async () => {
  await Promise.all([User.deleteMany({}), Announcement.deleteMany({})])
  const base = { passwordHash: 'x', major: 'CS', year: 2 }
  lina = (await User.create({ ...base, email: 'lina.haddad@medtech.tn', firstName: 'Lina', lastName: 'Haddad' }))._id.toString()
  omar = (await User.create({ ...base, email: 'omar.jaziri@msb.tn', firstName: 'Omar', lastName: 'Jaziri' }))._id.toString()
  admin = (await User.create({ ...base, email: 'student.office@medtech.tn', firstName: 'Student', lastName: 'Office', role: 'admin' }))._id.toString()
})

describe('posting announcements', () => {
  it('requires a session', async () => {
    assert.equal((await request(app).get('/api/announcements')).status, 401)
    assert.equal((await request(app).post('/api/announcements').send(NOTICE)).status, 401)
    assert.equal((await request(app).delete(`/api/announcements/${new mongoose.Types.ObjectId()}`)).status, 401)
  })

  it('creates an announcement with its author, never an email, and pays no XP', async () => {
    const res = await post()
    assert.equal(res.status, 201)
    const a = res.body.announcement
    assert.equal(a.title, NOTICE.title)
    assert.equal(a.courseCode, 'CS324')
    assert.equal(a.author.name, 'Lina Haddad')
    assert.equal(a.pinned, false)
    assert.equal(a.mine, true)
    assert.equal(typeof a.createdAt, 'number')
    assert.equal(a.expiresAt, undefined)
    assert.ok(!JSON.stringify(res.body).includes('@'), 'response must not contain an email')
    assert.equal(await Ledger.countDocuments(), 0)
  })

  it('accepts an empty course and a future end date', async () => {
    const until = Date.now() + 3 * DAY
    const res = await post(lina, { courseCode: '', expiresAt: until })
    assert.equal(res.status, 201)
    assert.equal(res.body.announcement.courseCode, undefined)
    assert.equal(res.body.announcement.expiresAt, until)
  })

  it('rejects a short title or body, an unknown course and a bad end date, with plain messages', async () => {
    const short = await post(lina, { title: 'Hey' })
    assert.equal(short.status, 400)
    assert.match(short.body.error.message, /title/)
    assert.match((await post(lina, { body: 'Too short' })).body.error.message, /message/)
    assert.equal((await post(lina, { title: 'x'.repeat(121) })).status, 400)
    assert.equal((await post(lina, { body: 'x'.repeat(2001) })).status, 400)
    assert.equal((await post(lina, { courseCode: 'FAKE999' })).status, 400)
    assert.equal((await post(lina, { expiresAt: 'friday' })).status, 400)
    const past = await post(lina, { expiresAt: Date.now() - DAY })
    assert.equal(past.status, 400)
    assert.equal(past.body.error.code, 'bad_date')
    assert.equal((await post(lina, { expiresAt: Date.now() + 400 * DAY })).status, 400)
    assert.equal(await Announcement.countDocuments(), 0)
  })

  it(`allows ${LIMITS.perDay} announcements per student per 24 hours, then answers 429`, async () => {
    for (let i = 0; i < LIMITS.perDay; i++) assert.equal((await post(lina, { title: `Notice number ${i + 1}` })).status, 201)
    const res = await post()
    assert.equal(res.status, 429)
    assert.equal(res.body.error.code, 'rate_limited')
    assert.equal((await post(omar)).status, 201)
    // Older than 24 hours no longer counts (createdAt is immutable through Mongoose, so set it on the raw collection).
    await Announcement.collection.updateMany({ author: new mongoose.Types.ObjectId(lina) }, { $set: { createdAt: new Date(Date.now() - 2 * DAY) } })
    assert.equal((await post()).status, 201)
  })

  it('lets only an admin pin', async () => {
    const res = await post(lina, { pinned: true })
    assert.equal(res.status, 403)
    assert.equal(res.body.error.code, 'forbidden')
    assert.equal(await Announcement.countDocuments(), 0)
    const pinned = await post(admin, { title: 'Library closed on Friday', pinned: true })
    assert.equal(pinned.status, 201)
    assert.equal(pinned.body.announcement.pinned, true)
  })
})

describe('the feed', () => {
  it('lists pinned first, then newest first, and hides expired ones', async () => {
    await Announcement.create({ title: 'Old pinned notice', body: 'Pinned by the student office last week.', author: admin, pinned: true, createdAt: new Date(Date.now() - 5 * DAY) })
    await Announcement.create({ title: 'Older student notice', body: 'Posted two days ago by a student.', author: lina, createdAt: new Date(Date.now() - 2 * DAY) })
    await Announcement.create({ title: 'Expired notice', body: 'This one ended yesterday already.', author: omar, expiresAt: new Date(Date.now() - DAY) })
    await post(omar, { title: 'Newest student notice', expiresAt: Date.now() + DAY })
    const res = await as(lina).get('/api/announcements')
    assert.equal(res.status, 200)
    assert.deepEqual(titles(res), ['Old pinned notice', 'Newest student notice', 'Older student notice'])
    assert.deepEqual(res.body.announcements.map((a: { mine: boolean }) => a.mine), [false, false, true])
    assert.ok(!JSON.stringify(res.body).includes('@'), 'list must not contain an email')
  })

  it('filters by course', async () => {
    await post(lina)
    await post(omar, { title: 'Calculus tutorial moved', courseCode: 'MATH101' })
    await post(omar, { title: 'Robotics club recruiting', courseCode: '' })
    assert.deepEqual(titles(await as(lina).get('/api/announcements?course=math101')), ['Calculus tutorial moved'])
    assert.equal((await as(lina).get('/api/announcements')).body.announcements.length, 3)
    assert.equal((await as(lina).get('/api/announcements?course=FAKE999')).status, 400)
  })
})

describe('deleting', () => {
  it('lets the author or an admin delete, nobody else', async () => {
    const a = (await post()).body.announcement
    const b = (await post(lina, { title: 'Second notice from Lina' })).body.announcement
    const stranger = await as(omar).del(`/api/announcements/${a.id}`)
    assert.equal(stranger.status, 403)
    assert.equal(stranger.body.error.code, 'forbidden')
    assert.equal((await as(lina).del(`/api/announcements/${a.id}`)).status, 204)
    assert.equal((await as(admin).del(`/api/announcements/${b.id}`)).status, 204)
    assert.equal(await Announcement.countDocuments(), 0)
  })

  it('answers 404 for unknown or malformed ids', async () => {
    assert.equal((await as(lina).del('/api/announcements/not-an-id')).status, 404)
    assert.equal((await as(lina).del(`/api/announcements/${new mongoose.Types.ObjectId()}`)).status, 404)
  })
})
