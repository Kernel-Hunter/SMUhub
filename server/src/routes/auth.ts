import { Router } from 'express'
import { ipKeyGenerator, rateLimit } from 'express-rate-limit'
import { z } from 'zod'
import type { Config } from '../config/env.js'
import { HttpError } from '../lib/errors.js'
import { isAllowedDomain, isEmail, normalizeEmail } from '../lib/email.js'
import { checkCode, issueCode } from '../lib/codes.js'
import { createMailer } from '../lib/mailer.js'
import { PASSWORD_MAX, burnPasswordCheck, checkPasswordPolicy, hashPassword, verifyPassword } from '../lib/password.js'
import { endSession, startSession } from '../lib/session.js'
import { requireAuth } from '../middleware/requireAuth.js'
import { User, toPublicUser } from '../models/User.js'
import type { CodePurpose } from '../models/VerificationCode.js'

const loginBody = z.object({
  email: z.string().trim().min(1).max(254),
  password: z.string().min(1).max(128),
})

const BAD_CREDENTIALS = 'Wrong email or password.'

const emailField = z.string().trim().min(1).max(254)
const nameField = z.string().trim().min(1).max(50)
// Any string up to the max here: the policy (checkPasswordPolicy) gives the precise message.
const newPasswordField = z.string().max(PASSWORD_MAX * 2)
const codeField = z.string().trim().regex(/^\d{6}$/)

const registerBody = z.object({
  email: emailField,
  password: newPasswordField,
  firstName: nameField,
  lastName: nameField,
  major: z.string().trim().max(60).optional(),
  year: z.coerce.number().int().min(1).max(6).optional(),
})
const emailBody = z.object({ email: emailField })
const verifyBody = z.object({ email: emailField, code: codeField, password: z.string().min(1).max(PASSWORD_MAX) })
const resetBody = z.object({ email: emailField, code: codeField, password: newPasswordField })

const PENDING = { pending: true }

export function authRouter(config: Config) {
  const router = Router()

  // Failed sign-ins only. Per IP and email: LOGIN_RATE_LIMIT failures per 15 minutes (10 by default), so one student
  // typing a wrong password behind the campus network does not lock out everyone sharing that IP. Per IP alone, a
  // ceiling ten times higher still stops one machine from trying many accounts.
  const tooManyLogins = (_req: unknown, res: { status(n: number): { json(b: unknown): void } }) => {
    res.status(429).json({ error: { code: 'rate_limited', message: 'Too many sign-in attempts. Try again in 15 minutes.' } })
  }
  const loginKey = (req: { ip?: string; body?: { email?: unknown } }) =>
    `${ipKeyGenerator(req.ip ?? '')}|${typeof req.body?.email === 'string' ? normalizeEmail(req.body.email).slice(0, 254) : ''}`
  const loginPerAccount = rateLimit({
    windowMs: 15 * 60 * 1000, limit: config.loginRateLimit, skipSuccessfulRequests: true, keyGenerator: loginKey,
    standardHeaders: 'draft-8', legacyHeaders: false, handler: tooManyLogins,
  })
  const loginPerIp = rateLimit({
    windowMs: 15 * 60 * 1000, limit: config.loginRateLimit * 10, skipSuccessfulRequests: true,
    standardHeaders: false, legacyHeaders: false, handler: tooManyLogins,
  })

  // Sign-up and password reset (US-01). Mail-sending routes count every request; code checks count failures only.
  const mailer = createMailer(config)
  const authLimiter = (skipSuccessfulRequests: boolean) => rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: config.authRateLimit,
    skipSuccessfulRequests,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    handler: (_req, res) => {
      res.status(429).json({ error: { code: 'rate_limited', message: 'Too many requests. Try again in 15 minutes.' } })
    },
  })
  const mailLimiter = authLimiter(false)
  const codeLimiter = authLimiter(true)

  /** Normalised SMU email, or a 400/403 like login. */
  const smuEmail = (raw: string) => {
    const email = normalizeEmail(raw)
    if (!isEmail(email)) throw new HttpError(400, 'invalid_email', 'Enter a valid email address.')
    if (!isAllowedDomain(email, config.allowedDomains)) {
      throw new HttpError(403, 'domain_not_allowed', `SMUhub is only for SMU students. Use your SMU address (${config.allowedDomains.map((d) => '@' + d).join(', ')}).`)
    }
    // name+anything@smu.tn reaches the same inbox on most mail servers: one student could open many accounts and
    // vote for themselves. Only the plain address can sign up.
    if (email.split('@')[0].includes('+')) throw new HttpError(400, 'invalid_email', 'Use your plain SMU address, without a + tag.')
    return email
  }
  const requireMailer = () => {
    if (!mailer.available) throw new HttpError(503, 'mail_unavailable', 'Email sending is not set up yet. Try again later.')
  }
  const weakPassword = (password: string) => {
    const problem = checkPasswordPolicy(password)
    if (problem) throw new HttpError(400, 'weak_password', problem)
  }
  /** Mails a fresh code unless one went out less than a minute ago. Sent after the response, so timing reveals nothing. */
  const sendCode = async (email: string, purpose: CodePurpose) => {
    const code = await issueCode(config.jwtSecret, email, purpose)
    if (!code) return
    mailer.sendCode(email, purpose, code).catch((err) => console.error(`[mail] could not send the ${purpose} code to ${email}:`, err))
  }
  const codeError = (result: 'invalid' | 'locked' | 'blocked') =>
    result === 'blocked'
      ? new HttpError(429, 'too_many_attempts', 'Too many wrong codes for this email today. Try again tomorrow.')
      : result === 'locked'
        ? new HttpError(429, 'too_many_attempts', 'Too many wrong codes. Ask for a new code.')
        : new HttpError(400, 'invalid_code', 'Wrong or expired code.')

  // 202 { pending } in every case: a verified account with this email gets no mail and is left untouched,
  // so the answer never tells whether the address is already registered.
  router.post('/register', mailLimiter, async (req, res) => {
    const parsed = registerBody.safeParse(req.body)
    if (!parsed.success) throw new HttpError(400, 'invalid_input', 'Email, password, first name and last name are required (50 characters max).')
    const { password, firstName, lastName, major, year } = parsed.data
    const email = smuEmail(parsed.data.email)
    weakPassword(password)
    requireMailer()

    const passwordHash = await hashPassword(password) // on every path, so timing does not reveal existing accounts
    const existing = await User.findOne({ email })
    if (existing && existing.emailVerified !== false) {
      res.status(202).json(PENDING)
      return
    }
    const fields = { passwordHash, firstName, lastName, ...(major !== undefined && { major }), ...(year !== undefined && { year }) }
    if (existing) {
      existing.set(fields)
      await existing.save()
    } else {
      try {
        await User.create({ email, emailVerified: false, ...fields })
      } catch (err) {
        // Two sign-ups for the same email at once: the other one won, answer the same way.
        if ((err as { code?: number }).code !== 11000) throw err
        res.status(202).json(PENDING)
        return
      }
    }
    await sendCode(email, 'signup')
    res.status(202).json(PENDING)
  })

  router.post('/verify', codeLimiter, async (req, res) => {
    const parsed = verifyBody.safeParse(req.body)
    if (!parsed.success) throw new HttpError(400, 'invalid_code', 'Wrong or expired code.')
    const email = smuEmail(parsed.data.email)

    // The code alone is not enough: re-registering an unconfirmed email replaces its password, so whoever confirms
    // must also know the password that is on the account now. Otherwise a stranger could re-register, wait for the
    // owner to type the mailed code, and keep an account carrying the stranger's password.
    const pending = await User.findOne({ email, emailVerified: false }).select('+passwordHash')
    if (!pending) {
      await burnPasswordCheck(parsed.data.password)
      throw new HttpError(400, 'invalid_code', 'Wrong code or password.')
    }
    if (!(await verifyPassword(parsed.data.password, pending.passwordHash))) throw new HttpError(400, 'invalid_code', 'Wrong code or password.')
    const result = await checkCode(config.jwtSecret, email, 'signup', parsed.data.code)
    if (result !== 'ok') throw codeError(result)
    const user = await User.findOneAndUpdate({ _id: pending._id, passwordHash: pending.passwordHash }, { $set: { emailVerified: true } }, { returnDocument: 'after' })
    if (!user) throw new HttpError(400, 'invalid_code', 'Wrong code or password.')

    startSession(res, config, user._id.toString(), user.tokenVersion ?? 0)
    res.json({ user: toPublicUser(user) })
  })

  // Always 202. Mails a new sign-up code only to an account still waiting for verification.
  router.post('/resend', mailLimiter, async (req, res) => {
    const parsed = emailBody.safeParse(req.body)
    if (!parsed.success) throw new HttpError(400, 'invalid_email', 'Enter a valid email address.')
    const email = smuEmail(parsed.data.email)
    requireMailer()

    const user = await User.findOne({ email })
    if (user && user.emailVerified === false) await sendCode(email, 'signup')
    res.status(202).json(PENDING)
  })

  // Always 202, whether or not the account exists. Only verified accounts get a reset code.
  router.post('/forgot', mailLimiter, async (req, res) => {
    const parsed = emailBody.safeParse(req.body)
    if (!parsed.success) throw new HttpError(400, 'invalid_email', 'Enter a valid email address.')
    const email = smuEmail(parsed.data.email)
    requireMailer()

    const user = await User.findOne({ email })
    if (user && user.emailVerified !== false) await sendCode(email, 'reset')
    res.status(202).json(PENDING)
  })

  // Sets the new password, ends every other session (tokenVersion + 1) and signs the student in.
  router.post('/reset', codeLimiter, async (req, res) => {
    const parsed = resetBody.safeParse(req.body)
    if (!parsed.success) throw new HttpError(400, 'invalid_input', 'Email, code and new password are required.')
    const email = smuEmail(parsed.data.email)
    weakPassword(parsed.data.password) // before the code check, so a weak password does not use up the code

    const result = await checkCode(config.jwtSecret, email, 'reset', parsed.data.code)
    if (result !== 'ok') throw codeError(result)
    const passwordHash = await hashPassword(parsed.data.password)
    const user = await User.findOneAndUpdate({ email }, { $set: { passwordHash }, $inc: { tokenVersion: 1 } }, { returnDocument: 'after' })
    if (!user) throw new HttpError(400, 'invalid_code', 'Wrong or expired code.')

    startSession(res, config, user._id.toString(), user.tokenVersion ?? 0)
    res.json({ user: toPublicUser(user) })
  })

  router.post('/login', loginPerIp, loginPerAccount, async (req, res) => {
    const parsed = loginBody.safeParse(req.body)
    if (!parsed.success) throw new HttpError(400, 'invalid_input', 'Email and password are required.')
    const email = normalizeEmail(parsed.data.email)
    const { password } = parsed.data

    if (!isEmail(email)) throw new HttpError(400, 'invalid_email', 'Enter a valid email address.')
    if (!isAllowedDomain(email, config.allowedDomains)) {
      throw new HttpError(403, 'domain_not_allowed', `SMUhub is only for SMU students. Use your SMU address (${config.allowedDomains.map((d) => '@' + d).join(', ')}).`)
    }

    const user = await User.findOne({ email }).select('+passwordHash')
    if (!user) {
      await burnPasswordCheck(password)
      throw new HttpError(401, 'invalid_credentials', BAD_CREDENTIALS)
    }
    if (!(await verifyPassword(password, user.passwordHash))) throw new HttpError(401, 'invalid_credentials', BAD_CREDENTIALS)
    // Only after the password check, so this answer does not reveal which emails have an account.
    if (user.emailVerified === false) throw new HttpError(403, 'email_not_verified', 'Confirm your email address with the code we sent you, then sign in.')

    startSession(res, config, user._id.toString(), user.tokenVersion ?? 0)
    res.json({ user: toPublicUser(user) })
  })

  // No requireAuth: logging out must always work, even with an expired cookie.
  router.post('/logout', (_req, res) => {
    endSession(res, config)
    res.status(204).end()
  })

  router.get('/me', requireAuth, (req, res) => {
    res.json({ user: toPublicUser(req.user!) })
  })

  return router
}
