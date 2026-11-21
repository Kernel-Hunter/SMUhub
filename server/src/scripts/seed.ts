/**
 * Adds test students so login can be tried before sign-up (US-01) exists.
 * Safe to run several times: users are upserted by email and their password is reset.
 *   npm run seed
 */
import 'dotenv/config'
import { loadConfig } from '../config/env.js'
import { connectDb, disconnectDb } from '../db.js'
import { User } from '../models/User.js'
import { hashPassword } from '../lib/password.js'
import { isAllowedDomain } from '../lib/email.js'

const TEST_PASSWORD = 'SmuTest2026!'

const TEST_STUDENTS = [
  { email: 'yasmine.trabelsi@medtech.tn', firstName: 'Yasmine', lastName: 'Trabelsi', major: 'Software Engineering', year: 3 },
  { email: 'ahmed.benali@msb.tn', firstName: 'Ahmed', lastName: 'Ben Ali', major: 'Business Analytics', year: 2 },
]

async function main() {
  const config = loadConfig()
  await connectDb(config.mongoUri)
  await User.syncIndexes() // makes sure the unique index on email exists
  const passwordHash = await hashPassword(TEST_PASSWORD)
  for (const s of TEST_STUDENTS) {
    if (!isAllowedDomain(s.email, config.allowedDomains)) {
      console.warn(`! ${s.email} is not in ALLOWED_EMAIL_DOMAINS, it will be refused at login`)
    }
    await User.updateOne({ email: s.email }, { $set: { ...s, passwordHash } }, { upsert: true })
    console.log(`✓ ${s.email}`)
  }
  console.log(`Seeded ${TEST_STUDENTS.length} students. Password for all: ${TEST_PASSWORD}`)
  await disconnectDb()
}

main().catch(async (err) => {
  console.error(err instanceof Error ? err.message : err)
  await disconnectDb().catch(() => {})
  process.exit(1)
})
