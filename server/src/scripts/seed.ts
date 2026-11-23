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
  await disconnectDb()
}

main().catch(async (err) => {
  console.error(err instanceof Error ? err.message : err)
  await disconnectDb().catch(() => {})
  process.exit(1)
})
