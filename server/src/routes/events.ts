import { Router } from 'express'
import { isValidObjectId, type Types } from 'mongoose'
import { z } from 'zod'
import { HttpError } from '../lib/errors.js'
import { isCourseCode } from '../lib/courses.js'
import { loadPeople, personOr, type PublicPerson } from '../lib/people.js'
import { Event } from '../models/Event.js'

/**
 * Calendar API, mounted at /api/events behind requireAuth (see app.ts).
 * Same rules as the reference mock (client/src/api/mock.ts): anyone can add an event in the future,
 * at most a few upcoming ones per student, and joining is a toggle that counts each student once.
 */

const DAY = 86_400_000
export const LIMITS = { upcomingPerStudent: 5 }

const newEvent = z.object({
  title: z.string().trim().min(5).max(100),
  kind: z.enum(['event', 'deadline', 'club']),
  startsAt: z.number(),
  location: z.string().trim().max(80).default(''),
  description: z.string().trim().max(500).default(''),
  courseCode: z.string().trim().toUpperCase().optional().transform((c) => c || undefined).refine((c) => c === undefined || isCourseCode(c)),
})

const EVENT_NOT_FOUND = 'Événement introuvable.'

type Id = Types.ObjectId
type EventDoc = { _id: Id; title: string; kind: string; startsAt: Date; location?: string | null; courseCode?: string | null; description?: string | null; author: Id; goers: Id[]; going: number }

/** The client's CampusEvent shape (client/src/api/types.ts). */
function eventJson(e: EventDoc, me: Id, author: PublicPerson) {
  return {
    id: e._id.toString(), title: e.title, kind: e.kind, startsAt: e.startsAt.getTime(), location: e.location ?? '',
    courseCode: e.courseCode ?? undefined, description: e.description ?? '', author, going: e.going, iGo: e.goers.some((g) => g.equals(me)),
  }
}

export function eventsRouter() {
  const router = Router()

  // Upcoming events, soonest first (yesterday's stay visible for a day): GET /api/events
  router.get('/', async (req, res) => {
    const me = req.user!._id
    const events = await Event.find({ startsAt: { $gt: new Date(Date.now() - DAY) } }).sort({ startsAt: 1 }).limit(200)
    const people = await loadPeople(events.map((e) => e.author))
    res.json({ events: events.map((e) => eventJson(e, me, personOr(people, e.author))) })
  })

  // Add an event: POST /api/events { title, kind, startsAt, location, description, courseCode? }. The author goes by default.
  router.post('/', async (req, res) => {
    const me = req.user!._id
    const parsed = newEvent.safeParse(req.body)
    if (!parsed.success) throw new HttpError(400, 'invalid_input', 'Ajoute un titre (5 caractères min.), un type et une date valides.')
    const { startsAt, location, ...rest } = parsed.data
    const now = Date.now()
    if (startsAt < now - 3_600_000) throw new HttpError(400, 'bad_date', 'Choisis une date à venir.')
    if (startsAt > now + 365 * DAY) throw new HttpError(400, 'bad_date', 'Choisis une date dans les 12 prochains mois.')
    const upcoming = await Event.countDocuments({ author: me, startsAt: { $gt: new Date(now) } })
    if (upcoming >= LIMITS.upcomingPerStudent) throw new HttpError(429, 'rate_limited', `Tu as déjà ${LIMITS.upcomingPerStudent} événements à venir.`)
    const event = await Event.create({ ...rest, startsAt: new Date(startsAt), location: location || 'TBA', author: me, goers: [me], going: 1 })
    res.status(201).json({ event: eventJson(event, me, personOr(await loadPeople([me]), me)) })
  })

  // Join or leave: POST /api/events/:id/going. Conditional updates, so `going` always equals goers.length.
  router.post('/:id/going', async (req, res) => {
    const me = req.user!._id
    const id = req.params.id
    if (!isValidObjectId(id)) throw new HttpError(404, 'not_found', EVENT_NOT_FOUND)
    const joined = await Event.updateOne({ _id: id, goers: { $ne: me } }, { $push: { goers: me }, $inc: { going: 1 } })
    if (joined.modifiedCount === 0) {
      const left = await Event.updateOne({ _id: id, goers: me }, { $pull: { goers: me }, $inc: { going: -1 } })
      if (left.matchedCount === 0) throw new HttpError(404, 'not_found', EVENT_NOT_FOUND)
    }
    const fresh = await Event.findById(id)
    if (!fresh) throw new HttpError(404, 'not_found', EVENT_NOT_FOUND)
    res.json({ event: eventJson(fresh, me, personOr(await loadPeople([fresh.author]), fresh.author)) })
  })

  return router
}
