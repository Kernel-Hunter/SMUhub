import { Router } from 'express'
import type { Types } from 'mongoose'
import { z } from 'zod'
import { HttpError } from '../lib/errors.js'
import { WEEK, standings } from '../lib/xp.js'
import { User, toClientUser } from '../models/User.js'
import { Resource } from '../models/Resource.js'

/** Leaderboard, mounted at /api/leaderboard behind requireAuth (see app.ts). Built from the XP ledger only. */

const query = z.object({ period: z.enum(['week', 'all']).default('week') })

export function leaderboardRouter() {
  const router = Router()

  // GET /api/leaderboard?period=week|all -> { rows: LeaderRow[] }, top 50 by XP over the period
  router.get('/', async (req, res) => {
    const parsed = query.safeParse(req.query)
    if (!parsed.success) throw new HttpError(400, 'invalid_input', 'Période invalide : week ou all.')
    const me = req.user!._id
    const since = parsed.data.period === 'week' ? new Date(Date.now() - WEEK) : undefined
    const top = await standings(since, 50)
    const users = new Map((await User.find({ _id: { $in: top.map((r) => r._id) } })).map((u) => [u._id.toString(), u]))
    const uploads = new Map((await Resource.aggregate<{ _id: Types.ObjectId; n: number }>([{ $match: { uploader: { $in: top.map((r) => r._id) } } }, { $group: { _id: '$uploader', n: { $sum: 1 } } }])).map((c) => [c._id.toString(), c.n]))
    const rows: { user: ReturnType<typeof toClientUser>; xp: number; rank: number; uploads: number; isMe: boolean }[] = []
    for (const r of top) {
      const u = users.get(r._id.toString())
      if (!u) continue
      // Same XP, same rank (like rankOf in lib/xp.ts, so /api/me and the board agree).
      const prev = rows[rows.length - 1]
      const rank = prev && prev.xp === r.xp ? prev.rank : rows.length + 1
      rows.push({ user: toClientUser(u), xp: r.xp, rank, uploads: uploads.get(r._id.toString()) ?? 0, isMe: r._id.equals(me) })
    }
    res.json({ rows })
  })

  return router
}
