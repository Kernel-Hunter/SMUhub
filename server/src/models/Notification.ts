import { Schema, model } from 'mongoose'

/** What a notification is about. Same values as NotificationKind in client/src/api/types.ts. */
export const NOTIFICATION_KINDS = [
  'answer', 'voice_reply', 'answer_accepted', 'resource_helpful', 'resource_verified',
  'rental_request', 'rental_accepted', 'rental_declined', 'announcement',
] as const
export type NotificationKind = (typeof NOTIFICATION_KINDS)[number]

export const NOTIFICATION_TTL_DAYS = 60

/**
 * An in-app notification for one student (US-23). Written only through lib/notify.ts.
 * `actor` is who caused it, for moderation only: it is never sent to the client, and it is null for anonymous content and the system.
 * Deleted by MongoDB 60 days after creation (TTL index).
 */
const notificationSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true }, // the recipient
    kind: { type: String, enum: NOTIFICATION_KINDS, required: true },
    title: { type: String, required: true, maxlength: 200 },
    body: { type: String, maxlength: 300 },
    link: { type: String, required: true, maxlength: 200 }, // a client path, e.g. /qa/<id>
    actor: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    readAt: { type: Date, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false }, versionKey: false },
)
// The list and the unread count are both "this student's notifications": the compound index serves them (and any query on `user`).
notificationSchema.index({ user: 1, createdAt: -1 })
notificationSchema.index({ createdAt: 1 }, { expireAfterSeconds: NOTIFICATION_TTL_DAYS * 86_400 })

export const Notification = model('Notification', notificationSchema)
