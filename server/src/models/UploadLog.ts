import { Schema, model } from 'mongoose'

/**
 * One row per saved upload, written by POST /api/resources and never touched by a delete, so removing a file does not
 * give an upload back. The daily upload limit counts these rows. Rows expire after 2 days (TTL index on createdAt).
 */
const uploadLogSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    createdAt: { type: Date, default: Date.now },
  },
  { versionKey: false },
)
uploadLogSchema.index({ user: 1, createdAt: -1 })
uploadLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 2 * 86_400 })

export const UploadLog = model('UploadLog', uploadLogSchema)
