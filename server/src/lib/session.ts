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

/** tokenVersion: the user's current tokenVersion, so a later password reset can end this session. */
export function startSession(res: Response, config: Config, userId: string, tokenVersion = 0) {
  const token = jwt.sign({ tv: tokenVersion }, config.jwtSecret, {
    algorithm: 'HS256',
    subject: userId,
    expiresIn: Math.floor(config.sessionMs / 1000),
  })
  res.cookie(SESSION_COOKIE, token, { ...baseCookie(config), maxAge: config.sessionMs })
}

export function endSession(res: Response, config: Config) {
  res.clearCookie(SESSION_COOKIE, baseCookie(config))
}

/**
 * Returns the user id and token version stored in a valid token, or null if the token is missing, expired or forged.
 * Tokens without a "tv" claim (issued before it existed) count as version 0.
 */
export function readSession(token: unknown, config: Config): { userId: string; tokenVersion: number } | null {
  if (typeof token !== 'string' || token.length === 0) return null
  try {
    const payload = jwt.verify(token, config.jwtSecret, { algorithms: ['HS256'] })
    if (typeof payload !== 'object' || typeof payload.sub !== 'string') return null
    return { userId: payload.sub, tokenVersion: typeof payload.tv === 'number' ? payload.tv : 0 }
  } catch {
    return null
  }
}
