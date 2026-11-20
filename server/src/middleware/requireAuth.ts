import { isValidObjectId } from 'mongoose'
import type { RequestHandler, Response } from 'express'
import type { Config } from '../config/env.js'
import { HttpError } from '../lib/errors.js'
import { isAllowedDomain } from '../lib/email.js'
import { SESSION_COOKIE, endSession, readSession } from '../lib/session.js'
import { User, type UserDoc } from '../models/User.js'

declare global {
  namespace Express {
    interface Request {
      /** Set by requireAuth. Always defined inside a protected route. */
      user?: UserDoc
    }
  }
}

/**
 * Protects a route: put it before any handler that needs a signed-in SMU student.
 *   router.get('/resources', requireAuth, handler)
 *   router.use(requireAuth)            // every route of this router
 * Responds 401 when the cookie is missing, invalid or expired, when the user no longer exists,
 * or when the user's email domain is no longer allowed. On success, req.user is the student.
 */
export const requireAuth: RequestHandler = async (req, res, next) => {
  const config = req.app.locals.config as Config
  const userId = readSession(req.cookies?.[SESSION_COOKIE], config)
  if (!userId || !isValidObjectId(userId)) return next(unauthenticated(res, config, !!req.cookies?.[SESSION_COOKIE]))

  const user = await User.findById(userId)
  // Re-check the domain on every request: removing a domain from ALLOWED_EMAIL_DOMAINS locks those users out at once.
  if (!user || !isAllowedDomain(user.email, config.allowedDomains)) return next(unauthenticated(res, config, true))

  req.user = user
  next()
}

function unauthenticated(res: Response, config: Config, clear: boolean) {
  if (clear) endSession(res, config)
  return new HttpError(401, 'unauthenticated', 'Connecte-toi pour continuer.')
}
