/**
 * Calendar API tests. Need a running MongoDB; use their own throwaway database (smuhub_test_events by default),
 * dropped at the end.
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
import { Event } from '../src/models/Event.js'
import { LIMITS } from '../src/routes/events.js'
import { dropTestDb } from './db.js'

const MONGO = process.env.MONGODB_URI_TEST_EVENTS ?? 'mongodb://127.0.0.1:27017/smuhub_test_events'
const SECRET = 'test-secret-that-is-long-enough-for-hs256-signing'
const app = createApp(loadConfig({ NODE_ENV: 'test', MONGODB_URI: MONGO, JWT_SECRET: SECRET, ALLOWED_EMAIL_DOMAINS: 'medtech.tn,msb.tn' }))

const DAY = 86_400_000
let lina = '', omar = ''
const cookie = (id: string) => `${SESSION_COOKIE}=${jwt.sign({}, SECRET, { subject: id, expiresIn: 60 })}`
const as = (id: string) => ({
  get: (path: string) => request(app).get(path).set('Cookie', cookie(id)),
  post: (path: string, body?: object) => request(app).post(path).set('Cookie', cookie(id)).send(body ?? {}),
})
const EVENT = { title: 'CS324 project proposal deadline', kind: 'deadline', location: 'Moodle', description: 'Submit the PDF before midnight.', courseCode: 'CS324' }
const add = (id = lina, over: object = {}) => as(id).post('/api/events', { ...EVENT, startsAt: Date.now() + 2 * DAY, ...over })

before(async () => {
  await mongoose.connect(MONGO, { serverSelectionTimeoutMS: 3000 })
  await mongoose.connection.dropDatabase()
})
after(dropTestDb)
beforeEach(async () => {
  await Promise.all([User.deleteMany({}), Event.deleteMany({})])
  const base = { passwordHash: 'x', major: 'CS', year: 2 }
  lina = (await User.create({ ...base, email: 'lina.haddad@medtech.tn', firstName: 'Lina', lastName: 'Haddad' }))._id.toString()
  omar = (await User.create({ ...base, email: 'omar.jaziri@msb.tn', firstName: 'Omar', lastName: 'Jaziri' }))._id.toString()
})

describe('adding and listing events', () => {
  it('requires a session', async () => {
    assert.equal((await request(app).get('/api/events')).status, 401)
    assert.equal((await request(app).post('/api/events').send({ ...EVENT, startsAt: Date.now() + DAY })).status, 401)
    assert.equal((await request(app).post(`/api/events/${new mongoose.Types.ObjectId()}/going`)).status, 401)
  })

  it('creates an event the author already goes to, and never exposes emails', async () => {
    const res = await add()
    assert.equal(res.status, 201)
    const e = res.body.event
    assert.equal(e.title, EVENT.title)
    assert.equal(e.courseCode, 'CS324')
    assert.equal(e.author.name, 'Lina Haddad')
    assert.equal(e.going, 1)
    assert.equal(e.iGo, true)
    assert.equal(typeof e.startsAt, 'number')
    assert.ok(!JSON.stringify(res.body).includes('@'), 'response must not contain an email')
  })

  it('accepts an empty course code and location (shown as TBA), like the page sends them', async () => {
    const res = await add(lina, { courseCode: '', location: '  ' })
    assert.equal(res.status, 201)
    assert.equal(res.body.event.courseCode, undefined)
    assert.equal(res.body.event.location, 'TBA')
  })

  it('rejects a short title, an unknown kind or course, and dates in the past or too far ahead', async () => {
    assert.equal((await add(lina, { title: 'Quiz' })).status, 400)
    assert.equal((await add(lina, { kind: 'party' })).status, 400)
    assert.equal((await add(lina, { courseCode: 'FAKE999' })).status, 400)
    assert.equal((await add(lina, { startsAt: 'tomorrow' })).status, 400)
    const past = await add(lina, { startsAt: Date.now() - 2 * 3_600_000 })
    assert.equal(past.status, 400)
    assert.equal(past.body.error.code, 'bad_date')
    assert.equal((await add(lina, { startsAt: Date.now() + 400 * DAY })).status, 400)
    assert.equal(await Event.countDocuments(), 0)
  })

  it(`allows ${LIMITS.upcomingPerStudent} upcoming events per student, then answers 429`, async () => {
    for (let i = 0; i < LIMITS.upcomingPerStudent; i++) assert.equal((await add(lina, { startsAt: Date.now() + (i + 1) * DAY })).status, 201)
    const res = await add()
    assert.equal(res.status, 429)
    assert.equal(res.body.error.code, 'rate_limited')
    assert.equal((await add(omar)).status, 201)
  })

  it('keeps the upcoming limit with parallel requests', async () => {
    const res = await Promise.all(Array.from({ length: 20 }, (_, i) => add(lina, { startsAt: Date.now() + (i + 1) * DAY })))
    assert.equal(res.filter((r) => r.status === 201).length, LIMITS.upcomingPerStudent)
    assert.equal(await Event.countDocuments({ author: lina }), LIMITS.upcomingPerStudent)
  })

  it('lists upcoming events soonest first and hides old ones', async () => {
    await add(lina, { title: 'Later event on campus', startsAt: Date.now() + 5 * DAY })
    await add(omar, { title: 'Sooner event on campus', startsAt: Date.now() + DAY })
    await Event.create({ title: 'Last week workshop', kind: 'event', startsAt: new Date(Date.now() - 7 * DAY), author: lina })
    const res = await as(omar).get('/api/events')
    assert.equal(res.status, 200)
    assert.deepEqual(res.body.events.map((e: { title: string }) => e.title), ['Sooner event on campus', 'Later event on campus'])
    assert.deepEqual(res.body.events.map((e: { iGo: boolean }) => e.iGo), [true, false])
    assert.ok(!JSON.stringify(res.body).includes('@'), 'list must not contain an email')
  })
})

describe('going', () => {
  it('toggles going on and off', async () => {
    const e = (await add()).body.event
    const on = await as(omar).post(`/api/events/${e.id}/going`)
    assert.equal(on.status, 200)
    assert.equal(on.body.event.going, 2)
    assert.equal(on.body.event.iGo, true)
    const off = await as(omar).post(`/api/events/${e.id}/going`)
    assert.equal(off.body.event.going, 1)
    assert.equal(off.body.event.iGo, false)
  })

  it('keeps the count equal to the list of goers with parallel clicks', async () => {
    const e = (await add()).body.event
    await Promise.all(Array.from({ length: 7 }, () => as(omar).post(`/api/events/${e.id}/going`)))
    const fresh = (await Event.findById(e.id))!
    assert.equal(fresh.going, fresh.goers.length)
    assert.ok(fresh.going === 1 || fresh.going === 2)
  })

  it('answers 404 for unknown or malformed ids', async () => {
    assert.equal((await as(omar).post('/api/events/not-an-id/going')).status, 404)
    assert.equal((await as(omar).post(`/api/events/${new mongoose.Types.ObjectId()}/going`)).status, 404)
  })
})
