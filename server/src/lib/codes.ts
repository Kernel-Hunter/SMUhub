import { createHmac, randomInt, timingSafeEqual } from 'node:crypto'
import { CodeBudget, VerificationCode, type CodePurpose } from '../models/VerificationCode.js'

export const CODE_TTL_MS = 15 * 60 * 1000
export const MAX_CODE_ATTEMPTS = 5
/** Wrong guesses allowed per email and purpose in 24 hours, across all codes. Then no new code is mailed until the day is over. */
export const MAX_DAILY_FAILURES = 15
const DAY_MS = 24 * 60 * 60 * 1000
/** At most one mail per email and purpose per minute. */
export const RESEND_INTERVAL_MS = 60 * 1000

export const generateCode = () => randomInt(0, 1_000_000).toString().padStart(6, '0')

/** HMAC keyed with the server secret, bound to the purpose and email: a sign-up code never works for a reset. */
const hashCode = (secret: string, purpose: CodePurpose, email: string, code: string) =>
  createHmac('sha256', secret).update(`${purpose}:${email}:${code}`).digest('hex')

/**
 * Creates a fresh code for this email and purpose, replacing the previous one, and returns it so the caller can mail it.
 * Returns null when a code was already mailed less than a minute ago (that one stays valid).
 */
export async function issueCode(secret: string, email: string, purpose: CodePurpose): Promise<string | null> {
  if (await budgetSpent(email, purpose)) return null // no more codes to guess at until the day is over
  const now = new Date()
  const code = generateCode()
  try {
    // Matches only a code that may be replaced. A recent one is left alone, so the upsert collides with the
    // unique { email, purpose } index and fails: the throttle holds even under parallel requests.
    await VerificationCode.findOneAndUpdate(
      { email, purpose, $or: [{ sentAt: { $lte: new Date(now.getTime() - RESEND_INTERVAL_MS) } }, { expiresAt: { $lte: now } }] },
      { $set: { codeHash: hashCode(secret, purpose, email, code), expiresAt: new Date(now.getTime() + CODE_TTL_MS), attempts: 0, sentAt: now } },
      { upsert: true },
    )
  } catch (err) {
    if ((err as { code?: number }).code === 11000) return null
    throw err
  }
  return code
}

export type CodeCheck = 'ok' | 'invalid' | 'locked' | 'blocked'

/** True when this email and purpose used up its wrong guesses for the last 24 hours. */
async function budgetSpent(email: string, purpose: CodePurpose) {
  const b = await CodeBudget.findOne({ email, purpose })
  return !!b && b.failures >= MAX_DAILY_FAILURES && Date.now() - b.since.getTime() < DAY_MS
}

/** Counts one wrong guess. A row older than 24 hours that the TTL sweep has not removed yet starts a new window. */
async function spendBudget(email: string, purpose: CodePurpose) {
  const now = new Date()
  await CodeBudget.deleteOne({ email, purpose, since: { $lte: new Date(now.getTime() - DAY_MS) } })
  try {
    await CodeBudget.updateOne({ email, purpose }, { $inc: { failures: 1 }, $setOnInsert: { since: now } }, { upsert: true })
  } catch (err) {
    // Two first guesses at once: the other insert won, count on it.
    if ((err as { code?: number }).code !== 11000) throw err
    await CodeBudget.updateOne({ email, purpose }, { $inc: { failures: 1 } })
  }
}

/**
 * Checks a code and consumes it on success (single use).
 *   ok      -> the code matched and is now deleted
 *   invalid -> no code, expired, or wrong (the wrong guess is counted)
 *   locked  -> MAX_CODE_ATTEMPTS wrong guesses: the code is burned, even the right one is refused
 *   blocked -> MAX_DAILY_FAILURES wrong guesses in 24 hours for this email: every code is refused until the day is over
 */
export async function checkCode(secret: string, email: string, purpose: CodePurpose, code: string): Promise<CodeCheck> {
  if (await budgetSpent(email, purpose)) return 'blocked'
  const doc = await VerificationCode.findOne({ email, purpose })
  if (!doc || doc.expiresAt.getTime() <= Date.now()) return 'invalid'
  if (doc.attempts >= MAX_CODE_ATTEMPTS) return 'locked'

  const expected = Buffer.from(doc.codeHash, 'hex')
  const given = Buffer.from(hashCode(secret, purpose, email, code), 'hex')
  if (expected.length === given.length && timingSafeEqual(expected, given)) {
    // Atomic: two parallel requests with the right code cannot both succeed, and a code burned meanwhile stays burned.
    const used = await VerificationCode.findOneAndDelete({ _id: doc._id, codeHash: doc.codeHash, attempts: { $lt: MAX_CODE_ATTEMPTS } })
    if (used) await CodeBudget.deleteOne({ email, purpose })
    return used ? 'ok' : 'invalid'
  }
  await spendBudget(email, purpose)
  const after = await VerificationCode.findOneAndUpdate({ _id: doc._id, attempts: { $lt: MAX_CODE_ATTEMPTS } }, { $inc: { attempts: 1 } }, { returnDocument: 'after' })
  return !after || after.attempts >= MAX_CODE_ATTEMPTS ? 'locked' : 'invalid'
}
