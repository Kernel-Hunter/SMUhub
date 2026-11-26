import { Schema, model } from 'mongoose'

/** A short dated notice ("Library closed Friday", "Lab moved to room B12"). Not a calendar entry: see Event for those. */
const announcementSchema = new Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 120 },
    body: { type: String, required: true, trim: true, maxlength: 2000 },
    courseCode: { type: String, trim: true, uppercase: true },
    author: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    // Only an admin can pin. Pinned notices stay on top of the feed.
    pinned: { type: Boolean, default: false },
    // Hidden from the feed after this date. No date: shown until deleted.
    expiresAt: { type: Date },
  },
  { timestamps: true, versionKey: false },
)
announcementSchema.index({ pinned: -1, createdAt: -1 })

export const Announcement = model('Announcement', announcementSchema)
