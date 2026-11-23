import express from 'express'
import cookieParser from 'cookie-parser'
import cors from 'cors'
import helmet from 'helmet'
import type { Config } from './config/env.js'
import { errorHandler, notFound } from './lib/errors.js'
import { requireAuth } from './middleware/requireAuth.js'
import { authRouter } from './routes/auth.js'
import { questionsRouter } from './routes/questions.js'
import { meRouter } from './routes/me.js'
import { leaderboardRouter } from './routes/leaderboard.js'
import { usersRouter } from './routes/users.js'

/** Builds the Express app without starting it, so tests can drive it with supertest. */
export function createApp(config: Config) {
  const app = express()
  app.locals.config = config
  app.disable('x-powered-by')

  app.use(helmet())
  app.use(cors({ origin: config.clientUrl, credentials: true }))
  app.use(express.json({ limit: '10kb' }))
  app.use(cookieParser())

  app.get('/api/health', (_req, res) => { res.json({ ok: true }) })
  app.use('/api/auth', authRouter(config))
  app.use('/api/questions', requireAuth, questionsRouter())
  app.use('/api/me', requireAuth, meRouter())
  app.use('/api/leaderboard', requireAuth, leaderboardRouter())
  app.use('/api/users', requireAuth, usersRouter())
  // Future protected routers: app.use('/api/resources', requireAuth, resourcesRouter(config))

  app.use(notFound)
  app.use(errorHandler)
  return app
}
