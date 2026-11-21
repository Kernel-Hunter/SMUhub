import { Router } from 'express'
import { rateLimit } from 'express-rate-limit'
import { z } from 'zod'
import type { Config } from '../config/env.js'
import { HttpError } from '../lib/errors.js'
import { isAllowedDomain, isEmail, normalizeEmail } from '../lib/email.js'
import { burnPasswordCheck, verifyPassword } from '../lib/password.js'
import { endSession, startSession } from '../lib/session.js'
import { requireAuth } from '../middleware/requireAuth.js'
import { User, toPublicUser } from '../models/User.js'

const loginBody = z.object({
  email: z.string().trim().min(1).max(254),
  password: z.string().min(1).max(128),
})

const BAD_CREDENTIALS = 'Email ou mot de passe incorrect.'

export function authRouter(config: Config) {
  const router = Router()

  // Counts failed attempts only, per IP: 10 failures per 15 minutes by default (LOGIN_RATE_LIMIT).
  const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: config.loginRateLimit,
    skipSuccessfulRequests: true,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    handler: (_req, res) => {
      res.status(429).json({ error: { code: 'rate_limited', message: 'Trop de tentatives de connexion. Réessaie dans 15 minutes.' } })
    },
  })

  router.post('/login', loginLimiter, async (req, res) => {
    const parsed = loginBody.safeParse(req.body)
    if (!parsed.success) throw new HttpError(400, 'invalid_input', 'Email et mot de passe sont obligatoires.')
    const email = normalizeEmail(parsed.data.email)
    const { password } = parsed.data

    if (!isEmail(email)) throw new HttpError(400, 'invalid_email', 'Adresse email invalide.')
    if (!isAllowedDomain(email, config.allowedDomains)) {
      throw new HttpError(403, 'domain_not_allowed', `SMUhub est réservé aux étudiants SMU. Utilise ton adresse ${config.allowedDomains.map((d) => '@' + d).join(', ')}.`)
    }

    const user = await User.findOne({ email }).select('+passwordHash')
    if (!user) {
      await burnPasswordCheck(password)
      throw new HttpError(401, 'invalid_credentials', BAD_CREDENTIALS)
    }
    if (!(await verifyPassword(password, user.passwordHash))) throw new HttpError(401, 'invalid_credentials', BAD_CREDENTIALS)

    startSession(res, config, user._id.toString())
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
