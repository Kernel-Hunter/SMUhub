/**
 * Sign-up, email verification and password reset tests. They need a running MongoDB and use their own database
 * (smuhub_test_signup by default, override with MONGODB_URI_TEST_SIGNUP), dropped at the end.
 * Codes are read from the test mailer's outbox, never from the database.
 */
import { after, before, beforeEach, describe, it } from 'node:test'
import assert from 'node:assert/strict'
import mongoose from 'mongoose'
import request from 'supertest'
import { createApp } from '../src/app.js'
import { loadConfig, type Config } from '../src/config/env.js'
import { outbox } from '../src/lib/mailer.js'
import { hashPassword } from '../src/lib/password.js'
import { SESSION_COOKIE } from '../src/lib/session.js'
import { User } from '../src/models/User.js'
import { CodeBudget, VerificationCode } from '../src/models/VerificationCode.js'
import { MAX_DAILY_FAILURES } from '../src/lib/codes.js'

const MONGO = process.env.MONGODB_URI_TEST_SIGNUP ?? 'mongodb://127.0.0.1:27017/smuhub_test_signup'
const SECRET = 'test-secret-that-is-long-enough-for-hs256-signing'
const PASSWORD = 'CorrectHorse42!'
const EMAIL = 'nour.ben.ali@medtech.tn'

const makeConfig = (over: Record<string, string> = {}): Config =>
  loadConfig({ NODE_ENV: 'test', MONGODB_URI: MONGO, JWT_SECRET: SECRET, ALLOWED_EMAIL_DOMAINS: 'smu.tn,medtech.tn,msb.tn', LOGIN_RATE_LIMIT: '1000', AUTH_RATE_LIMIT: '1000', ...over })
const app = createApp(makeConfig())

/** POST to /api/auth/<path> on the shared app, or through a given client (request(otherApp) or a cookie-keeping agent). */
const post = (path: string, body: object, client: { post(url: string): request.Test } = request(app)) => client.post(`/api/auth/${path}`).send(body)
const register = (over: object = {}) => post('register', { email: EMAIL, password: PASSWORD, firstName: 'Nour', lastName: 'Ben Ali', major: 'CS', year: 1, ...over })
const mailsTo = (email: string) => outbox.filter((m) => m.to === email)
/** The code in the latest mail to this address. */
function codeFor(email: string) {
  const mail = mailsTo(email).at(-1)
  assert.ok(mail, `no mail to ${email}`)
  const m = /\b(\d{6})\b/.exec(mail.text)
  assert.ok(m, 'mail has no code')
  return m[1]
}
const wrong = (code: string) => String((Number(code) + 1) % 1_000_000).padStart(6, '0')
const cookieOf = (res: request.Response) => ((res.headers['set-cookie'] as unknown as string[] | undefined) ?? []).find((c) => c.startsWith(`${SESSION_COOKIE}=`)) ?? ''
/** Lets the one-mail-per-minute throttle pass again, by ageing the stored code (the hash is never read). */
const ageCode = (email: string, purpose: 'signup' | 'reset') => VerificationCode.updateOne({ email, purpose }, { $set: { sentAt: new Date(Date.now() - 61_000) } })

before(async () => {
  await mongoose.connect(MONGO, { serverSelectionTimeoutMS: 3000 })
  await mongoose.connection.dropDatabase()
  await User.syncIndexes()
  await VerificationCode.syncIndexes()
})
after(async () => {
  await mongoose.connection.dropDatabase()
  await mongoose.disconnect()
})
beforeEach(async () => {
  await User.deleteMany({})
  await VerificationCode.deleteMany({})
  await CodeBudget.deleteMany({})
  outbox.length = 0
})

describe('POST /api/auth/register', () => {
  it('refuses non-SMU domains', async () => {
    for (const email of ['nour@gmail.com', 'nour@evil-medtech.tn', 'nour@sub.medtech.tn']) {
      const res = await register({ email })
      assert.equal(res.status, 403, email)
      assert.equal(res.body.error.code, 'domain_not_allowed')
    }
    assert.equal(await User.countDocuments(), 0)
    assert.equal(outbox.length, 0)
  })

  it('refuses weak passwords', async () => {
    for (const password of ['short1!', '12345678901234', 'x'.repeat(129)]) {
      const res = await register({ password })
      assert.equal(res.status, 400, password)
      assert.equal(res.body.error.code, 'weak_password')
    }
    assert.equal(await User.countDocuments(), 0)
  })

  it('validates names and input shape', async () => {
    assert.equal((await register({ firstName: '   ' })).status, 400)
    assert.equal((await register({ lastName: 'x'.repeat(51) })).status, 400)
    assert.equal((await register({ email: { $ne: '' } })).status, 400)
    assert.equal((await post('register', {})).status, 400)
  })

  it('creates an unverified account and mails a code, without leaking secrets', async () => {
    const res = await register({ email: '  Nour.Ben.Ali@MedTech.TN ', firstName: '  Nour ' })
    assert.equal(res.status, 202)
    assert.deepEqual(res.body, { pending: true })
    assert.equal(cookieOf(res), '', 'no session before verification')
    const user = await User.findOne({ email: EMAIL })
    assert.equal(user?.emailVerified, false)
    assert.equal(user?.firstName, 'Nour')
    assert.equal(mailsTo(EMAIL).length, 1)
    assert.doesNotMatch(JSON.stringify(res.body), new RegExp(codeFor(EMAIL)))
  })

  it('full sign-up: register, verify, then /me works', async () => {
    await register().expect(202)
    const agent = request.agent(app)
    const res = await post('verify', { email: EMAIL, code: codeFor(EMAIL), password: PASSWORD }, agent)
    assert.equal(res.status, 200)
    assert.equal(res.body.user.email, EMAIL)
    assert.equal(res.body.user.firstName, 'Nour')
    assert.equal(res.body.user.passwordHash, undefined)
    assert.doesNotMatch(JSON.stringify(res.body), /\$2[aby]\$|codeHash/)
    assert.match(cookieOf(res), /HttpOnly/i)

    const me = await agent.get('/api/auth/me')
    assert.equal(me.status, 200)
    assert.equal(me.body.user.email, EMAIL)
    assert.equal((await User.findOne({ email: EMAIL }))?.emailVerified, true)

    // The code is single use, and login now works.
    assert.equal((await post('verify', { email: EMAIL, code: codeFor(EMAIL), password: PASSWORD })).status, 400)
    assert.equal((await post('login', { email: EMAIL, password: PASSWORD })).status, 200)
  })

  it('answers the same 202 for an already verified email, without changing or mailing anything', async () => {
    const original = await User.create({ email: EMAIL, passwordHash: await hashPassword(PASSWORD), firstName: 'Real', lastName: 'Owner', emailVerified: true })
    const res = await register({ password: 'AttackerPass99', firstName: 'Mallory' })
    assert.equal(res.status, 202)
    assert.deepEqual(res.body, { pending: true })
    assert.equal(await User.countDocuments(), 1)
    assert.equal(await VerificationCode.countDocuments(), 0)
    assert.equal(outbox.length, 0)
    const after = await User.findById(original._id).select('+passwordHash')
    assert.equal(after?.firstName, 'Real')
    assert.equal(after?.passwordHash, original.passwordHash)
  })

  it('treats accounts created before sign-up (no emailVerified field) as verified', async () => {
    await User.create({ email: EMAIL, passwordHash: await hashPassword(PASSWORD), firstName: 'Old', lastName: 'Account' })
    assert.equal((await register()).status, 202)
    assert.equal(outbox.length, 0)
    assert.equal((await post('login', { email: EMAIL, password: PASSWORD })).status, 200)
  })

  it('re-registering an unverified email updates it and mails a new code', async () => {
    await register().expect(202)
    const first = codeFor(EMAIL)
    await ageCode(EMAIL, 'signup')
    await register({ password: 'AnotherPass77', firstName: 'Noor' }).expect(202)
    assert.equal(await User.countDocuments(), 1)
    assert.equal(mailsTo(EMAIL).length, 2)
    const second = codeFor(EMAIL)
    if (first !== second) assert.equal((await post('verify', { email: EMAIL, code: first, password: 'AnotherPass77' })).status, 400, 'old code replaced')
    assert.equal((await post('verify', { email: EMAIL, code: second, password: 'AnotherPass77' })).status, 200)
    assert.equal((await post('login', { email: EMAIL, password: 'AnotherPass77' })).body.user.firstName, 'Noor')
  })
})

describe('plus-tagged addresses', () => {
  it('refuses name+tag@ sign-ups, so one inbox cannot open many accounts', async () => {
    const res = await register({ email: 'nour.ben.ali+alt@medtech.tn' })
    assert.equal(res.status, 400)
    assert.equal(res.body.error.code, 'invalid_email')
    assert.equal(await User.countDocuments(), 0)
    assert.equal(outbox.length, 0)
  })
})

describe('POST /api/auth/verify', () => {
  it('refuses a wrong code with a generic 400', async () => {
    await register().expect(202)
    const res = await post('verify', { email: EMAIL, code: wrong(codeFor(EMAIL)), password: PASSWORD })
    assert.equal(res.status, 400)
    assert.equal(res.body.error.code, 'invalid_code')
    assert.equal(cookieOf(res), '')
    assert.equal((await post('verify', { email: EMAIL, code: 'abc', password: PASSWORD })).status, 400)
    assert.equal((await post('verify', { email: 'ghost@medtech.tn', code: '123456', password: PASSWORD })).status, 400)
  })

  it('burns the code after 5 wrong attempts', async () => {
    await register().expect(202)
    const code = codeFor(EMAIL)
    const statuses = []
    for (let i = 0; i < 5; i++) statuses.push((await post('verify', { email: EMAIL, code: wrong(code), password: PASSWORD })).status)
    assert.deepEqual(statuses, [400, 400, 400, 400, 429])
    const res = await post('verify', { email: EMAIL, code, password: PASSWORD })
    assert.equal(res.status, 429, 'even the right code is refused once burned')
    assert.equal(res.body.error.code, 'too_many_attempts')

    // A new code works again.
    await ageCode(EMAIL, 'signup')
    await post('resend', { email: EMAIL }).expect(202)
    assert.equal((await post('verify', { email: EMAIL, code: codeFor(EMAIL), password: PASSWORD })).status, 200)
  })

  it('needs the password chosen at sign-up, so re-registering an unconfirmed email cannot take it over', async () => {
    await register().expect(202)
    const code = codeFor(EMAIL)
    // Someone else re-registers the same unconfirmed email within the minute: no new mail goes out, the code stays the same.
    await register({ password: 'Intruder-Pass99' }).expect(202)
    assert.equal(mailsTo(EMAIL).length, 1)
    const refused = await post('verify', { email: EMAIL, code, password: PASSWORD })
    assert.equal(refused.status, 400)
    assert.equal(cookieOf(refused), '')
    // The intruder does not have the code from the inbox; the owner signs up again and confirms with their own password.
    assert.equal((await post('verify', { email: EMAIL, code: wrong(code), password: 'Intruder-Pass99' })).status, 400)
    await ageCode(EMAIL, 'signup')
    await register().expect(202)
    assert.equal((await post('verify', { email: EMAIL, code: codeFor(EMAIL), password: PASSWORD })).status, 200)
    assert.equal((await post('login', { email: EMAIL, password: 'Intruder-Pass99' })).status, 401)
  })

  it('refuses an expired code', async () => {
    await register().expect(202)
    await VerificationCode.updateOne({ email: EMAIL, purpose: 'signup' }, { $set: { expiresAt: new Date(Date.now() - 1000) } })
    const res = await post('verify', { email: EMAIL, code: codeFor(EMAIL), password: PASSWORD })
    assert.equal(res.status, 400)
    assert.equal(res.body.error.code, 'invalid_code')
  })
})

describe('POST /api/auth/resend', () => {
  it('always answers 202 and mails at most once per minute', async () => {
    assert.equal((await post('resend', { email: 'ghost@medtech.tn' })).status, 202)
    assert.equal(outbox.length, 0)

    await register().expect(202)
    assert.equal((await post('resend', { email: EMAIL })).status, 202)
    assert.equal(mailsTo(EMAIL).length, 1, 'throttled: the first code is still valid')
    await ageCode(EMAIL, 'signup')
    assert.equal((await post('resend', { email: EMAIL })).status, 202)
    assert.equal(mailsTo(EMAIL).length, 2)
    assert.equal((await post('verify', { email: EMAIL, code: codeFor(EMAIL), password: PASSWORD })).status, 200)

    // Verified now: nothing more is sent.
    await ageCode(EMAIL, 'signup')
    assert.equal((await post('resend', { email: EMAIL })).status, 202)
    assert.equal(mailsTo(EMAIL).length, 2)
  })
})

describe('POST /api/auth/login with an unverified account', () => {
  it('refuses with 403 email_not_verified, only after the password matches', async () => {
    await register().expect(202)
    const res = await post('login', { email: EMAIL, password: PASSWORD })
    assert.equal(res.status, 403)
    assert.equal(res.body.error.code, 'email_not_verified')
    assert.equal(cookieOf(res), '')
    const bad = await post('login', { email: EMAIL, password: 'wrong-password' })
    assert.equal(bad.status, 401)
    assert.equal(bad.body.error.code, 'invalid_credentials')
  })
})

describe('Forgot and reset password', () => {
  beforeEach(async () => {
    await User.create({ email: EMAIL, passwordHash: await hashPassword(PASSWORD), firstName: 'Nour', lastName: 'Ben Ali', emailVerified: true })
  })

  it(`stops guessing after ${MAX_DAILY_FAILURES} wrong codes in a day, even across new codes`, async () => {
    let spent = 0
    while (spent < MAX_DAILY_FAILURES) {
      await ageCode(EMAIL, 'reset')
      await post('forgot', { email: EMAIL }).expect(202)
      const code = codeFor(EMAIL)
      for (let i = 0; i < 5 && spent < MAX_DAILY_FAILURES; i++, spent++) await post('reset', { email: EMAIL, code: wrong(code), password: 'BrandNewPass2026' })
    }
    const mailed = mailsTo(EMAIL).length
    await ageCode(EMAIL, 'reset')
    await post('forgot', { email: EMAIL }).expect(202)
    assert.equal(mailsTo(EMAIL).length, mailed, 'no new code once the daily budget is spent')
    const blocked = await post('reset', { email: EMAIL, code: codeFor(EMAIL), password: 'BrandNewPass2026' })
    assert.equal(blocked.status, 429)
    assert.match(blocked.body.error.message, /today/)
    assert.equal((await post('login', { email: EMAIL, password: PASSWORD })).status, 200, 'the password did not change')

    // A day later the student can reset again.
    await CodeBudget.updateOne({ email: EMAIL, purpose: 'reset' }, { $set: { since: new Date(Date.now() - 25 * 60 * 60 * 1000) } })
    await ageCode(EMAIL, 'reset')
    await post('forgot', { email: EMAIL }).expect(202)
    assert.equal((await post('reset', { email: EMAIL, code: codeFor(EMAIL), password: 'BrandNewPass2026' })).status, 200)
  })

  it('resets the password, signs in, and ends older sessions', async () => {
    const old = request.agent(app)
    await post('login', { email: EMAIL, password: PASSWORD }, old).expect(200)
    await old.get('/api/auth/me').expect(200)

    const res = await post('forgot', { email: EMAIL })
    assert.equal(res.status, 202)
    assert.deepEqual(res.body, { pending: true })
    const code = codeFor(EMAIL)

    const fresh = request.agent(app)
    const done = await post('reset', { email: EMAIL, code, password: 'BrandNewPass2026' }, fresh)
    assert.equal(done.status, 200)
    assert.equal(done.body.user.email, EMAIL)
    assert.doesNotMatch(JSON.stringify(done.body), new RegExp(`\\$2[aby]\\$|codeHash|${code}`))
    await fresh.get('/api/auth/me').expect(200)

    assert.equal((await old.get('/api/auth/me')).status, 401, 'session from before the reset is ended')
    assert.equal((await post('login', { email: EMAIL, password: PASSWORD })).status, 401, 'old password stops working')
    assert.equal((await post('login', { email: EMAIL, password: 'BrandNewPass2026' })).status, 200)
    assert.equal((await post('reset', { email: EMAIL, code, password: 'AgainNewPass2026' })).status, 400, 'code is single use')
  })

  it('never reveals whether an account exists', async () => {
    const known = await post('forgot', { email: EMAIL })
    const unknown = await post('forgot', { email: 'ghost@medtech.tn' })
    assert.equal(unknown.status, known.status)
    assert.deepEqual(unknown.body, known.body)
    assert.equal(mailsTo('ghost@medtech.tn').length, 0)
    const reset = await post('reset', { email: 'ghost@medtech.tn', code: '123456', password: 'BrandNewPass2026' })
    assert.equal(reset.status, 400)
    assert.equal(reset.body.error.code, 'invalid_code')
  })

  it('sends no reset code to an unverified account', async () => {
    await register({ email: 'new.student@smu.tn' }).expect(202)
    outbox.length = 0
    assert.equal((await post('forgot', { email: 'new.student@smu.tn' })).status, 202)
    assert.equal(outbox.length, 0)
  })

  it('checks the password policy before using the code', async () => {
    await post('forgot', { email: EMAIL }).expect(202)
    const code = codeFor(EMAIL)
    const weak = await post('reset', { email: EMAIL, code, password: '1234567890' })
    assert.equal(weak.status, 400)
    assert.equal(weak.body.error.code, 'weak_password')
    assert.equal((await post('reset', { email: EMAIL, code, password: 'BrandNewPass2026' })).status, 200)
  })

  it('does not accept a sign-up code for a reset, and burns reset codes after 5 wrong attempts', async () => {
    await post('forgot', { email: EMAIL }).expect(202)
    const code = codeFor(EMAIL)
    for (let i = 0; i < 4; i++) assert.equal((await post('verify', { email: EMAIL, code, password: PASSWORD })).status, 400, 'reset code is not a sign-up code')
    for (let i = 0; i < 5; i++) await post('reset', { email: EMAIL, code: wrong(code), password: 'BrandNewPass2026' })
    const res = await post('reset', { email: EMAIL, code, password: 'BrandNewPass2026' })
    assert.equal(res.status, 429)
    assert.equal((await post('login', { email: EMAIL, password: PASSWORD })).status, 200, 'password unchanged')
  })
})

describe('Mail and rate limits', () => {
  it('answers 503 in production without SMTP, before looking anything up', async () => {
    const prod = createApp(makeConfig({ NODE_ENV: 'production' }))
    for (const [path, body] of [['register', { email: EMAIL, password: PASSWORD, firstName: 'Nour', lastName: 'Ben Ali' }], ['resend', { email: EMAIL }], ['forgot', { email: EMAIL }]] as const) {
      const res = await post(path, body, request(prod))
      assert.equal(res.status, 503, path)
      assert.equal(res.body.error.code, 'mail_unavailable')
    }
    assert.equal(await User.countDocuments(), 0)
  })

  it('rate limits sign-up requests per IP', async () => {
    const limited = createApp(makeConfig({ AUTH_RATE_LIMIT: '2' }))
    for (let i = 0; i < 2; i++) assert.equal((await post('forgot', { email: 'ghost@medtech.tn' }, request(limited))).status, 202)
    const res = await post('forgot', { email: 'ghost@medtech.tn' }, request(limited))
    assert.equal(res.status, 429)
    assert.equal(res.body.error.code, 'rate_limited')
  })
})
