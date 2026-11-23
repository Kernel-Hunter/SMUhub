/**
 * Adds test students so login can be tried before sign-up (US-01) exists.
 * Safe to run several times: users are matched by email (unique index) and updated in place,
 * so no duplicates are created; their password is reset to SEED_PASSWORD from server/.env.
 *   npm run seed
 */
import 'dotenv/config'
import { loadConfig } from '../config/env.js'
import { connectDb, disconnectDb } from '../db.js'
import { User } from '../models/User.js'
import { hashPassword } from '../lib/password.js'
import { isAllowedDomain } from '../lib/email.js'
import { Thread } from '../models/Thread.js'
import { Reply } from '../models/Reply.js'
import { Event } from '../models/Event.js'
import { RentalItem, RentalRequest } from '../models/Rental.js'

/** Reads the test password from SEED_PASSWORD (server/.env). Never hard-coded in the repo. */
function seedPassword(): string {
  const value = process.env.SEED_PASSWORD?.trim()
  if (!value) throw new Error('SEED_PASSWORD is missing: add it to server/.env (see .env.example)')
  if (value.length < 8 || value.length > 128) throw new Error('SEED_PASSWORD must be 8 to 128 characters long')
  return value
}

const TEST_STUDENTS = [
  { email: 'yasmine.trabelsi@medtech.tn', firstName: 'Yasmine', lastName: 'Trabelsi', major: 'Software Engineering', year: 3 },
  { email: 'ahmed.benali@msb.tn', firstName: 'Ahmed', lastName: 'Ben Ali', major: 'Business Analytics', year: 2 },
]

const Y = 'yasmine.trabelsi@medtech.tn', A = 'ahmed.benali@msb.tn'
const HOUR = 3_600_000

/** Demo Q&A so the Questions page is not empty on a fresh database. Matched by title, so re-running resets them. */
const DEMO_QUESTIONS = [
  {
    author: Y, courseCode: 'CS224', hoursAgo: 30, solved: true,
    title: 'When should I use a LEFT JOIN instead of an INNER JOIN?',
    body: 'In lab 4 both return the same rows for me, but the correction uses LEFT JOIN. What is the actual difference?',
    replies: [{ author: A, accepted: true, hoursAgo: 28, body: 'INNER JOIN keeps only rows that match on both sides. LEFT JOIN keeps every row of the left table and fills the right side with NULL when nothing matches. You get the same result in lab 4 because every student has at least one enrolment. Add a student with no enrolment and you will see the difference.' }],
  },
  {
    author: A, courseCode: 'MATH210', hoursAgo: 20, solved: false,
    title: 'How do I know if two events are independent?',
    body: 'Exercise 3 of the series asks if A and B are independent. I computed P(A and B) but I am not sure what to compare it with.',
    replies: [{ author: Y, accepted: false, hoursAgo: 18, body: 'Compare it with P(A) × P(B). If they are equal, the events are independent. Careful: independent is not the same as mutually exclusive.' }],
  },
  {
    author: Y, courseCode: 'CS324', hoursAgo: 5, solved: false,
    title: 'Is it fine to store the JWT in localStorage for the project?',
    body: 'The tutorial stores it in localStorage but someone said it is unsafe. What should we do for the CS324 project?',
    replies: [],
  },
]

/** Demo calendar, always upcoming: dates are recomputed from today on every run. Matched by title. */
const DEMO_EVENTS = [
  { author: Y, title: 'CS324 project proposal deadline', kind: 'deadline' as const, inDays: 3, hour: 23, location: 'Moodle', courseCode: 'CS324', description: 'Submit the PDF proposal on Moodle before midnight. One file per team.' },
  { author: A, title: 'Hackathon kickoff: 24 hours of building', kind: 'event' as const, inDays: 6, hour: 17, location: 'Block C · Innovation Lab', description: 'Teams of 3 to 4. Pizza is on the house, prizes for the top three projects.' },
  { author: Y, title: 'Calculus I midterm', kind: 'deadline' as const, inDays: 9, hour: 9, location: 'Amphi A', courseCode: 'MATH101', description: 'Chapters 1 to 4. Bring your student card.' },
  { author: A, title: 'Finance club: build your first budget', kind: 'club' as const, inDays: 4, hour: 16, location: 'Student Center, room 2', description: 'Open session, no experience needed. Bring a laptop if you have one.' },
]

/** Demo rental items. Matched by title; re-running resets them to available and clears their requests. Contacts are fake. */
const DEMO_RENTALS = [
  { owner: Y, title: 'Casio fx-991EX Classwiz', category: 'calculator' as const, pricePerDay: 2, deposit: 20, condition: 'good' as const, description: 'Exam-approved scientific calculator. Fresh batteries.', contact: 'Telegram @yasmine_demo' },
  { owner: Y, title: 'Introduction to Algorithms (CLRS), 4th ed.', category: 'books' as const, pricePerDay: 3, deposit: 50, condition: 'worn' as const, description: 'Highlighted but readable. Pick up at the library.', contact: 'Telegram @yasmine_demo' },
  { owner: A, title: 'Lab coat (size M)', category: 'lab' as const, pricePerDay: 1, deposit: 10, condition: 'good' as const, description: 'Required for the Physics and Chemistry labs. Washed after every loan.', contact: 'Instagram @ahmed.demo' },
  { owner: A, title: 'Arduino Uno starter kit', category: 'tech' as const, pricePerDay: 5, deposit: 40, condition: 'good' as const, description: 'Board, breadboard, 40 jumpers, LEDs and a few sensors.', contact: 'Instagram @ahmed.demo' },
]

async function main() {
  const config = loadConfig()
  const password = seedPassword()
  await connectDb(config.mongoUri)
  await User.syncIndexes() // makes sure the unique index on email exists
  const passwordHash = await hashPassword(password)
  for (const s of TEST_STUDENTS) {
    if (!isAllowedDomain(s.email, config.allowedDomains)) {
      console.warn(`! ${s.email} is not in ALLOWED_EMAIL_DOMAINS, it will be refused at login`)
    }
    const res = await User.updateOne({ email: s.email }, { $set: { ...s, passwordHash } }, { upsert: true })
    console.log(`${res.upsertedCount ? '+ created' : '✓ updated'} ${s.email}`)
  }
  console.log(`Seeded ${TEST_STUDENTS.length} students. Password for all: the SEED_PASSWORD value in server/.env`)

  const ids = new Map((await User.find({ email: { $in: [Y, A] } })).map((u) => [u.email, u._id]))
  for (const q of DEMO_QUESTIONS) {
    const author = ids.get(q.author)!
    const other = ids.get(q.author === Y ? A : Y)!
    const at = new Date(Date.now() - q.hoursAgo * HOUR)
    const existing = await Thread.findOne({ kind: 'question', title: q.title })
    if (existing) await Reply.deleteMany({ thread: existing._id })
    // The other student upvotes it, so nobody votes on their own post.
    const fields = { kind: 'question' as const, title: q.title, body: q.body, courseCode: q.courseCode, author, voters: [other], votes: 1, replyCount: q.replies.length, solved: q.solved, createdAt: at }
    const thread = existing
      ? await Thread.findByIdAndUpdate(existing._id, fields, { new: true, timestamps: false })
      : await Thread.create(fields)
    for (const r of q.replies) {
      await Reply.create({ thread: thread!._id, body: r.body, author: ids.get(r.author)!, accepted: r.accepted, createdAt: new Date(Date.now() - r.hoursAgo * HOUR) })
    }
  }
  console.log(`Seeded ${DEMO_QUESTIONS.length} demo questions.`)

  for (const e of DEMO_EVENTS) {
    const startsAt = new Date(Date.now() + e.inDays * 24 * HOUR)
    startsAt.setHours(e.hour, 0, 0, 0)
    const author = ids.get(e.author)!
    // The author goes, like when an event is created from the page; the other student can join it.
    await Event.updateOne({ title: e.title }, { $set: { title: e.title, kind: e.kind, startsAt, location: e.location, courseCode: e.courseCode, description: e.description, author, goers: [author], going: 1 } }, { upsert: true })
  }
  console.log(`Seeded ${DEMO_EVENTS.length} demo events.`)

  for (const r of DEMO_RENTALS) {
    const { owner, ...fields } = r
    const existing = await RentalItem.findOne({ title: r.title })
    if (existing) await RentalRequest.deleteMany({ item: existing._id })
    await RentalItem.updateOne({ title: r.title }, { $set: { ...fields, owner: ids.get(owner)!, available: true } }, { upsert: true })
  }
  console.log(`Seeded ${DEMO_RENTALS.length} demo rental items.`)
  await disconnectDb()
}

main().catch(async (err) => {
  console.error(err instanceof Error ? err.message : err)
  await disconnectDb().catch(() => {})
  process.exit(1)
})
