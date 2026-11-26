import { Schema, model } from 'mongoose'

export const CODE_PURPOSES = ['signup', 'reset'] as const
export type CodePurpose = (typeof CODE_PURPOSES)[number]

/**
 * One-time 6-digit code mailed to a student, for sign-up verification or password reset.
 * The code itself is never stored, only an HMAC of it (lib/codes.ts). One active code per email and purpose:
 * a new code replaces the old one. MongoDB deletes expired codes through the TTL index, but its sweep runs about
 * once a minute, so the routes also check expiresAt themselves.
 */
const verificationCodeSchema = new Schema(
  {
    email: { type: String, required: true, lowercase: true, trim: true, maxlength: 254 },
    purpose: { type: String, enum: CODE_PURPOSES, required: true },
    codeHash: { type: String, required: true },
    expiresAt: { type: Date, required: true },
    attempts: { type: Number, default: 0, min: 0 },
    // When the last mail went out, for the one-mail-per-minute throttle.
    sentAt: { type: Date, required: true },
  },
  { versionKey: false },
)

verificationCodeSchema.index({ email: 1, purpose: 1 }, { unique: true })
verificationCodeSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 })

export const VerificationCode = model('VerificationCode', verificationCodeSchema)

/**
 * Wrong guesses per email and purpose over 24 hours, across every code. Each code allows 5 guesses, but a new code
 * can be asked for every minute, so without this budget someone could keep guessing all day (lib/codes.ts).
 * The TTL index deletes the row 24 hours after the first wrong guess.
 */
const codeBudgetSchema = new Schema(
  {
    email: { type: String, required: true, lowercase: true, trim: true, maxlength: 254 },
    purpose: { type: String, enum: CODE_PURPOSES, required: true },
    failures: { type: Number, default: 0, min: 0 },
    since: { type: Date, required: true },
  },
  { versionKey: false },
)

codeBudgetSchema.index({ email: 1, purpose: 1 }, { unique: true })
codeBudgetSchema.index({ since: 1 }, { expireAfterSeconds: 24 * 60 * 60 })

export const CodeBudget = model('CodeBudget', codeBudgetSchema)
