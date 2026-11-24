/**
 * Auth API tests. They need a running MongoDB and use a separate database (smuhub_test by default),
 * which is dropped at the end. Override with MONGODB_URI_TEST.
 *   npm test
 */
import { after, before, beforeEach, describe, it } from 'node:test'
import assert from 'node:assert/strict'
import cookieParser from 'cookie-parser'
import express from 'express'
import jwt from 'jsonwebtoken'
import mongoose from 'mongoose'
import request from 'supertest'
import { createApp } from '../src/app.js'
import { loadConfig, type Config } from '../src/config/env.js'
import { errorHandler } from '../src/lib/errors.js'
import { hashPassword } from '../src/lib/password.js'
import { SESSION_COOKIE } from '../src/lib/session.js'
import { requireAuth } from '../src/middleware/requireAuth.js'
import { User } from '../src/models/User.js'

const MONGO = process.env.MONGODB_URI_TEST ?? 'mongodb://127.0.0.1:27017/smuhub_test'
const SECRET = 'test-secret-that-is-long-enough-for-hs256-signing'
const PASSWORD = 'CorrectHorse42!'

const makeConfig = (over: Record<string, string> = {}): Config =>
  loadConfig({ NODE_ENV: 'test', MONGODB_URI: MONGO, JWT_SECRET: SECRET, ALLOWED_EMAIL_DOMAINS: 'smu.tn, medtech.tn,msb.tn', CLIENT_URL: 'http://localhost:5173', ...over })

// High limit for the shared app: many tests fail logins on purpose. The rate-limit test builds its own app.
const config = makeConfig({ LOGIN_RATE_LIMIT: '1000' })
const app = createApp(config)
let userId = ''

const login = (email: string, password: string, target = app) => request(target).post('/api/auth/login').send({ email, password })
const cookieOf = (res: request.Response) => {
  const raw = res.headers['set-cookie'] as unknown as string[] | undefined
  return (raw ?? []).find((c) => c.startsWith(`${SESSION_COOKIE}=`)) ?? ''
}
const tokenFor = (sub: string, opts: jwt.SignOptions = {}, secret = SECRET) => jwt.sign({}, secret, { subject: sub, expiresIn: 60, ...opts })

before(async () => {
  await mongoose.connect(MONGO, { serverSelectionTimeoutMS: 3000 })
  await mongoose.connection.dropDatabase()
  await User.syncIndexes()
})
after(async () => {
  await mongoose.connection.dropDatabase()
  await mongoose.disconnect()
})
beforeEach(async () => {
  await User.deleteMany({})
  const u = await User.create({ email: 'lina.haddad@medtech.tn', passwordHash: await hashPassword(PASSWORD), firstName: 'Lina', lastName: 'Haddad', major: 'CS', year: 2 })
  userId = u._id.toString()
})

describe('POST /api/auth/login', () => {
  it('logs in with valid credentials and sets a secure session cookie', async () => {
    const res = await login('lina.haddad@medtech.tn', PASSWORD)
    assert.equal(res.status, 200)
    assert.equal(res.body.user.email, 'lina.haddad@medtech.tn')
    assert.equal(res.body.user.id, userId)
    const cookie = cookieOf(res)
    assert.match(cookie, /HttpOnly/i)
    assert.match(cookie, /SameSite=Lax/i)
    assert.match(cookie, /Max-Age=\d+/i)
    assert.doesNotMatch(cookie, /Secure/i, 'no Secure flag outside production (plain http in dev)')
  })

  it('never returns the password hash', async () => {
    const res = await login('lina.haddad@medtech.tn', PASSWORD)
    assert.equal(res.body.user.passwordHash, undefined)
    assert.doesNotMatch(JSON.stringify(res.body), /\$2[aby]\$/)
  })

  it('accepts the email in any case and with surrounding spaces', async () => {
    const res = await login('  Lina.HADDAD@MedTech.TN ', PASSWORD)
    assert.equal(res.status, 200)
  })

  it('refuses a wrong password with a generic message', async () => {
    const res = await login('lina.haddad@medtech.tn', 'wrong-password')
    assert.equal(res.status, 401)
    assert.equal(res.body.error.code, 'invalid_credentials')
    assert.equal(cookieOf(res), '')
  })

  it('gives the same answer for an unknown email (no account enumeration)', async () => {
    const wrongPw = await login('lina.haddad@medtech.tn', 'wrong-password')
    const unknown = await login('ghost@medtech.tn', 'wrong-password')
    assert.equal(unknown.status, wrongPw.status)
    assert.deepEqual(unknown.body, wrongPw.body)
  })

  it('refuses non-SMU domains with 403', async () => {
    for (const email of ['someone@gmail.com', 'lina@evil-medtech.tn', 'lina@medtech.tn.evil.com', 'lina@sub.medtech.tn']) {
      const res = await login(email, PASSWORD)
      assert.equal(res.status, 403, email)
      assert.equal(res.body.error.code, 'domain_not_allowed')
    }
  })

  it('validates the input', async () => {
    assert.equal((await request(app).post('/api/auth/login').send({})).status, 400)
    assert.equal((await login('not-an-email', PASSWORD)).status, 400)
    assert.equal((await request(app).post('/api/auth/login').send({ email: ['x'], password: { $ne: '' } })).status, 400)
    assert.equal((await request(app).post('/api/auth/login').set('Content-Type', 'application/json').send('{bad')).status, 400)
  })

  it('rate limits repeated failed attempts', async () => {
    const limited = createApp(makeConfig({ LOGIN_RATE_LIMIT: '3' }))
    for (let i = 0; i < 3; i++) assert.equal((await login('lina.haddad@medtech.tn', 'nope', limited)).status, 401)
    const res = await login('lina.haddad@medtech.tn', PASSWORD, limited)
    assert.equal(res.status, 429)
    assert.equal(res.body.error.code, 'rate_limited')
  })

  it('sets the Secure flag in production', async () => {
    const prod = createApp(makeConfig({ NODE_ENV: 'production' }))
    const res = await login('lina.haddad@medtech.tn', PASSWORD, prod)
    assert.match(cookieOf(res), /;\s*Secure/i)
  })
})

describe('GET /api/auth/me and requireAuth', () => {
  it('returns 401 without a cookie', async () => {
    const res = await request(app).get('/api/auth/me')
    assert.equal(res.status, 401)
    assert.equal(res.body.error.code, 'unauthenticated')
  })

  it('returns the current student with a valid session', async () => {
    const agent = request.agent(app)
    await agent.post('/api/auth/login').send({ email: 'lina.haddad@medtech.tn', password: PASSWORD }).expect(200)
    const res = await agent.get('/api/auth/me')
    assert.equal(res.status, 200)
    assert.equal(res.body.user.firstName, 'Lina')
    assert.equal(res.body.user.passwordHash, undefined)
  })

  it('rejects forged, foreign-signed and expired tokens', async () => {
    const bad = ['garbage', tokenFor(userId, {}, 'another-secret-that-is-also-long-enough!!'), tokenFor(userId, { expiresIn: -10 }), tokenFor('not-an-object-id')]
    for (const t of bad) {
      const res = await request(app).get('/api/auth/me').set('Cookie', `${SESSION_COOKIE}=${t}`)
      assert.equal(res.status, 401, t)
    }
  })

  it('rejects the token of a deleted user', async () => {
    const t = tokenFor(userId)
    await User.deleteOne({ _id: userId })
    assert.equal((await request(app).get('/api/auth/me').set('Cookie', `${SESSION_COOKIE}=${t}`)).status, 401)
  })

  it('re-checks the email domain on every request', async () => {
    const outsider = await User.create({ email: 'old.student@gmail.com', passwordHash: 'x', firstName: 'Old', lastName: 'Student' })
    const res = await request(app).get('/api/auth/me').set('Cookie', `${SESSION_COOKIE}=${tokenFor(outsider._id.toString())}`)
    assert.equal(res.status, 401)

    // Removing a domain from the config locks out its users even with a valid token.
    const strict = createApp(makeConfig({ ALLOWED_EMAIL_DOMAINS: 'smu.tn' }))
    assert.equal((await request(strict).get('/api/auth/me').set('Cookie', `${SESSION_COOKIE}=${tokenFor(userId)}`)).status, 401)
  })

  it('can protect any other route', async () => {
    // Same wiring a future router gets inside createApp: config in app.locals, cookies parsed, JSON errors.
    const custom = express()
    custom.locals.config = config
    custom.use(cookieParser())
    custom.get('/api/protected', requireAuth, (req, res) => { res.json({ hello: req.user!.firstName }) })
    custom.use(errorHandler)

    assert.equal((await request(custom).get('/api/protected')).status, 401)
    const ok = await request(custom).get('/api/protected').set('Cookie', `${SESSION_COOKIE}=${tokenFor(userId)}`)
    assert.equal(ok.status, 200)
    assert.equal(ok.body.hello, 'Lina')
  })
})

describe('POST /api/auth/logout', () => {
  it('clears the cookie so /me returns 401 afterwards', async () => {
    const agent = request.agent(app)
    await agent.post('/api/auth/login').send({ email: 'lina.haddad@medtech.tn', password: PASSWORD }).expect(200)
    await agent.get('/api/auth/me').expect(200)
    const out = await agent.post('/api/auth/logout')
    assert.equal(out.status, 204)
    assert.match(cookieOf(out), /Expires=Thu, 01 Jan 1970/)
    assert.equal((await agent.get('/api/auth/me')).status, 401)
  })

  it('works even without a session', async () => {
    assert.equal((await request(app).post('/api/auth/logout')).status, 204)
  })
})
