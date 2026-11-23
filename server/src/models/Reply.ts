import { Schema, model } from 'mongoose'

/** An answer to a question. */
const replySchema = new Schema(
  {
    thread: { type: Schema.Types.ObjectId, ref: 'Thread', required: true, index: true },
    body: { type: String, required: true, trim: true, maxlength: 3000 },
    author: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    anonymous: { type: Boolean, default: false },
    voters: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    votes: { type: Number, default: 0 },
    accepted: { type: Boolean, default: false },
  },
  { timestamps: true, versionKey: false },
)

export const Reply = model('Reply', replySchema)
