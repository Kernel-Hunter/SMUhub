/**
 * Notifications tests (US-23): every trigger, privacy of anonymous replies, the announcement fan-out, and the
 * /api/notifications routes. Need a running MongoDB; use their own throwaway database (smuhub_test_notifications by default,
 * override with MONGODB_URI_TEST_NOTIFICATIONS), dropped at the end.
 *   npm test
 */
import { after, afterEach, before, beforeEach, describe, it, mock } from 'node:test'
import assert from 'node:assert/strict'
import jwt from 'jsonwebtoken'
import mongoose, { type Types } from 'mongoose'
import request from 'supertest'
import { createApp } from '../src/app.js'
import { loadConfig } from '../src/config/env.js'
import { SESSION_COOKIE } from '../src/lib/session.js'
import { User } from '../src/models/User.js'
import { Ledger } from '../src/models/Ledger.js'
import { Thread } from '../src/models/Thread.js'
import { Reply } from '../src/models/Reply.js'
import { Announcement } from '../src/models/Announcement.js'
import { RentalItem, RentalRequest } from '../src/models/Rental.js'
import { Download, Rating, Resource } from '../src/models/Resource.js'
import { Notification, type NotificationKind } from '../src/models/Notification.js'
import { LIMITS } from '../src/routes/notifications.js'

const MONGO = process.env.MONGODB_URI_TEST_NOTIFICATIONS ?? 'mongodb://127.0.0.1:27017/smuhub_test_notifications'
const SECRET = 'test-secret-that-is-long-enough-for-hs256-signing'
const app = createApp(loadConfig({ NODE_ENV: 'test', MONGODB_URI: MONGO, JWT_SECRET: SECRET, ALLOWED_EMAIL_DOMAINS: 'medtech.tn,msb.tn' }))

type Id = Types.ObjectId
const DAY = 86_400_000
let lina: Id, omar: Id, sara: Id, nour: Id, admin: Id
const cookie = (id: Id) => `${SESSION_COOKIE}=${jwt.sign({}, SECRET, { subject: id.toString(), expiresIn: 60 })}`
const as = (id: Id) => ({
  get: (path: string) => request(app).get(path).set('Cookie', cookie(id)),
  post: (path: string, body?: object) => request(app).post(path).set('Cookie', cookie(id)).send(body ?? {}),
  del: (path: string) => request(app).delete(path).set('Cookie', cookie(id)),
})
const of = (user: Id, kind?: NotificationKind) => (kind ? { user, kind } : { user, kind: { $exists: true } })
const mine = (user: Id, kind?: NotificationKind) => Notification.find(of(user, kind)).sort({ createdAt: 1 })
const count = (user: Id, kind?: NotificationKind) => Notification.countDocuments(of(user, kind))
const noEmail = (body: unknown) => !/@(medtech|msb)\.tn/.test(JSON.stringify(body))

const question = async (author: Id) => (await Thread.create({ kind: 'question', title: 'How do B-trees split?', body: 'I do not get the split step.', courseCode: 'CS224', author }))._id
const voicePost = async (author: Id, anonymous = false) => (await Thread.create({ kind: 'voice', title: 'Library opening hours', body: 'Could the library open earlier?', category: 'facilities', author, anonymous }))._id

before(async () => {
  await mongoose.connect(MONGO, { serverSelectionTimeoutMS: 3000 })
  await mongoose.connection.dropDatabase()
  await Promise.all([User.syncIndexes(), Notification.syncIndexes(), Ledger.syncIndexes(), RentalRequest.syncIndexes(), Rating.syncIndexes(), Download.syncIndexes()])
})
after(async () => {
  await mongoose.connection.dropDatabase()
  await mongoose.disconnect()
})
beforeEach(async () => {
  await Promise.all([
    User.deleteMany({}), Thread.deleteMany({}), Reply.deleteMany({}), Announcement.deleteMany({}), Notification.deleteMany({}),
    RentalItem.deleteMany({}), RentalRequest.deleteMany({}), Resource.deleteMany({}), Download.deleteMany({}), Rating.deleteMany({}),
    Ledger.collection.deleteMany({}),
  ])
  const base = { passwordHash: 'x', major: 'CS', year: 2 }
  lina = (await User.create({ ...base, email: 'lina.haddad@medtech.tn', firstName: 'Lina', lastName: 'Haddad', courses: ['CS324'] }))._id
  omar = (await User.create({ ...base, email: 'omar.jaziri@msb.tn', firstName: 'Omar', lastName: 'Jaziri', courses: ['CS324', 'MATH101'] }))._id
  sara = (await User.create({ ...base, email: 'sara.mejri@medtech.tn', firstName: 'Sara', lastName: 'Mejri', courses: ['MATH101'] }))._id
  nour = (await User.create({ ...base, email: 'nour.ayari@msb.tn', firstName: 'Nour', lastName: 'Ayari' }))._id
  admin = (await User.create({ ...base, email: 'student.office@medtech.tn', firstName: 'Student', lastName: 'Office', role: 'admin' }))._id
})
afterEach(() => { mock.restoreAll() })

describe('Q&A triggers', () => {
  it('notifies the asker once about a new answer, with a link to the question', async () => {
    const q = await question(lina)
    assert.equal((await as(omar).post(`/api/questions/${q}/replies`, { body: 'The middle key moves up.' })).status, 201)
    const [n, ...rest] = await mine(lina)
    assert.equal(rest.length, 0)
    assert.equal(n.kind, 'answer')
    assert.equal(n.title, 'Omar Jaziri answered your question')
    assert.equal(n.body, 'How do B-trees split?')
    assert.equal(n.link, `/qa/${q}`)
    assert.ok(n.actor?.equals(omar))
    assert.equal(await count(omar), 0)
  })

  it('does not notify you about your own answer', async () => {
    const q = await question(lina)
    assert.equal((await as(lina).post(`/api/questions/${q}/replies`, { body: 'Answering myself.' })).status, 201)
    assert.equal(await Notification.countDocuments(), 0)
  })

  it('notifies the author once when their answer is accepted', async () => {
    const q = await question(lina)
    const reply = (await as(omar).post(`/api/questions/${q}/replies`, { body: 'The middle key moves up.' })).body.reply
    assert.equal((await as(lina).post(`/api/questions/replies/${reply.id}/accept`)).status, 200)
    const accepted = await mine(omar, 'answer_accepted')
    assert.equal(accepted.length, 1)
    assert.equal(accepted[0].link, `/qa/${q}`)
    assert.equal(await count(omar), 1)
    assert.equal(await count(lina), 1) // only the answer notification
  })

  it('does not notify on upvotes', async () => {
    const q = await question(lina)
    const reply = (await as(omar).post(`/api/questions/${q}/replies`, { body: 'The middle key moves up.' })).body.reply
    await Notification.deleteMany({})
    assert.equal((await as(omar).post(`/api/questions/${q}/vote`)).status, 200)
    assert.equal((await as(lina).post(`/api/questions/replies/${reply.id}/vote`)).status, 200)
    assert.equal(await Notification.countDocuments(), 0)
  })
})

describe('Campus Voice triggers', () => {
  it('names a named replier', async () => {
    const p = await voicePost(lina)
    assert.equal((await as(omar).post(`/api/voice/${p}/replies`, { body: 'Agreed, 7am please.' })).status, 201)
    const [n, ...rest] = await mine(lina)
    assert.equal(rest.length, 0)
    assert.equal(n.kind, 'voice_reply')
    assert.equal(n.title, 'Omar Jaziri replied to your post')
    assert.equal(n.link, `/voice/${p}`)
  })

  it('never stores or reveals the author of an anonymous reply', async () => {
    const p = await voicePost(lina, true)
    assert.equal((await as(omar).post(`/api/voice/${p}/replies`, { body: 'Agreed, 7am please.', anonymous: true })).status, 201)
    const rows = await mine(lina)
    assert.equal(rows.length, 1)
    assert.equal(rows[0].title, 'Someone replied to your post')
    assert.equal(rows[0].actor, null)
    const res = await as(lina).get('/api/notifications')
    assert.equal(res.status, 200)
    assert.equal(res.body.notifications.length, 1)
    const json = JSON.stringify(res.body)
    for (const leak of [omar.toString(), 'Omar', 'Jaziri', 'omar.jaziri', '@']) assert.ok(!json.includes(leak), `notification JSON reveals ${leak}`)
    assert.ok(!('actor' in res.body.notifications[0]))
  })

  it('does not notify the author about their own anonymous reply', async () => {
    const p = await voicePost(lina, true)
    assert.equal((await as(lina).post(`/api/voice/${p}/replies`, { body: 'Bumping my own post.', anonymous: true })).status, 201)
    assert.equal(await Notification.countDocuments(), 0)
  })
})

describe('library triggers', () => {
  it('notifies the uploader once per helpful rating, and once when the file is verified', async () => {
    const r = await Resource.create({
      title: 'Databases final 2025, solved', courseCode: 'CS224', kind: 'exam', semester: 'S1', academicYear: '2025/26',
      fileName: 'final.pdf', ext: 'pdf', size: 20_000, sha256: 'a'.repeat(64), fileId: new mongoose.Types.ObjectId(), uploader: lina,
    })
    await Download.insertMany([omar, sara, nour].map((user) => ({ resource: r._id, user })))
    assert.equal((await as(omar).post(`/api/resources/${r._id}/rate`)).status, 200)
    assert.equal(await count(lina, 'resource_helpful'), 1)
    assert.equal(await count(lina, 'resource_verified'), 0)
    assert.equal((await as(sara).post(`/api/resources/${r._id}/rate`)).status, 200)
    assert.equal((await as(nour).post(`/api/resources/${r._id}/rate`)).status, 200)
    assert.equal(await count(lina, 'resource_helpful'), 3)
    const verified = await mine(lina, 'resource_verified')
    assert.equal(verified.length, 1)
    assert.equal(verified[0].actor, null)
    assert.equal(verified[0].link, `/resources/${r._id}`)
    // A rejected repeat rating notifies nobody.
    assert.equal((await as(omar).post(`/api/resources/${r._id}/rate`)).status, 409)
    assert.equal(await count(lina), 4)
  })
})

describe('rental triggers', () => {
  const ITEM = { title: 'TI-84 calculator', category: 'calculator', pricePerDay: 2, deposit: 50, condition: 'good', description: '', contact: 'lina-secret-contact' }
  const ask = (id: Id, item: string) => as(id).post(`/api/rentals/${item}/requests`, { from: Date.now(), to: Date.now() + 2 * DAY, note: '' })

  it('notifies the owner of a request, then the renters of the answer, never with the contact', async () => {
    const item = (await as(lina).post('/api/rentals', ITEM)).body.item.id
    const omarReq = (await ask(omar, item)).body.request.id
    assert.equal((await ask(sara, item)).status, 201)
    const requests = await mine(lina, 'rental_request')
    assert.equal(requests.length, 2)
    assert.deepEqual(requests.map((n) => n.title).sort(), ['Omar Jaziri asked to borrow your item', 'Sara Mejri asked to borrow your item'])
    assert.equal((await as(lina).post(`/api/rentals/requests/${omarReq}/respond`, { accept: true })).status, 200)
    assert.equal(await count(omar, 'rental_accepted'), 1)
    assert.equal(await count(omar), 1)
    // Sara's pending request was declined by the accept: she hears about it once.
    assert.equal(await count(sara, 'rental_declined'), 1)
    assert.equal(await count(sara), 1)
    for (const who of [omar, sara, lina]) {
      const res = await as(who).get('/api/notifications')
      assert.ok(!JSON.stringify(res.body).includes('lina-secret-contact'), 'a notification must not carry the contact')
      assert.ok(noEmail(res.body))
    }
  })

  it('notifies the renter of a decline, and the owner never about their own answer', async () => {
    const item = (await as(lina).post('/api/rentals', ITEM)).body.item.id
    const req = (await ask(omar, item)).body.request.id
    assert.equal((await as(lina).post(`/api/rentals/requests/${req}/respond`, { accept: false })).status, 200)
    assert.equal(await count(omar, 'rental_declined'), 1)
    assert.equal(await count(lina), 1) // the request only
  })
})

describe('announcement fan-out', () => {
  const NOTICE = { title: 'CS324 lab moved to room B12', body: 'This week only, the Thursday lab is in room B12.', courseCode: 'CS324' }

  it('reaches the followers of the course, not the author, not others', async () => {
    assert.equal((await as(lina).post('/api/announcements', NOTICE)).status, 201)
    const [n, ...rest] = await mine(omar)
    assert.equal(rest.length, 0)
    assert.equal(n.kind, 'announcement')
    assert.equal(n.title, 'New in CS324: CS324 lab moved to room B12')
    assert.equal(n.link, '/events')
    for (const other of [lina, sara, nour, admin]) assert.equal(await count(other), 0)
  })

  it('reaches everyone but the author when pinned, and nobody for a course-less notice', async () => {
    assert.equal((await as(admin).post('/api/announcements', { title: 'Library closed on Friday', body: 'The library is closed this Friday.', pinned: true })).status, 201)
    for (const u of [lina, omar, sara, nour]) assert.equal(await count(u), 1)
    assert.equal(await count(admin), 0)
    await Notification.deleteMany({})
    assert.equal((await as(lina).post('/api/announcements', { ...NOTICE, courseCode: '' })).status, 201)
    assert.equal(await Notification.countDocuments(), 0)
  })
})

describe('the notifications API', () => {
  const seed = async (user: Id, n: number, at = Date.now()) => {
    const docs = Array.from({ length: n }, (_, i) => ({ user, kind: 'answer', title: `Notification ${i + 1}`, link: '/qa', createdAt: new Date(at + i * 1000) }))
    return Notification.insertMany(docs)
  }

  it('requires a session', async () => {
    assert.equal((await request(app).get('/api/notifications')).status, 401)
    assert.equal((await request(app).post('/api/notifications/read')).status, 401)
    assert.equal((await request(app).delete(`/api/notifications/${new mongoose.Types.ObjectId()}`)).status, 401)
  })

  it(`lists only mine, newest first, at most ${LIMITS.list}, with the unread count`, async () => {
    await seed(lina, LIMITS.list + 5)
    await seed(omar, 2)
    const res = await as(lina).get('/api/notifications')
    assert.equal(res.status, 200)
    assert.equal(res.body.notifications.length, LIMITS.list)
    assert.equal(res.body.unread, LIMITS.list + 5)
    assert.equal(res.body.notifications[0].title, `Notification ${LIMITS.list + 5}`)
    assert.deepEqual(Object.keys(res.body.notifications[0]).sort(), ['createdAt', 'id', 'kind', 'link', 'read', 'title'])
    assert.ok(noEmail(res.body))
    assert.equal((await as(nour).get('/api/notifications')).body.unread, 0)
  })

  it('marks only my own as read, by id or all at once', async () => {
    const [a, b] = await seed(lina, 3)
    const [o] = await seed(omar, 1)
    const res = await as(lina).post('/api/notifications/read', { ids: [a._id.toString(), o._id.toString(), 'not-an-id'] })
    assert.equal(res.status, 200)
    assert.equal(res.body.unread, 2)
    assert.ok((await Notification.findById(a._id))!.readAt)
    assert.equal((await Notification.findById(b._id))!.readAt, null)
    assert.equal((await Notification.findById(o._id))!.readAt, null, "someone else's notification is never touched")
    // No body at all: all of mine.
    const all = await request(app).post('/api/notifications/read').set('Cookie', cookie(lina))
    assert.equal(all.status, 200)
    assert.equal(all.body.unread, 0)
    assert.equal(await Notification.countDocuments({ user: omar, readAt: null }), 1)
    const list = (await as(lina).get('/api/notifications')).body.notifications
    assert.ok(list.every((n: { read: boolean }) => n.read))
  })

  it('rejects a malformed read body', async () => {
    assert.equal((await as(lina).post('/api/notifications/read', { ids: 'all' })).status, 400)
    assert.equal((await as(lina).post('/api/notifications/read', { ids: [1, 2] })).status, 400)
    assert.equal((await as(lina).post('/api/notifications/read', { ids: Array(LIMITS.idsPerRead + 1).fill('x') })).status, 400)
  })

  it('deletes only my own', async () => {
    const [a] = await seed(lina, 1)
    const [o] = await seed(omar, 1)
    assert.equal((await as(lina).del(`/api/notifications/${o._id}`)).status, 404)
    assert.ok(await Notification.exists({ _id: o._id }))
    assert.equal((await as(lina).del('/api/notifications/not-an-id')).status, 404)
    assert.equal((await as(lina).del(`/api/notifications/${a._id}`)).status, 204)
    assert.equal(await Notification.exists({ _id: a._id }), null)
    assert.equal((await as(lina).del(`/api/notifications/${a._id}`)).status, 404)
  })
})

describe('failures', () => {
  it('a notification that cannot be saved does not fail the action', async () => {
    mock.method(console, 'error', () => {})
    mock.method(Notification, 'create', async () => { throw new Error('database down') })
    mock.method(Notification, 'insertMany', async () => { throw new Error('database down') })
    const q = await question(lina)
    const res = await as(omar).post(`/api/questions/${q}/replies`, { body: 'The middle key moves up.' })
    assert.equal(res.status, 201)
    assert.equal(await Reply.countDocuments({ thread: q }), 1)
    assert.equal((await as(lina).post('/api/announcements', { title: 'CS324 lab moved to room B12', body: 'This week only, the Thursday lab is in room B12.', courseCode: 'CS324' })).status, 201)
    assert.equal(await Announcement.countDocuments(), 1)
    mock.restoreAll()
    assert.equal(await Notification.countDocuments(), 0)
  })
})
