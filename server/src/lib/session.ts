import jwt from 'jsonwebtoken'
import type { CookieOptions, Response } from 'express'
import type { Config } from '../config/env.js'

export const SESSION_COOKIE = 'smuhub_session'

function baseCookie(config: Config): CookieOptions {
  return {
    httpOnly: true, // not readable from JavaScript, so an XSS cannot steal it
    secure: config.env === 'production', // HTTPS only in production
    sameSite: 'lax', // not sent on cross-site POSTs (basic CSRF protection)
    path: '/',
  }
}

export function startSession(res: Response, config: Config, userId: string) {
  const token = jwt.sign({}, config.jwtSecret, {
    algorithm: 'HS256',
    subject: userId,
    expiresIn: Math.floor(config.sessionMs / 1000),
  })
  res.cookie(SESSION_COOKIE, token, { ...baseCookie(config), maxAge: config.sessionMs })
}

export function endSession(res: Response, config: Config) {
  res.clearCookie(SESSION_COOKIE, baseCookie(config))
}

/** Returns the user id stored in a valid token, or null if the token is missing, expired or forged. */
export function readSession(token: unknown, config: Config): string | null {
  if (typeof token !== 'string' || token.length === 0) return null
  try {
    const payload = jwt.verify(token, config.jwtSecret, { algorithms: ['HS256'] })
    return typeof payload === 'object' && typeof payload.sub === 'string' ? payload.sub : null
  } catch {
    return null
  }
}
