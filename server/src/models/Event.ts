import { Schema, model } from 'mongoose'

/** A calendar entry: a campus event, an exam or project deadline, or a club meetup. */
const eventSchema = new Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 100 },
    kind: { type: String, enum: ['event', 'deadline', 'club'], required: true },
    startsAt: { type: Date, required: true, index: true },
    location: { type: String, trim: true, maxlength: 80, default: 'TBA' },
    courseCode: { type: String, trim: true, uppercase: true },
    description: { type: String, trim: true, maxlength: 500, default: '' },
    author: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    // Who joined, so a student counts once. `going` mirrors goers.length so lists can show it cheaply.
    goers: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    going: { type: Number, default: 0 },
  },
  { timestamps: true, versionKey: false },
)

export const Event = model('Event', eventSchema)
