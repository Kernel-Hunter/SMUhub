import { isValidObjectId, type Types } from 'mongoose'
import { HttpError } from './errors.js'
import type { PublicPerson } from './people.js'
import { Reply } from '../models/Reply.js'
import { Thread } from '../models/Thread.js'

/**
 * Shared by the Q&A (routes/questions.ts) and Campus Voice (routes/voice.ts) APIs, and by profiles (routes/users.ts).
 * Anonymous content never carries its author: `author` is null for everyone, the author included, who only gets `mine: true`.
 */

// Per student, counted across both kinds (a question and a voice post share the same budget).
export const LIMITS = {
  threadsPerHour: 5,
  repliesPer10Min: 8,
}

type Id = Types.ObjectId
type Kind = 'question' | 'voice'

export const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
export const ago = (ms: number) => new Date(Date.now() - ms)

export type ThreadDoc = { _id: Id; kind: string; title: string; body: string; courseCode?: string | null; category?: string | null; author: Id; anonymous: boolean; voters: Id[]; votes: number; replyCount: number; solved: boolean; createdAt: Date }
export type ReplyDoc = { _id: Id; thread: Id; body: string; author: Id; anonymous: boolean; voters: Id[]; votes: number; accepted: boolean; createdAt: Date }

export function threadJson(t: ThreadDoc, me: Id, authors: Map<string, PublicPerson>) {
  return {
    id: t._id.toString(), kind: t.kind, title: t.title, body: t.body, courseCode: t.courseCode ?? undefined, category: t.category ?? undefined,
    author: t.anonymous ? null : (authors.get(t.author.toString()) ?? null),
    mine: t.author.equals(me), createdAt: t.createdAt.getTime(),
    votes: t.votes, iVoted: t.voters.some((v) => v.equals(me)), replyCount: t.replyCount, solved: t.solved,
  }
}

export function replyJson(r: ReplyDoc, me: Id, authors: Map<string, PublicPerson>) {
  return {
    id: r._id.toString(), threadId: r.thread.toString(), body: r.body,
    author: r.anonymous ? null : (authors.get(r.author.toString()) ?? null),
    mine: r.author.equals(me), createdAt: r.createdAt.getTime(),
    votes: r.votes, iVoted: r.voters.some((v) => v.equals(me)), accepted: r.accepted,
  }
}

/** A thread of the given kind, or 404: a question id never opens a voice post and the other way round. */
export async function findThread(id: string, kind: Kind, message: string) {
  if (!isValidObjectId(id)) throw new HttpError(404, 'not_found', message)
  const t = await Thread.findOne({ _id: id, kind })
  if (!t) throw new HttpError(404, 'not_found', message)
  return t
}

/** A reply whose thread is of the given kind, or 404. */
export async function findReply(id: string, kind: Kind, message: string) {
  if (!isValidObjectId(id)) throw new HttpError(404, 'not_found', message)
  const r = await Reply.findById(id)
  if (!r || !(await Thread.exists({ _id: r.thread, kind }))) throw new HttpError(404, 'not_found', message)
  return r
}
