import { Schema, model } from 'mongoose'

/** A Q&A question (kind 'question'). Campus Voice posts will use kind 'voice' once they move to the server. */
const threadSchema = new Schema(
  {
    kind: { type: String, enum: ['question', 'voice'], default: 'question', index: true },
    title: { type: String, required: true, trim: true, maxlength: 140 },
    body: { type: String, required: true, trim: true, maxlength: 4000 },
    courseCode: { type: String, trim: true, uppercase: true, index: true },
    author: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
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
