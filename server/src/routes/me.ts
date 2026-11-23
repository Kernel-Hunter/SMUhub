import { Router } from 'express'
import { z } from 'zod'
import { HttpError } from '../lib/errors.js'
import { isCourseCode } from '../lib/courses.js'
import { WEEK, rankOf, xpOf } from '../lib/xp.js'
import { Ledger } from '../models/Ledger.js'
import { Resource } from '../models/Resource.js'
import { toClientUser, type UserDoc } from '../models/User.js'

/**
 * The signed-in student's own profile, mounted at /api/me behind requireAuth (see app.ts).
 * Same shapes as api.me in client/src/api/client.ts (Me and XpRow in client/src/api/types.ts).
 */

const oneLine = (s: string) => s.replace(/\s+/g, ' ').trim()
const block = (s: string) => s.replace(/\r/g, '').replace(/\n{3,}/g, '\n\n').trim()

// The name comes from the account and is read-only here: an unknown key like `name` is dropped, not saved.
const updateMe = z.object({
  major: z.string().max(200).transform(oneLine).pipe(z.string().max(40)).optional(),
  year: z.number().int().min(1).max(6).optional(),
  bio: z.string().max(2000).transform(block).pipe(z.string().max(240)).optional(),
  courses: z.array(z.string().trim().toUpperCase().refine(isCourseCode)).max(12).optional(),
})

/** The Me shape: public user + bio, joinedAt, role, XP (all time and last 7 days), all-time rank, uploads, courses. */
export async function meJson(u: UserDoc) {
  const [xp, weeklyXp, uploads] = await Promise.all([xpOf(u._id), xpOf(u._id, new Date(Date.now() - WEEK)), Resource.countDocuments({ uploader: u._id })])
  return {
    ...toClientUser(u), bio: u.bio ?? '', joinedAt: (u.createdAt ?? new Date()).getTime(), role: u.role ?? 'student',
    xp, weeklyXp, rank: await rankOf(xp),
    uploads,
    courses: [...(u.courses ?? [])],
  }
}

export function meRouter() {
  const router = Router()

  // GET /api/me -> { me: Me }
  router.get('/', async (req, res) => {
    res.json({ me: await meJson(req.user!) })
  })

  // PATCH /api/me { major?, year?, bio?, courses? } -> { me: Me }
  router.patch('/', async (req, res) => {
    const parsed = updateMe.safeParse(req.body)
    if (!parsed.success) {
      throw new HttpError(400, 'invalid_input', 'Profil invalide : filière (40 caractères max.), année de 1 à 6, bio (240 caractères max.) et 12 cours existants au maximum.')
    }
    const p = parsed.data
    const u = req.user!
    if (p.major) u.major = p.major // an empty major keeps the current one
    if (p.year !== undefined) u.year = p.year
    if (p.bio !== undefined) u.bio = p.bio
    if (p.courses) u.courses = [...new Set(p.courses)]
    await u.save()
    res.json({ me: await meJson(u) })
  })

  // GET /api/me/xp -> { rows: XpRow[] }, newest first, 50 max
  router.get('/xp', async (req, res) => {
    const rows = await Ledger.find({ user: req.user!._id }).sort({ createdAt: -1, _id: -1 }).limit(50)
    res.json({ rows: rows.map((l) => ({ id: l._id.toString(), points: l.points, kind: l.kind, label: l.label, at: l.createdAt.getTime() })) })
  })

  return router
}
