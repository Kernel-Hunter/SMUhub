/**
 * Adds test students so login can be tried before sign-up (US-01) exists.
 * Safe to run several times: users are matched by email (unique index) and updated in place,
 * so no duplicates are created; their password is reset to SEED_PASSWORD from server/.env.
 * The demo Q&A and Campus Voice posts also pay XP through award() (real ledger rows, same rules as the app), so the leaderboard
 * is not empty. Their refKeys are stable, so re-running the seed never pays twice.
 * Demo library files (small PDFs and PNGs built in code) go to GridFS like real uploads; each is downloaded and rated
 * helpful by the other student, paid through award() as well. They are matched by SHA-256, so re-running adds nothing.
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
import { Announcement } from '../models/Announcement.js'
import { RentalItem, RentalRequest } from '../models/Rental.js'
import { XP_RULES, award } from '../lib/xp.js'
import { Ledger } from '../models/Ledger.js'
import { Download, Rating, Resource } from '../models/Resource.js'
import { checkFile, safeFileName, saveFile, sha256 } from '../lib/files.js'
import { makePdf, makePng } from './sampleFiles.js'

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
    author: Y, courseCode: 'CS224', hoursAgo: 240, solved: true, // older than a week: shows on the all-time board only
    title: 'When should I use a LEFT JOIN instead of an INNER JOIN?',
    body: 'In lab 4 both return the same rows for me, but the correction uses LEFT JOIN. What is the actual difference?',
    replies: [{ author: A, accepted: true, hoursAgo: 236, body: 'INNER JOIN keeps only rows that match on both sides. LEFT JOIN keeps every row of the left table and fills the right side with NULL when nothing matches. You get the same result in lab 4 because every student has at least one enrolment. Add a student with no enrolment and you will see the difference.' }],
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

/**
 * Demo Campus Voice posts, two per student (the pair cap allows 3 paying upvotes a week, one is already used by a question).
 * Matched by title, so re-running resets them. Anonymous ones never show on a profile.
 */
const DEMO_VOICE = [
  {
    author: Y, category: 'facilities' as const, anonymous: false, hoursAgo: 30,
    title: 'The library closes at 6pm during exam weeks',
    body: 'Exam season is exactly when we need study space the most. Could the library stay open until 10pm for the two weeks of finals?',
    replies: [{ author: A, anonymous: false, hoursAgo: 28, body: 'Agreed. Block C is full by 5pm and there is nowhere else quiet to go.' }],
  },
  {
    author: A, category: 'academics' as const, anonymous: true, hoursAgo: 50,
    title: 'Midterm grades are still not published after five weeks',
    body: 'Several courses, same story. We cannot adjust how we study without feedback. Please set a maximum turnaround for grading.',
    replies: [{ author: Y, anonymous: true, hoursAgo: 45, body: 'Same in my program. A two-week rule would already change a lot.' }],
  },
  {
    author: A, category: 'idea' as const, anonymous: false, hoursAgo: 12,
    title: 'Idea: a shared booking board for quiet rooms',
    body: 'A simple sign-up sheet per hour, run by students. The rooms exist, we only lack coordination during exam weeks.',
    replies: [],
  },
  {
    author: Y, category: 'campus-life' as const, anonymous: true, hoursAgo: 3,
    title: 'Cafeteria prices went up again this semester',
    body: 'A sandwich now costs more than the daily bus fare. Is there a student discount we do not know about?',
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

/**
 * Demo announcements: short notices, not calendar entries. Matched by title; dates are recomputed from today on every run.
 * Posted more than a day ago, so they do not use up the daily limit (3 per student): both students can still post right after seeding.
 */
const DEMO_ANNOUNCEMENTS = [
  { author: Y, title: 'CS324 lab moved to room B12 this Thursday', courseCode: 'CS324', hoursAgo: 30, expiresInDays: 4,
    body: 'The usual lab room is booked for an exam, so this week we meet in B12 on the first floor. Same time, bring your laptop.' },
  { author: A, title: 'Finance club is recruiting a treasurer', hoursAgo: 50, expiresInDays: 14,
    body: 'We are looking for one student to keep the club budget and receipts in order. About two hours a week. Message me if you are interested.' },
  { author: Y, title: 'Library closes at 2pm on Friday', hoursAgo: 70, expiresInDays: 6,
    body: 'The library closes early on Friday for maintenance. Borrowed books can still be returned in the box at the entrance.' },
]

/** Demo rental items. Matched by title; re-running resets them to available and clears their requests. Contacts are fake. */
const DEMO_RENTALS = [
  { owner: Y, title: 'Casio fx-991EX Classwiz', category: 'calculator' as const, pricePerDay: 2, deposit: 20, condition: 'good' as const, description: 'Exam-approved scientific calculator. Fresh batteries.', contact: 'Telegram @yasmine_demo' },
  { owner: Y, title: 'Introduction to Algorithms (CLRS), 4th ed.', category: 'books' as const, pricePerDay: 3, deposit: 50, condition: 'worn' as const, description: 'Highlighted but readable. Pick up at the library.', contact: 'Telegram @yasmine_demo' },
  { owner: A, title: 'Lab coat (size M)', category: 'lab' as const, pricePerDay: 1, deposit: 10, condition: 'good' as const, description: 'Required for the Physics and Chemistry labs. Washed after every loan.', contact: 'Instagram @ahmed.demo' },
  { owner: A, title: 'Arduino Uno starter kit', category: 'tech' as const, pricePerDay: 5, deposit: 40, condition: 'good' as const, description: 'Board, breadboard, 40 jumpers, LEDs and a few sensors.', contact: 'Instagram @ahmed.demo' },
]

/**
 * Demo library files, two per student, rated by the other one. Dated more than a week ago so their ratings do not use up
 * the weekly pair cap (3 paid interactions): Yasmine and Ahmed can still rate each other's new uploads right after seeding.
 */
const DEMO_RESOURCES = [
  { uploader: Y, hoursAgo: 260, name: 'Databases final 2025 solved.pdf', title: 'Databases final 2025, solved', courseCode: 'CS224', kind: 'exam' as const, semester: 'S1' as const,
    description: "Last year's final with a worked solution: SQL joins, normalization and a B-tree question.",
    file: () => makePdf(['Databases final 2025, solved', 'CS224 - SMUhub demo file', '1. Write the LEFT JOIN that lists every student and their enrolments.', '2. Normalize the Orders table to 3NF.', '3. Insert 12 into the given B-tree of order 3.']) },
  { uploader: Y, hoursAgo: 210, name: 'Normal forms cheat sheet.png', title: 'Normal forms cheat sheet (1NF to BCNF)', courseCode: 'CS224', kind: 'summary' as const, semester: 'S1' as const,
    description: 'One picture to remember what each normal form forbids.',
    file: () => makePng([47, 111, 159], 'SMUhub demo file: normal forms cheat sheet (1NF, 2NF, 3NF, BCNF).') },
  { uploader: A, hoursAgo: 230, name: 'Probability formula sheet.pdf', title: 'Probability formula sheet', courseCode: 'MATH210', kind: 'summary' as const, semester: 'S2' as const,
    description: 'Bayes, independence, expectation and variance on one page.',
    file: () => makePdf(['Probability formula sheet', 'MATH210 - SMUhub demo file', 'P(A and B) = P(A) x P(B) when A and B are independent.', 'Bayes: P(A|B) = P(B|A) P(A) / P(B)', 'Var(X) = E[X^2] - E[X]^2']) },
  { uploader: A, hoursAgo: 190, name: 'Marketing mix diagram.png', title: 'Marketing mix (4P) diagram', courseCode: 'MKT201', kind: 'slides' as const, semester: 'S2' as const,
    description: 'Product, price, place, promotion: the slide from week 2, redrawn.',
    file: () => makePng([107, 143, 94], 'SMUhub demo file: the marketing mix, product, price, place and promotion.') },
]

async function main() {
  const config = loadConfig()
  const password = seedPassword()
  await connectDb(config.mongoUri)
  await User.syncIndexes() // makes sure the unique index on email exists
  await Ledger.syncIndexes() // unique refKey: one event pays once
  const passwordHash = await hashPassword(password)
  for (const s of TEST_STUDENTS) {
    if (!isAllowedDomain(s.email, config.allowedDomains)) {
      console.warn(`! ${s.email} is not in ALLOWED_EMAIL_DOMAINS, it will be refused at login`)
    }
    const res = await User.updateOne({ email: s.email }, { $set: { ...s, passwordHash, emailVerified: true } }, { upsert: true })
    console.log(`${res.upsertedCount ? '+ created' : '✓ updated'} ${s.email}`)
  }
  console.log(`Seeded ${TEST_STUDENTS.length} students. Password for all: the SEED_PASSWORD value in server/.env`)

  const ids = new Map((await User.find({ email: { $in: [Y, A] } })).map((u) => [u.email, u._id]))
  let xp = 0
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
    // XP for what the seed just wrote: the other student's upvote, and the accepted answer.
    // Keyed on the thread id (stable across runs); replies are recreated each run, so their ids are not used.
    const tid = thread!._id
    xp += await award({ user: author, actor: other, kind: 'question_upvoted', points: XP_RULES.points.questionUp, refKey: `tv:${other}:${tid}`, label: 'Question upvoted', at: new Date(at.getTime() + HOUR) })
    const accepted = q.replies.find((r) => r.accepted)
    if (accepted) {
      xp += await award({ user: ids.get(accepted.author)!, actor: author, kind: 'answer_accepted', points: XP_RULES.points.accepted, refKey: `accept:${tid}`, label: `Answer accepted: ${q.title}`, at: new Date(Date.now() - (accepted.hoursAgo - 1) * HOUR) })
    }
  }
  console.log(`Seeded ${DEMO_QUESTIONS.length} demo questions (${xp} XP newly awarded).`)

  xp = 0
  for (const v of DEMO_VOICE) {
    const author = ids.get(v.author)!
    const other = ids.get(v.author === Y ? A : Y)!
    const at = new Date(Date.now() - v.hoursAgo * HOUR)
    const existing = await Thread.findOne({ kind: 'voice', title: v.title })
    if (existing) await Reply.deleteMany({ thread: existing._id })
    // The other student upvotes it, so nobody votes on their own post.
    const fields = { kind: 'voice' as const, title: v.title, body: v.body, category: v.category, anonymous: v.anonymous, author, voters: [other], votes: 1, replyCount: v.replies.length, solved: false, createdAt: at }
    const thread = existing
      ? await Thread.findByIdAndUpdate(existing._id, fields, { new: true, timestamps: false })
      : await Thread.create(fields)
    for (const r of v.replies) {
      await Reply.create({ thread: thread!._id, body: r.body, author: ids.get(r.author)!, anonymous: r.anonymous, createdAt: new Date(Date.now() - r.hoursAgo * HOUR) })
    }
    // Same refKey as a vote from the page (routes/voice.ts), keyed on the stable thread id.
    if (!v.anonymous) xp += await award({ user: author, actor: other, kind: 'voice_upvoted', points: XP_RULES.points.voiceUp, refKey: `tv:${other}:${thread!._id}`, label: 'Post upvoted', at: new Date(at.getTime() + HOUR) })
  }
  console.log(`Seeded ${DEMO_VOICE.length} Campus Voice posts (${xp} XP newly awarded).`)

  for (const e of DEMO_EVENTS) {
    const startsAt = new Date(Date.now() + e.inDays * 24 * HOUR)
    startsAt.setHours(e.hour, 0, 0, 0)
    const author = ids.get(e.author)!
    // The author goes, like when an event is created from the page; the other student can join it.
    await Event.updateOne({ title: e.title }, { $set: { title: e.title, kind: e.kind, startsAt, location: e.location, courseCode: e.courseCode, description: e.description, author, goers: [author], going: 1 } }, { upsert: true })
  }
  console.log(`Seeded ${DEMO_EVENTS.length} demo events.`)

  for (const a of DEMO_ANNOUNCEMENTS) {
    const { author, hoursAgo, expiresInDays, ...fields } = a
    const expiresAt = new Date(Date.now() + expiresInDays * 24 * HOUR)
    await Announcement.updateOne({ title: a.title }, { $set: { ...fields, author: ids.get(author)!, pinned: false, expiresAt } }, { upsert: true })
    // Mongoose keeps createdAt immutable, so the backdate goes through the raw collection.
    await Announcement.collection.updateOne({ title: a.title }, { $set: { createdAt: new Date(Date.now() - hoursAgo * HOUR) } })
  }
  console.log(`Seeded ${DEMO_ANNOUNCEMENTS.length} demo announcements.`)

  for (const r of DEMO_RENTALS) {
    const { owner, ...fields } = r
    const existing = await RentalItem.findOne({ title: r.title })
    if (existing) await RentalRequest.deleteMany({ item: existing._id })
    await RentalItem.updateOne({ title: r.title }, { $set: { ...fields, owner: ids.get(owner)!, available: true } }, { upsert: true })
  }
  console.log(`Seeded ${DEMO_RENTALS.length} demo rental items.`)

  await Promise.all([Resource.syncIndexes(), Download.syncIndexes(), Rating.syncIndexes()])
  let fileXp = 0
  for (const d of DEMO_RESOURCES) {
    const buf = d.file()
    const check = checkFile(buf, d.name)
    if (!check.ok) throw new Error(`Demo file ${d.name} is invalid: ${check.error}`)
    const uploader = ids.get(d.uploader)!, other = ids.get(d.uploader === Y ? A : Y)!
    const hash = sha256(buf)
    const at = new Date(Date.now() - d.hoursAgo * HOUR)
    let r = await Resource.findOne({ sha256: hash })
    if (!r) {
      const fileName = safeFileName(d.name, check.ext, d.title)
      const fileId = await saveFile(buf, fileName, { uploader, sha256: hash })
      r = await Resource.create({ title: d.title, description: d.description, courseCode: d.courseCode, kind: d.kind, semester: d.semester, academicYear: '2025/26', fileName, ext: check.ext, size: buf.length, sha256: hash, fileId, uploader, createdAt: at })
    }
    // The other student downloads it and rates it helpful. Counters are recomputed from the records, so re-runs stay exact.
    await Download.updateOne({ resource: r._id, user: other }, { $setOnInsert: { createdAt: new Date(at.getTime() + HOUR) } }, { upsert: true })
    await Rating.updateOne({ resource: r._id, user: other }, { $setOnInsert: { createdAt: new Date(at.getTime() + 2 * HOUR) } }, { upsert: true })
    const [downloads, helpful] = await Promise.all([Download.countDocuments({ resource: r._id, user: { $ne: r.uploader } }), Rating.countDocuments({ resource: r._id })])
    await Resource.updateOne({ _id: r._id }, { downloads, helpful })
    fileXp += await award({ user: r.uploader, actor: other, kind: 'resource_helpful', points: XP_RULES.points.helpful, refKey: `helpful:${other}:${r._id}`, label: `Helpful: ${r.title}`, at: new Date(at.getTime() + 2 * HOUR) })
  }
  console.log(`Seeded ${DEMO_RESOURCES.length} demo library files (${fileXp} XP newly awarded).`)
  await disconnectDb()
}

main().catch(async (err) => {
  console.error(err instanceof Error ? err.message : err)
  await disconnectDb().catch(() => {})
  process.exit(1)
})
