import { Router } from 'express'
import { isValidObjectId, type Types } from 'mongoose'
import { z } from 'zod'
import { HttpError } from '../lib/errors.js'
import { isCourseCode } from '../lib/courses.js'
import { loadPeople, personOr, type PublicPerson } from '../lib/people.js'
import { Announcement } from '../models/Announcement.js'

/**
 * Announcements API, mounted at /api/announcements behind requireAuth (see app.ts).
 * Any signed-in student can post a short notice, at most 3 per 24 hours. Only an admin can pin one.
 * The author or an admin can delete it. Expired notices are hidden. Posting earns no XP.
 */

const DAY = 86_400_000
export const LIMITS = { perDay: 3, feed: 50 }

const newAnnouncement = z.object({
  title: z.string().trim().min(5).max(120),
  body: z.string().trim().min(10).max(2000),
  courseCode: z.string().trim().toUpperCase().optional().transform((c) => c || undefined).refine((c) => c === undefined || isCourseCode(c)),
  pinned: z.boolean().default(false),
  expiresAt: z.number().int().nullable().optional(),
})
const INPUT_ERRORS: Record<string, string> = {
  title: 'Add a title between 5 and 120 characters.',
  body: 'Write a message between 10 and 2000 characters.',
  courseCode: 'Pick a valid course, or leave it empty.',
}

const NOT_FOUND = 'Announcement not found.'

type Id = Types.ObjectId
type AnnouncementDoc = { _id: Id; title: string; body: string; courseCode?: string | null; author: Id; pinned?: boolean | null; createdAt: Date; expiresAt?: Date | null }

/** The client's Announcement shape (client/src/api/types.ts). */
function announcementJson(a: AnnouncementDoc, me: Id, author: PublicPerson) {
  return {
    id: a._id.toString(), title: a.title, body: a.body, courseCode: a.courseCode ?? undefined, author, pinned: !!a.pinned,
    createdAt: a.createdAt.getTime(), expiresAt: a.expiresAt?.getTime(), mine: a.author.equals(me),
  }
}

export function announcementsRouter() {
  const router = Router()

  // The feed: GET /api/announcements?course=CS324. Pinned first, then newest. Expired ones are hidden.
  router.get('/', async (req, res) => {
    const me = req.user!._id
    const filter: Record<string, unknown> = { $or: [{ expiresAt: null }, { expiresAt: { $gt: new Date() } }] }
    const { course } = req.query
    if (typeof course === 'string' && course.trim()) {
      const code = course.trim().toUpperCase()
      if (!isCourseCode(code)) throw new HttpError(400, 'bad_course', 'Unknown course.')
      filter.courseCode = code
    }
    const list = await Announcement.find(filter).sort({ pinned: -1, createdAt: -1 }).limit(LIMITS.feed)
    const people = await loadPeople(list.map((a) => a.author))
    res.json({ announcements: list.map((a) => announcementJson(a, me, personOr(people, a.author))) })
  })

  // Post: POST /api/announcements { title, body, courseCode?, expiresAt?, pinned? }
  router.post('/', async (req, res) => {
    const user = req.user!
    const parsed = newAnnouncement.safeParse(req.body)
    if (!parsed.success) {
      const field = String(parsed.error.issues[0]?.path[0] ?? '')
      throw new HttpError(400, 'invalid_input', INPUT_ERRORS[field] ?? 'Add a title and a message.')
    }
    const { expiresAt, pinned, ...rest } = parsed.data
    if (pinned && user.role !== 'admin') throw new HttpError(403, 'forbidden', 'Only admins can pin announcements.')
    const now = Date.now()
    if (expiresAt != null && expiresAt <= now) throw new HttpError(400, 'bad_date', 'Pick an end date in the future.')
    if (expiresAt != null && expiresAt > now + 365 * DAY) throw new HttpError(400, 'bad_date', 'Pick an end date within the next 12 months.')
    const recent = await Announcement.countDocuments({ author: user._id, createdAt: { $gte: new Date(now - DAY) } })
    if (recent >= LIMITS.perDay) throw new HttpError(429, 'rate_limited', `You can post ${LIMITS.perDay} announcements per day. Try again tomorrow.`)
    const a = await Announcement.create({ ...rest, pinned, expiresAt: expiresAt == null ? undefined : new Date(expiresAt), author: user._id })
    res.status(201).json({ announcement: announcementJson(a, user._id, personOr(await loadPeople([user._id]), user._id)) })
  })

  // Delete: DELETE /api/announcements/:id -> 204. The author or an admin.
  router.delete('/:id', async (req, res) => {
    const user = req.user!
    const id = req.params.id
    if (!isValidObjectId(id)) throw new HttpError(404, 'not_found', NOT_FOUND)
    const a = await Announcement.findById(id)
    if (!a) throw new HttpError(404, 'not_found', NOT_FOUND)
    if (!a.author.equals(user._id) && user.role !== 'admin') throw new HttpError(403, 'forbidden', 'You can only delete your own announcements.')
    await Announcement.deleteOne({ _id: a._id })
    res.status(204).end()
  })

  return router
}
