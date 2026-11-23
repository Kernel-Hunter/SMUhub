import type { Types } from 'mongoose'
import { User } from '../models/User.js'

/** The public shape of a student (client/src/api/types.ts PublicUser). The email is never sent. */
export type PublicPerson = { id: string; name: string; handle: string; major: string; year: number }

/** Loads the public profiles of the given users, keyed by id. Deleted users are simply missing. */
export async function loadPeople(ids: Types.ObjectId[]) {
  const unique = [...new Set(ids.map((i) => i.toString()))]
  const users = await User.find({ _id: { $in: unique } })
  return new Map<string, PublicPerson>(users.map((u) => [u._id.toString(), {
    id: u._id.toString(), name: `${u.firstName} ${u.lastName}`, handle: u.email.split('@')[0], major: u.major ?? '', year: u.year ?? 1,
  }]))
}

/** The person for `id`, or a neutral placeholder when the account was deleted (the client always expects someone). */
export const personOr = (people: Map<string, PublicPerson>, id: Types.ObjectId): PublicPerson =>
  people.get(id.toString()) ?? { id: id.toString(), name: 'Former student', handle: '', major: '', year: 1 }
