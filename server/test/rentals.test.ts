/**
 * Rentals API tests. Need a running MongoDB; use their own throwaway database (smuhub_test_rentals by default),
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
import { RentalItem, RentalRequest } from '../src/models/Rental.js'
import { LIMITS } from '../src/routes/rentals.js'

const MONGO = process.env.MONGODB_URI_TEST_RENTALS ?? 'mongodb://127.0.0.1:27017/smuhub_test_rentals'
const SECRET = 'test-secret-that-is-long-enough-for-hs256-signing'
const app = createApp(loadConfig({ NODE_ENV: 'test', MONGODB_URI: MONGO, JWT_SECRET: SECRET, ALLOWED_EMAIL_DOMAINS: 'medtech.tn,msb.tn' }))

const DAY = 86_400_000
const CONTACT = 'Telegram @lina_secret_handle'
let owner = '', renter = '', other = ''
const cookie = (id: string) => `${SESSION_COOKIE}=${jwt.sign({}, SECRET, { subject: id, expiresIn: 60 })}`
const as = (id: string) => ({
  get: (path: string) => request(app).get(path).set('Cookie', cookie(id)),
  post: (path: string, body?: object) => request(app).post(path).set('Cookie', cookie(id)).send(body ?? {}),
})
const ITEM = { title: 'Casio fx-991EX Classwiz', category: 'calculator', pricePerDay: 2, deposit: 20, condition: 'good', description: 'Exam-approved.', contact: CONTACT }
const list = (id = owner, over: object = {}) => as(id).post('/api/rentals', { ...ITEM, ...over })
const ask = (itemId: string, id = renter, over: object = {}) => as(id).post(`/api/rentals/${itemId}/requests`, { from: Date.now(), to: Date.now() + 2 * DAY, note: 'For the MATH101 midterm.', ...over })
const respond = (requestId: string, accept: boolean, id = owner) => as(id).post(`/api/rentals/requests/${requestId}/respond`, { accept })
type Item = { id: string; myRequest?: { status: string; contact?: string }; available: boolean; pendingRequests: number }
const seen = async (id: string, itemId: string) => ((await as(id).get('/api/rentals')).body.items as Item[]).find((i) => i.id === itemId)!
const leaks = (body: unknown) => JSON.stringify(body).includes(CONTACT)

before(async () => {
  await mongoose.connect(MONGO, { serverSelectionTimeoutMS: 3000 })
  await mongoose.connection.dropDatabase()
  await RentalRequest.syncIndexes() // the drop removed the partial unique index
})
after(async () => {
  await mongoose.connection.dropDatabase()
  await mongoose.disconnect()
})
beforeEach(async () => {
  await Promise.all([User.deleteMany({}), RentalItem.deleteMany({}), RentalRequest.deleteMany({})])
  const base = { passwordHash: 'x', major: 'CS', year: 2 }
  owner = (await User.create({ ...base, email: 'lina.haddad@medtech.tn', firstName: 'Lina', lastName: 'Haddad' }))._id.toString()
  renter = (await User.create({ ...base, email: 'omar.jaziri@msb.tn', firstName: 'Omar', lastName: 'Jaziri' }))._id.toString()
  other = (await User.create({ ...base, email: 'sami.gharbi@medtech.tn', firstName: 'Sami', lastName: 'Gharbi' }))._id.toString()
})

describe('listing items', () => {
  it('requires a session', async () => {
    const id = new mongoose.Types.ObjectId().toString()
    assert.equal((await request(app).get('/api/rentals')).status, 401)
    assert.equal((await request(app).get('/api/rentals/incoming')).status, 401)
    assert.equal((await request(app).post('/api/rentals').send(ITEM)).status, 401)
    assert.equal((await request(app).post(`/api/rentals/${id}/requests`).send({})).status, 401)
    assert.equal((await request(app).post(`/api/rentals/requests/${id}/respond`).send({ accept: true })).status, 401)
    assert.equal((await request(app).post(`/api/rentals/${id}/returned`)).status, 401)
  })

  it('creates a listing without exposing the contact or any email', async () => {
    const res = await list()
    assert.equal(res.status, 201)
    assert.equal(res.body.item.title, ITEM.title)
    assert.equal(res.body.item.owner.name, 'Lina Haddad')
    assert.equal(res.body.item.mine, true)
    assert.equal(res.body.item.available, true)
    assert.ok(!leaks(res.body), 'the create response must not contain the contact')
    assert.ok(!JSON.stringify(res.body).includes('@medtech'), 'response must not contain an email')
    assert.equal((await RentalItem.findById(res.body.item.id).select('+contact'))!.contact, CONTACT)
  })

  it('rejects a short title, bad prices, a missing contact and unknown categories', async () => {
    const bad = async (over: object, code: string) => {
      const res = await list(owner, over)
      assert.equal(res.status, 400)
      assert.equal(res.body.error.code, code)
    }
    await bad({ title: 'Pen' }, 'bad_title')
    await bad({ pricePerDay: 500 }, 'bad_price')
    await bad({ deposit: -1 }, 'bad_price')
    await bad({ contact: 'x' }, 'bad_contact')
    await bad({ category: 'cars' }, 'invalid_input')
    assert.equal(await RentalItem.countDocuments(), 0)
  })

  it(`allows ${LIMITS.listingsPerStudent} listings per student, then answers 429`, async () => {
    for (let i = 0; i < LIMITS.listingsPerStudent; i++) assert.equal((await list(owner, { title: `Calculator number ${i}` })).status, 201)
    const res = await list()
    assert.equal(res.status, 429)
    assert.equal(res.body.error.code, 'rate_limited')
    assert.equal((await list(renter)).status, 201)
  })
})

describe('requests', () => {
  it('blocks requesting your own item', async () => {
    const item = (await list()).body.item
    const res = await ask(item.id, owner)
    assert.equal(res.status, 403)
    assert.equal(res.body.error.code, 'self_request')
  })

  it('validates the dates', async () => {
    const item = (await list()).body.item
    const now = Date.now()
    assert.equal((await ask(item.id, renter, { from: now - 3 * DAY, to: now })).status, 400)
    assert.equal((await ask(item.id, renter, { from: now + 2 * DAY, to: now + DAY })).status, 400)
    assert.equal((await ask(item.id, renter, { from: now, to: now + 31 * DAY })).status, 400)
    assert.equal((await ask(item.id, renter, { from: 'today', to: now })).status, 400)
    // The date picker sends today's midnight (UTC), slightly in the past, and allows a same-day rental.
    const midnight = new Date(new Date().toISOString().slice(0, 10)).getTime()
    assert.equal((await ask(item.id, renter, { from: midnight, to: midnight })).status, 201)
  })

  it('blocks a second open request for the same item, even in parallel', async () => {
    const item = (await list()).body.item
    assert.equal((await ask(item.id)).status, 201)
    const again = await ask(item.id)
    assert.equal(again.status, 409)
    assert.equal(again.body.error.code, 'duplicate')
    const second = (await list(owner, { title: 'TI-84 Plus CE' })).body.item
    const results = await Promise.all(Array.from({ length: 5 }, () => ask(second.id)))
    assert.equal(results.filter((r) => r.status === 201).length, 1)
    assert.equal(await RentalRequest.countDocuments({ item: second.id }), 1)
  })

  it('answers 404 for unknown or malformed ids', async () => {
    assert.equal((await ask('not-an-id')).status, 404)
    assert.equal((await ask(new mongoose.Types.ObjectId().toString())).status, 404)
    assert.equal((await respond('not-an-id', true)).status, 404)
    assert.equal((await as(owner).post(`/api/rentals/${new mongoose.Types.ObjectId()}/returned`)).status, 404)
  })
})

describe('responding, privacy and returns', () => {
  it('shows incoming requests to the owner only, without the contact', async () => {
    const item = (await list()).body.item
    await ask(item.id)
    const inc = await as(owner).get('/api/rentals/incoming')
    assert.equal(inc.status, 200)
    assert.equal(inc.body.requests.length, 1)
    assert.equal(inc.body.requests[0].renter.name, 'Omar Jaziri')
    assert.equal(inc.body.requests[0].status, 'pending')
    assert.ok(!leaks(inc.body))
    assert.ok(!JSON.stringify(inc.body).includes('@msb'), 'incoming must not contain an email')
    assert.equal((await as(renter).get('/api/rentals/incoming')).body.requests.length, 0)
    assert.equal((await seen(owner, item.id)).pendingRequests, 1)
    assert.equal((await seen(renter, item.id)).pendingRequests, 0)
  })

  it('lets only the owner respond', async () => {
    const item = (await list()).body.item
    const q = (await ask(item.id)).body.request
    assert.equal((await respond(q.id, true, renter)).status, 403)
    assert.equal((await respond(q.id, true, other)).status, 403)
    assert.equal((await as(owner).post(`/api/rentals/requests/${q.id}/respond`, { accept: 'yes' })).status, 400)
    assert.equal((await RentalRequest.findById(q.id))!.status, 'pending')
  })

  it('reveals the contact only to the accepted renter', async () => {
    const item = (await list()).body.item
    const q = (await ask(item.id)).body.request
    await ask(item.id, other)
    // While pending, nobody sees it, the renter included.
    for (const id of [owner, renter, other]) assert.ok(!leaks((await as(id).get('/api/rentals')).body), 'pending: no contact in lists')
    const ok = await respond(q.id, true)
    assert.equal(ok.status, 200)
    assert.equal(ok.body.request.status, 'accepted')
    assert.ok(!leaks(ok.body), 'the owner does not get it back in the respond response')
    const mine = await seen(renter, item.id)
    assert.equal(mine.myRequest!.status, 'accepted')
    assert.equal(mine.myRequest!.contact, CONTACT)
    // The other requester was declined and never sees it; neither does the owner's own list or incoming.
    const theirs = await seen(other, item.id)
    assert.equal(theirs.myRequest!.status, 'declined')
    assert.ok(!leaks((await as(other).get('/api/rentals')).body))
    assert.ok(!leaks((await as(owner).get('/api/rentals')).body))
    assert.ok(!leaks((await as(owner).get('/api/rentals/incoming')).body))
  })

  it('accepting marks the item unavailable, declines other requests and blocks new ones', async () => {
    const item = (await list()).body.item
    const a = (await ask(item.id)).body.request
    const b = (await ask(item.id, other)).body.request
    assert.equal((await respond(a.id, true)).status, 200)
    assert.equal((await seen(owner, item.id)).available, false)
    assert.equal((await RentalRequest.findById(b.id))!.status, 'declined')
    assert.equal((await respond(b.id, true)).status, 409)
    assert.equal((await respond(a.id, false)).status, 409)
    const late = await ask(item.id, other)
    assert.equal(late.status, 409)
    assert.equal(late.body.error.code, 'unavailable')
  })

  it('lends an item to one renter only with parallel accepts', async () => {
    const item = (await list()).body.item
    const a = (await ask(item.id)).body.request
    const b = (await ask(item.id, other)).body.request
    const res = await Promise.all([respond(a.id, true), respond(b.id, true)])
    assert.equal(res.filter((r) => r.status === 200).length, 1)
    assert.equal(await RentalRequest.countDocuments({ item: item.id, status: 'accepted' }), 1)
  })

  it('declining keeps the item available and lets the renter ask again', async () => {
    const item = (await list()).body.item
    const q = (await ask(item.id)).body.request
    const no = await respond(q.id, false)
    assert.equal(no.status, 200)
    assert.equal(no.body.request.status, 'declined')
    assert.equal((await seen(renter, item.id)).myRequest!.status, 'declined')
    assert.ok(!leaks((await as(renter).get('/api/rentals')).body))
    assert.equal((await ask(item.id)).status, 201)
    // The latest request is the one shown.
    assert.equal((await seen(renter, item.id)).myRequest!.status, 'pending')
  })

  it('lets only the owner mark a return, which frees the item and hides the contact again', async () => {
    const item = (await list()).body.item
    const q = (await ask(item.id)).body.request
    await respond(q.id, true)
    assert.equal((await as(renter).post(`/api/rentals/${item.id}/returned`)).status, 403)
    assert.equal((await as(other).post(`/api/rentals/${item.id}/returned`)).status, 403)
    const back = await as(owner).post(`/api/rentals/${item.id}/returned`)
    assert.equal(back.status, 200)
    assert.equal(back.body.item.available, true)
    assert.ok(!leaks(back.body))
    const mine = await seen(renter, item.id)
    assert.equal(mine.myRequest!.status, 'returned')
    assert.equal(mine.myRequest!.contact, undefined)
    assert.ok(!leaks((await as(renter).get('/api/rentals')).body))
    assert.equal((await ask(item.id, other)).status, 201)
  })
})
