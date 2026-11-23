import { Schema, model } from 'mongoose'

/** Campus Voice topics. Same values as VoiceCategory in client/src/api/types.ts. */
export const VOICE_CATEGORIES = ['academics', 'facilities', 'admin', 'campus-life', 'praise', 'idea'] as const

/** A Q&A question (kind 'question', has a courseCode) or a Campus Voice post (kind 'voice', has a category). */
const threadSchema = new Schema(
  {
    kind: { type: String, enum: ['question', 'voice'], default: 'question', index: true },
    title: { type: String, required: true, trim: true, maxlength: 140 },
    body: { type: String, required: true, trim: true, maxlength: 4000 },
    courseCode: { type: String, trim: true, uppercase: true, index: true },
    category: { type: String, enum: VOICE_CATEGORIES, required: function (this: { kind?: string }) { return this.kind === 'voice' } },
    author: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    // Hides the author from everyone else (docs/BACKEND.md, Privacy). Only voice posts can be anonymous.
    anonymous: { type: Boolean, default: false },
    // Who upvoted, so a student can vote once. `votes` mirrors voters.length so lists can sort on it.
    voters: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    votes: { type: Number, default: 0 },
    replyCount: { type: Number, default: 0 },
    solved: { type: Boolean, default: false },
  },
  { timestamps: true, versionKey: false },
)

export const Thread = model('Thread', threadSchema)
