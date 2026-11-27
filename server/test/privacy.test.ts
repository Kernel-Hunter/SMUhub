/**
 * No list endpoint gives away a student's email. With only three allowed domains, the part before the @ is the email,
 * so it must not appear either. Need a running MongoDB; use their own throwaway database
 * (smuhub_test_privacy by default, override with MONGODB_URI_TEST_PRIVACY), dropped at the end.
 *   npm test
 */
import { after, before, describe, it } from 'node:test'
import assert from 'node:assert/strict'
import jwt from 'jsonwebtoken'
import mongoose, { type Types } from 'mongoose'
import request from 'supertest'
import { createApp } from '../src/app.js'
import { loadConfig } from '../src/config/env.js'
import { SESSION_COOKIE } from '../src/lib/session.js'
import { Ledger } from '../src/models/Ledger.js'
import { User } from '../src/models/User.js'
import { makePdf } from '../src/scripts/sampleFiles.js'
import { dropTestDb } from './db.js'

const MONGO = process.env.MONGODB_URI_TEST_PRIVACY ?? 'mongodb://127.0.0.1:27017/smuhub_test_privacy'
const SECRET = 'test-secret-that-is-long-enough-for-hs256-signing'
const app = createApp(loadConfig({ NODE_ENV: 'test', MONGODB_URI: MONGO, JWT_SECRET: SECRET, ALLOWED_EMAIL_DOMAINS: 'medtech.tn,msb.tn' }))

// The local part cannot be guessed from her name, so finding it in a response means the email leaked.
const LOCAL = 'lh2291'
let lina: Types.ObjectId, omar: Types.ObjectId
const cookie = (id: Types.ObjectId) => `${SESSION_COOKIE}=${jwt.sign({}, SECRET, { subject: id.toString(), expiresIn: 60 })}`
const get = (id: Types.ObjectId, path: string) => request(app).get(path).set('Cookie', cookie(id))
const post = (id: Types.ObjectId, path: string, body: object) => request(app).post(path).set('Cookie', cookie(id)).send(body)

before(async () => {
  await mongoose.connect(MONGO, { serverSelectionTimeoutMS: 3000 })
  await mongoose.connection.dropDatabase()
  const base = { passwordHash: 'x', major: 'CS', year: 2 }
  lina = (await User.create({ ...base, email: `${LOCAL}@medtech.tn`, firstName: 'Lina', lastName: 'Haddad', courses: ['CS224'] }))._id
  omar = (await User.create({ ...base, email: 'oj4410@msb.tn', firstName: 'Omar', lastName: 'Jaziri' }))._id
})
after(dropTestDb)

describe('emails in responses', () => {
  it('never sends a student\'s email or the part before the @', async () => {
    const q = await post(lina, '/api/questions', { title: 'What does a LEFT JOIN return?', body: 'Lab 4 uses it and I do not see the difference.', courseCode: 'CS224' })
    assert.equal(q.status, 201)
    assert.equal((await post(lina, `/api/questions/${q.body.thread.id}/replies`, { body: 'Answering my own question.' })).status, 201)
    const v = await post(lina, '/api/voice', { title: 'The library closes too early', body: 'Exam season is when we need it most.', category: 'facilities' })
    assert.equal(v.status, 201)
    assert.equal((await post(lina, '/api/events', { title: 'CS224 study group', kind: 'event', startsAt: Date.now() + 86_400_000, courseCode: 'CS224' })).status, 201)
    assert.equal((await post(lina, '/api/rentals', { title: 'Casio fx-991EX', category: 'calculator', pricePerDay: 2, deposit: 20, condition: 'good', contact: 'Room 12' })).status, 201)
    assert.equal((await post(lina, '/api/announcements', { title: 'CS224 lab moved', body: 'This week the lab is in room B12.', courseCode: 'CS224' })).status, 201)
    const file = await request(app).post('/api/resources').set('Cookie', cookie(lina))
      .field('title', 'Databases final, solved').field('courseCode', 'CS224').field('kind', 'exam').field('semester', 'S1').field('academicYear', '2025/26')
      .attach('file', makePdf(['Privacy test file', 'SMUhub']), 'final.pdf')
    assert.equal(file.status, 201)
    await Ledger.create({ user: lina, actor: omar, kind: 'answer_upvoted', points: 2, refKey: 'privacy:1', label: 'Answer upvoted' })

    const paths = [
      '/api/questions', `/api/questions/${q.body.thread.id}`, '/api/voice', `/api/voice/${v.body.thread.id}`, '/api/events', '/api/rentals',
      '/api/announcements', '/api/resources', `/api/resources/${file.body.resource.id}`, '/api/leaderboard?period=all', '/api/leaderboard?period=week',
      `/api/users/${lina}`,
    ]
    for (const path of paths) {
      const res = await get(omar, path)
      assert.equal(res.status, 200, path)
      assert.ok(res.text.includes('Lina Haddad'), `${path} shows the author`)
      assert.ok(!res.text.toLowerCase().includes(LOCAL), `${path} leaks the email local part`)
      assert.ok(!res.text.includes('@medtech.tn'), `${path} leaks the email`)
    }
    // Her own view never needed it either.
    assert.ok(!(await get(lina, '/api/me')).text.toLowerCase().includes(LOCAL))
  })
})
