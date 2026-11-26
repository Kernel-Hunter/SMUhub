import { Router } from 'express'
import { isValidObjectId, type Types } from 'mongoose'
import { z } from 'zod'
import { HttpError } from '../lib/errors.js'
import { Notification } from '../models/Notification.js'

/**
 * Notifications API (US-23), mounted at /api/notifications behind requireAuth (see app.ts).
 * Every query is scoped to the signed-in student: ids that belong to someone else are ignored (read) or 404 (delete), never touched.
 * Rows are written by lib/notify.ts. The actor is never sent, so an anonymous reply cannot be traced from here.
 */

export const LIMITS = { list: 30, idsPerRead: 100 }

const readInput = z.object({ ids: z.array(z.string()).max(LIMITS.idsPerRead).optional() })

const NOT_FOUND = 'Notification not found.'

type Id = Types.ObjectId
type NotificationDoc = { _id: Id; kind: string; title: string; body?: string | null; link: string; readAt?: Date | null; createdAt: Date }

/** The client's AppNotification shape (client/src/api/types.ts). No actor, no recipient. */
const notificationJson = (n: NotificationDoc) => ({
  id: n._id.toString(), kind: n.kind, title: n.title, body: n.body ?? undefined, link: n.link, read: !!n.readAt, createdAt: n.createdAt.getTime(),
})

const unreadCount = (me: Id) => Notification.countDocuments({ user: me, readAt: null })

export function notificationsRouter() {
  const router = Router()

  // Newest first, with the unread count for the bell: GET /api/notifications
  router.get('/', async (req, res) => {
    const me = req.user!._id
    const [list, unread] = await Promise.all([Notification.find({ user: me }).sort({ createdAt: -1, _id: -1 }).limit(LIMITS.list), unreadCount(me)])
    res.json({ notifications: list.map(notificationJson), unread })
  })

  // Mark as read: POST /api/notifications/read { ids? }. Without ids, all of mine. Answers the new unread count.
  router.post('/read', async (req, res) => {
    const me = req.user!._id
    const parsed = readInput.safeParse(req.body ?? {})
    if (!parsed.success) throw new HttpError(400, 'invalid_input', 'Invalid notification list.')
    const { ids } = parsed.data
    const filter: Record<string, unknown> = { user: me, readAt: null }
    if (ids) filter._id = { $in: ids.filter((id) => isValidObjectId(id)) }
    await Notification.updateMany(filter, { readAt: new Date() })
    res.json({ unread: await unreadCount(me) })
  })

  // Dismiss one: DELETE /api/notifications/:id -> 204. Mine only; anything else is 404.
  router.delete('/:id', async (req, res) => {
    const id = req.params.id
    if (!isValidObjectId(id)) throw new HttpError(404, 'not_found', NOT_FOUND)
    const done = await Notification.deleteOne({ _id: id, user: req.user!._id })
    if (done.deletedCount === 0) throw new HttpError(404, 'not_found', NOT_FOUND)
    res.status(204).end()
  })

  return router
}
