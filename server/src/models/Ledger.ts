import { Schema, model } from 'mongoose'

/** Kinds of XP rows. Same values as XpKind in client/src/api/types.ts. */
export const XP_KINDS = [
  'resource_verified', 'resource_helpful', 'answer_accepted', 'answer_upvoted',
  'question_upvoted', 'voice_upvoted', 'removal_penalty',
] as const
export type XpKind = (typeof XP_KINDS)[number]

/**
 * Append-only XP ledger: a student's XP is the sum of their rows. Rows are only ever inserted,
 * through award() and compensate() in lib/xp.ts. Corrections are new negative rows, never edits.
 */
const ledgerSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true }, // who earns
    actor: { type: Schema.Types.ObjectId, ref: 'User', default: null }, // who caused it; null = the system
    kind: { type: String, enum: XP_KINDS, required: true },
    points: { type: Number, required: true },
    refKey: { type: String, required: true, unique: true }, // one event pays once
    label: { type: String, required: true, maxlength: 200 },
    createdAt: { type: Date, default: Date.now, index: true },
  },
  { versionKey: false },
)
ledgerSchema.index({ user: 1, createdAt: -1 })
ledgerSchema.index({ actor: 1, user: 1, createdAt: -1 })

// Block every update and delete the app could issue. Only inserts go through.
const appendOnly = () => { throw new Error('The XP ledger is append-only: add a compensating row instead.') }
for (const op of ['updateOne', 'deleteOne'] as const) ledgerSchema.pre(op, { document: true, query: true }, appendOnly)
for (const op of ['updateMany', 'findOneAndUpdate', 'replaceOne', 'findOneAndReplace', 'deleteMany', 'findOneAndDelete'] as const) ledgerSchema.pre(op, appendOnly)
ledgerSchema.pre('bulkWrite', appendOnly)
ledgerSchema.pre('save', function () { if (!this.isNew) appendOnly() })

export const Ledger = model('Ledger', ledgerSchema)
