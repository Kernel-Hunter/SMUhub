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
  await disconnectDb()
}

main().catch(async (err) => {
  console.error(err instanceof Error ? err.message : err)
  await disconnectDb().catch(() => {})
  process.exit(1)
})
