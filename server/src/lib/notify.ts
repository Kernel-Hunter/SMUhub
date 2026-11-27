import type { Types } from 'mongoose'
import { Notification, type NotificationKind } from '../models/Notification.js'
import { User } from '../models/User.js'

/**
 * In-app notifications (US-23), written after an action succeeded. Same rules as docs/BACKEND.md:
 * never about your own action, never an error for the request that triggered it (failures are logged, the action stands),
 * and anonymous content never stores its author: the row's actor is null and the text names nobody.
 */

type Id = Types.ObjectId

export const FANOUT_CAP = 500

export type NotifyInput = {
  kind: NotificationKind
  title: string
  body?: string
  /** Client path the notification opens, e.g. /qa/<id>. */
  link: string
  /** Who caused it. Used for the self check; 'system' for nobody (a verified file). */
  actor?: Id | 'system' | null
  /** The actor posted anonymously: checked against the recipient, then not stored. */
  anonymous?: boolean
}

const short = (s: string, max: number) => (s.length > max ? `${s.slice(0, max - 3).trimEnd()}...` : s)

function row(user: Id, { kind, title, body, link, actor, anonymous }: NotifyInput) {
  return {
    user, kind, title: short(title, 200), body: body === undefined ? undefined : short(body, 300), link,
    actor: anonymous || !actor || actor === 'system' ? null : actor,
  }
}

const isSelf = (user: Id, actor: NotifyInput['actor']) => !!actor && actor !== 'system' && actor.equals(user)

/** One notification for one student. Never throws. */
export async function notify(user: Id, input: NotifyInput): Promise<void> {
  try {
    if (isSelf(user, input.actor)) return
    await Notification.create(row(user, input))
  } catch (err) {
    console.error('[notify] could not save a notification:', err)
  }
}

/** The same notification for several students, in one insertMany. The actor is left out, at most FANOUT_CAP rows. Never throws. */
export async function notifyMany(users: Id[], input: NotifyInput): Promise<void> {
  try {
    const seen = new Set<string>()
    const to = users.filter((u) => !isSelf(u, input.actor) && !seen.has(u.toString()) && seen.add(u.toString())).slice(0, FANOUT_CAP)
    if (to.length) await Notification.insertMany(to.map((u) => row(u, input)), { ordered: false })
  } catch (err) {
    console.error('[notify] could not save notifications:', err)
  }
}

/** A new announcement: everyone following its course, or everyone when it is pinned, never its author. Capped at FANOUT_CAP. */
export async function notifyAnnouncement(a: { title: string; body: string; courseCode?: string | null; pinned?: boolean | null; author: Id }): Promise<void> {
  try {
    if (!a.pinned && !a.courseCode) return
    const filter = a.pinned ? { _id: { $ne: a.author } } : { _id: { $ne: a.author }, courses: a.courseCode }
    const users = await User.find(filter, { _id: 1 }).sort({ _id: -1 }).limit(FANOUT_CAP)
    const title = a.pinned ? `Pinned: ${a.title}` : `New in ${a.courseCode}: ${a.title}`
    await notifyMany(users.map((u) => u._id as Id), { kind: 'announcement', title, body: a.body, link: '/events', actor: a.author })
  } catch (err) {
    console.error('[notify] could not reach announcement followers:', err)
  }
}
