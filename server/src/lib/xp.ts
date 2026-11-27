import { Types } from 'mongoose'
import { Ledger, type XpKind } from '../models/Ledger.js'
import { serialize } from './serial.js'

/** Gamification constants. Keep in sync with client/src/api/rules.ts (the client only displays them). */
export const XP_RULES = {
  dailyXpCap: 120,
  pairWeeklyCap: 3, // max XP-earning interactions from one actor to one student per 7 days
  points: { helpful: 5, verified: 30, accepted: 15, answerUp: 2, questionUp: 1, voiceUp: 1 },
} as const

export const DAY = 86_400_000
export const WEEK = 7 * DAY

type Id = Types.ObjectId
const isDuplicateKey = (err: unknown) => (err as { code?: number } | null)?.code === 11000

// Awards for one student run one at a time (serialize, single process), so parallel requests cannot all pass a cap check before any of them writes.
const oneAtATime = <T>(user: Id, fn: () => Promise<T>) => serialize(`xp:${user}`, fn)

export type AwardInput = {
  user: Id
  /** Who caused the award. 'system' is for bonuses nobody gave (e.g. a verified resource); it skips the self and pair checks. */
  actor: Id | 'system'
  kind: XpKind
  points: number
  refKey: string
  label: string
  /** Server-side only (seed): when the event happened. Caps are counted in the windows ending then. */
  at?: Date
  /**
   * Checked in the student's queue right before paying; false pays nothing. compensate() runs in the same queue, so
   * content removed (then compensated) before this check pays nothing, and content removed after it is taken back.
   */
  onlyIf?: () => Promise<boolean>
}

/**
 * Single choke point for points, same rules as docs/BACKEND.md and client/src/api/rules.ts:
 * no self-award, one payment per refKey, at most XP_RULES.pairWeeklyCap paying interactions
 * from one actor to one student per 7 days, at most XP_RULES.dailyXpCap points per student per 24 h
 * (the last award is clamped). Returns the points actually written (0 when nothing was paid). Never throws on a repeat.
 */
export function award(input: AwardInput): Promise<number> {
  return oneAtATime(input.user, () => awardNow(input))
}

async function awardNow({ user, actor, kind, points, refKey, label, at = new Date(), onlyIf }: AwardInput): Promise<number> {
  if (!(points > 0)) return 0
  const system = actor === 'system'
  if (!system && actor.equals(user)) return 0
  if (await Ledger.exists({ refKey })) return 0
  const t = at.getTime()
  if (!system) {
    const pair = await Ledger.countDocuments({ actor, user, points: { $gt: 0 }, createdAt: { $gt: new Date(t - WEEK), $lte: at } })
    if (pair >= XP_RULES.pairWeeklyCap) return 0
  }
  const [today] = await Ledger.aggregate<{ sum: number }>([
    { $match: { user, points: { $gt: 0 }, createdAt: { $gt: new Date(t - DAY), $lte: at } } },
    { $group: { _id: null, sum: { $sum: '$points' } } },
  ])
  const pts = Math.min(points, Math.max(0, XP_RULES.dailyXpCap - (today?.sum ?? 0)))
  if (pts <= 0) return 0
  if (onlyIf && !(await onlyIf())) return 0
  try {
    await Ledger.create({ user, actor: system ? null : actor, kind, points: pts, refKey, label, createdAt: at })
  } catch (err) {
    if (isDuplicateKey(err)) return 0 // a parallel request paid this event first
    throw err
  }
  return pts
}

/**
 * Compensating row for removed content: takes back every point the student earned from rows whose refKey
 * matches `match` (e.g. /:<resourceId>$/), as one negative row. The ledger itself is never edited.
 * `refKey` (e.g. `remove:<id>`) makes it run once. Returns the (negative) points written, 0 when nothing was due.
 */
export function compensate(input: { user: Id; match: RegExp; refKey: string; label: string }): Promise<number> {
  return oneAtATime(input.user, () => compensateNow(input))
}

async function compensateNow({ user, match, refKey, label }: { user: Id; match: RegExp; refKey: string; label: string }): Promise<number> {
  if (await Ledger.exists({ refKey })) return 0
  const [earned] = await Ledger.aggregate<{ sum: number }>([
    { $match: { user, refKey: match, points: { $gt: 0 } } },
    { $group: { _id: null, sum: { $sum: '$points' } } },
  ])
  const sum = earned?.sum ?? 0
  if (sum <= 0) return 0
  try {
    await Ledger.create({ user, actor: null, kind: 'removal_penalty', points: -sum, refKey, label })
  } catch (err) {
    if (isDuplicateKey(err)) return 0
    throw err
  }
  return -sum
}

/** XP of every student with a positive total since `since`, highest first (ties by id, so the order is stable). */
export async function standings(since?: Date, limit?: number) {
  const pipeline: Parameters<typeof Ledger.aggregate>[0] = [
    ...(since ? [{ $match: { createdAt: { $gte: since } } }] : []),
    { $group: { _id: '$user', xp: { $sum: '$points' } } },
    { $match: { xp: { $gt: 0 } } },
    { $sort: { xp: -1, _id: 1 } },
    ...(limit ? [{ $limit: limit }] : []),
  ]
  return Ledger.aggregate<{ _id: Id; xp: number }>(pipeline)
}

/** Sum of a student's rows since `since` (all time by default). */
export async function xpOf(user: Id, since?: Date) {
  const [row] = await Ledger.aggregate<{ xp: number }>([
    { $match: { user, ...(since ? { createdAt: { $gte: since } } : {}) } },
    { $group: { _id: null, xp: { $sum: '$points' } } },
  ])
  return row?.xp ?? 0
}

/** All-time rank: 1 + number of students with strictly more XP. 0 = not ranked yet (no positive XP). */
export async function rankOf(xp: number) {
  if (xp <= 0) return 0
  const [row] = await Ledger.aggregate<{ n: number }>([
    { $group: { _id: '$user', xp: { $sum: '$points' } } },
    { $match: { xp: { $gt: xp } } },
    { $count: 'n' },
  ])
  return (row?.n ?? 0) + 1
}
