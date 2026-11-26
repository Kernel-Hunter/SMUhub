import { createHash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import express from 'express'
import cookieParser from 'cookie-parser'
import cors from 'cors'
import helmet from 'helmet'
import type { Config } from './config/env.js'
import { errorHandler, notFound } from './lib/errors.js'
import { requireAuth } from './middleware/requireAuth.js'
import { authRouter } from './routes/auth.js'
import { questionsRouter } from './routes/questions.js'
import { eventsRouter } from './routes/events.js'
import { announcementsRouter } from './routes/announcements.js'
import { rentalsRouter } from './routes/rentals.js'
import { meRouter } from './routes/me.js'
import { leaderboardRouter } from './routes/leaderboard.js'
import { usersRouter } from './routes/users.js'
import { voiceRouter } from './routes/voice.js'
import { resourcesRouter } from './routes/resources.js'
import { coursesRouter } from './routes/courses.js'

/** Builds the Express app without starting it, so tests can drive it with supertest. */
export function createApp(config: Config) {
  const app = express()
  app.locals.config = config
  app.disable('x-powered-by')
  if (config.trustProxy) app.set('trust proxy', config.trustProxy)

  // In production the API also serves the built web app, so both share one origin and the session cookie stays first-party.
  const web = loadWebApp(config)
  app.use(helmet(web ? { contentSecurityPolicy: { directives: { scriptSrc: ["'self'", ...web.scriptHashes] } } } : undefined))
  app.use(cors({ origin: config.clientUrl, credentials: true }))
  app.use(express.json({ limit: '10kb' }))
  app.use(cookieParser())

  app.get('/api/health', (_req, res) => { res.json({ ok: true }) })
  app.use('/api/auth', authRouter(config))
  app.use('/api/questions', requireAuth, questionsRouter())
  app.use('/api/events', requireAuth, eventsRouter())
  app.use('/api/announcements', requireAuth, announcementsRouter())
  app.use('/api/rentals', requireAuth, rentalsRouter())
  app.use('/api/me', requireAuth, meRouter())
  app.use('/api/leaderboard', requireAuth, leaderboardRouter())
  app.use('/api/users', requireAuth, usersRouter())
  app.use('/api/voice', requireAuth, voiceRouter())
  app.use('/api/courses', requireAuth, coursesRouter())
  // Multipart uploads are parsed inside this router (multer), after requireAuth: express.json's 10 kB limit does not apply to them.
  app.use('/api/resources', requireAuth, resourcesRouter())

  if (web) {
    // Vite fingerprints everything in /assets, so those files can be cached for a year.
    app.use('/assets', express.static(path.join(web.dir, 'assets'), { index: false, immutable: true, maxAge: '1y' }))
    app.use(express.static(web.dir, { index: false, maxAge: '1h' }))
    // Every other non-API path is a client-side route: answer with the app shell.
    app.get(/^\/(?!api(\/|$)).*/, (_req, res) => { res.set('Cache-Control', 'no-cache').type('html').send(web.html) })
  }

  app.use(notFound)
  app.use(errorHandler)
  return app
}

/**
 * The built web app (client/dist), when there is one to serve: CLIENT_DIST, or ../client/dist in production.
 * Returns the index.html text and the CSP hashes of its inline scripts (the theme script runs before React).
 */
function loadWebApp(config: Config) {
  const dir = config.clientDist ?? (config.env === 'production' ? fileURLToPath(new URL('../../client/dist', import.meta.url)) : undefined)
  if (!dir || !existsSync(path.join(dir, 'index.html'))) {
    if (config.env === 'production') console.warn(`No built web app at ${dir}: serving the API only. Run the root build first.`)
    return undefined
  }
  const html = readFileSync(path.join(dir, 'index.html'), 'utf8')
  const scriptHashes = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)]
    .map((m) => `'sha256-${createHash('sha256').update(m[1]).digest('base64')}'`)
  return { dir, html, scriptHashes }
}
