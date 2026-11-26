import { Router } from 'express'
import { HttpError } from '../lib/errors.js'
import { COURSES, COURSE_CODES } from '../lib/courses.js'
import { Event } from '../models/Event.js'
import { Resource } from '../models/Resource.js'
import { Thread } from '../models/Thread.js'
import { User } from '../models/User.js'

/**
 * Course catalogue with live counts, mounted at /api/courses behind requireAuth (see app.ts).
 * One aggregate per collection, so the counts stay right however many questions and files there are.
 */

const DAY = 86_400_000

type Counts = Map<string, number>
const tally = (rows: { _id: string; n: number }[]): Counts => new Map(rows.map((r) => [r._id, r.n]))

/** Questions, open questions, files, events still on the calendar and students following, per course code. */
async function countAll(codes: readonly string[]) {
  const course = { $in: codes }
  const [questions, open, resources, events, students] = await Promise.all([
    Thread.aggregate([{ $match: { kind: 'question', courseCode: course } }, { $group: { _id: '$courseCode', n: { $sum: 1 } } }]),
    Thread.aggregate([{ $match: { kind: 'question', solved: false, courseCode: course } }, { $group: { _id: '$courseCode', n: { $sum: 1 } } }]),
    Resource.aggregate([{ $match: { courseCode: course } }, { $group: { _id: '$courseCode', n: { $sum: 1 } } }]),
    // Same window as GET /api/events: upcoming, plus yesterday's for one more day.
    Event.aggregate([{ $match: { courseCode: course, startsAt: { $gt: new Date(Date.now() - DAY) } } }, { $group: { _id: '$courseCode', n: { $sum: 1 } } }]),
    User.aggregate([{ $match: { courses: course } }, { $unwind: '$courses' }, { $match: { courses: course } }, { $group: { _id: '$courses', n: { $sum: 1 } } }]),
  ])
  return { questions: tally(questions), open: tally(open), resources: tally(resources), events: tally(events), students: tally(students) }
}

/** The client's Course shape (client/src/api/types.ts). */
function courseJson([code, name, dept]: readonly [string, string, string], c: Awaited<ReturnType<typeof countAll>>) {
  const n = (m: Counts) => m.get(code) ?? 0
  return { code, name, dept, questions: n(c.questions), open: n(c.open), resources: n(c.resources), events: n(c.events), students: n(c.students) }
}

export function coursesRouter() {
  const router = Router()

  // Every course in the catalogue, with its counts: GET /api/courses
  router.get('/', async (_req, res) => {
    const counts = await countAll(COURSE_CODES)
    res.json({ courses: COURSES.map((c) => courseJson(c, counts)) })
  })

  // One course: GET /api/courses/:code (case-insensitive)
  router.get('/:code', async (req, res) => {
    const code = req.params.code.trim().toUpperCase()
    const course = COURSES.find(([c]) => c === code)
    if (!course) throw new HttpError(404, 'not_found', 'Course not found.')
    res.json({ course: courseJson(course, await countAll([code])) })
  })

  return router
}
