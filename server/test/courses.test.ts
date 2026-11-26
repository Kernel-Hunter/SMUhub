/**
 * Course catalogue API tests. Need a running MongoDB; use their own throwaway database
 * (smuhub_test_courses by default, override with MONGODB_URI_TEST_COURSES), dropped at the end.
 *   npm test
 */
import { after, before, beforeEach, describe, it } from 'node:test'
import assert from 'node:assert/strict'
import jwt from 'jsonwebtoken'
import mongoose from 'mongoose'
import request from 'supertest'
import { createApp } from '../src/app.js'
import { loadConfig } from '../src/config/env.js'
import { COURSES } from '../src/lib/courses.js'
import { SESSION_COOKIE } from '../src/lib/session.js'
import { User } from '../src/models/User.js'
import { Thread } from '../src/models/Thread.js'
import { Resource } from '../src/models/Resource.js'
import { Event } from '../src/models/Event.js'

const MONGO = process.env.MONGODB_URI_TEST_COURSES ?? 'mongodb://127.0.0.1:27017/smuhub_test_courses'
const SECRET = 'test-secret-that-is-long-enough-for-hs256-signing'
const app = createApp(loadConfig({ NODE_ENV: 'test', MONGODB_URI: MONGO, JWT_SECRET: SECRET, ALLOWED_EMAIL_DOMAINS: 'medtech.tn,msb.tn' }))
const DAY = 86_400_000

let lina = '', omar = ''
const cookie = (id: string) => `${SESSION_COOKIE}=${jwt.sign({}, SECRET, { subject: id, expiresIn: 60 })}`
const get = (path: string, id = lina) => request(app).get(path).set('Cookie', cookie(id))
type Row = { code: string; name: string; dept: string; questions: number; open: number; resources: number; events: number; students: number }
const byCode = (rows: Row[]) => new Map(rows.map((r) => [r.code, r]))

before(async () => {
  await mongoose.connect(MONGO, { serverSelectionTimeoutMS: 3000 })
  await mongoose.connection.dropDatabase()
})
after(async () => {
  await mongoose.connection.dropDatabase()
  await mongoose.disconnect()
})
beforeEach(async () => {
  await Promise.all([User.deleteMany({}), Thread.deleteMany({}), Resource.deleteMany({}), Event.deleteMany({})])
  const base = { passwordHash: 'x', major: 'CS', year: 2 }
  lina = (await User.create({ ...base, email: 'lina.haddad@medtech.tn', firstName: 'Lina', lastName: 'Haddad', courses: ['CS224', 'MATH205'] }))._id.toString()
  omar = (await User.create({ ...base, email: 'omar.jaziri@msb.tn', firstName: 'Omar', lastName: 'Jaziri', courses: ['CS224'] }))._id.toString()
})

let sha = 0
const file = (courseCode: string, uploader: string) => ({
  title: 'Lab notes', courseCode, kind: 'notes', semester: 'S1', academicYear: '2025-2026', fileName: 'notes.pdf', ext: 'pdf',
  size: 1000, sha256: `sha-${++sha}`, fileId: new mongoose.Types.ObjectId(), uploader,
})
const question = (courseCode: string, author: string, solved = false) => ({ kind: 'question', title: 'A question title', body: 'Some details here.', courseCode, author, solved })

describe('GET /api/courses', () => {
  it('requires a session', async () => {
    assert.equal((await request(app).get('/api/courses')).status, 401)
    assert.equal((await request(app).get('/api/courses/CS224')).status, 401)
  })

  it('lists every course in the catalogue, with zero counts when nothing was posted', async () => {
    const res = await get('/api/courses')
    assert.equal(res.status, 200)
    assert.deepEqual(res.body.courses.map((c: Row) => c.code), COURSES.map(([c]) => c))
    const math = byCode(res.body.courses).get('MATH101')!
    assert.deepEqual(math, { code: 'MATH101', name: 'Calculus I', dept: 'Mathematics', questions: 0, open: 0, resources: 0, events: 0, students: 0 })
  })

  it('counts questions, open questions, files, events and students per course', async () => {
    await Thread.insertMany([question('CS224', lina), question('CS224', omar, true), question('CS224', omar), question('MATH205', lina)])
    await Thread.create({ kind: 'voice', title: 'The library is too cold', body: 'Please fix the heating.', category: 'facilities', author: lina })
    await Resource.insertMany([file('CS224', lina), file('CS224', omar), file('PHY110', omar)])
    await Event.insertMany([
      { title: 'CS224 midterm', kind: 'deadline', startsAt: new Date(Date.now() + 3 * DAY), courseCode: 'CS224', author: lina },
      { title: 'Old CS224 lab', kind: 'event', startsAt: new Date(Date.now() - 10 * DAY), courseCode: 'CS224', author: lina },
      { title: 'Club night', kind: 'club', startsAt: new Date(Date.now() + DAY), author: omar },
    ])
    const rows = byCode((await get('/api/courses')).body.courses)
    assert.deepEqual(
      (({ questions, open, resources, events, students }) => ({ questions, open, resources, events, students }))(rows.get('CS224')!),
      { questions: 3, open: 2, resources: 2, events: 1, students: 2 },
    )
    assert.equal(rows.get('MATH205')!.questions, 1)
    assert.equal(rows.get('MATH205')!.students, 1)
    assert.equal(rows.get('PHY110')!.resources, 1)
    assert.equal([...rows.values()].reduce((s, r) => s + r.questions, 0), 4, 'voice posts are not questions')
  })

  it('counts past the 50 questions a list returns', async () => {
    await Thread.insertMany(Array.from({ length: 60 }, () => question('CS101', omar)))
    const rows = byCode((await get('/api/courses')).body.courses)
    assert.equal(rows.get('CS101')!.questions, 60)
  })

  it('ignores course codes that are not in the catalogue', async () => {
    await Thread.collection.insertOne({ ...question('XX999', lina), author: new mongoose.Types.ObjectId(lina) })
    const res = await get('/api/courses')
    assert.equal(res.body.courses.length, COURSES.length)
    assert.ok(!res.body.courses.some((c: Row) => c.code === 'XX999'))
  })
})

describe('GET /api/courses/:code', () => {
  it('returns one course with its counts, whatever the case of the code', async () => {
    await Thread.insertMany([question('CS224', lina), question('CS224', omar)])
    const res = await get('/api/courses/cs224', omar)
    assert.equal(res.status, 200)
    assert.equal(res.body.course.code, 'CS224')
    assert.equal(res.body.course.name, 'Database Systems')
    assert.equal(res.body.course.questions, 2)
    assert.equal(res.body.course.students, 2)
  })

  it('answers 404 for a course that does not exist', async () => {
    const res = await get('/api/courses/XX999')
    assert.equal(res.status, 404)
    assert.equal(res.body.error.code, 'not_found')
  })
})
