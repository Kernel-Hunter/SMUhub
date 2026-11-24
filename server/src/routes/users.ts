import { Router } from 'express'
import { isValidObjectId } from 'mongoose'
import { HttpError } from '../lib/errors.js'
import { rankOf, xpOf } from '../lib/xp.js'
import { Reply } from '../models/Reply.js'
import { Thread } from '../models/Thread.js'
import { User, toClientUser } from '../models/User.js'
import { loadPeople } from '../lib/people.js'
import { threadJson } from '../lib/threads.js'
import { Resource } from '../models/Resource.js'
import { resourcesJson } from './resources.js'

/**
 * Public student profiles, mounted at /api/users behind requireAuth (see app.ts).
 * Same shape as api.users.profile in client/src/api/client.ts. Never returns an email,
 * and never lists anonymous content (docs/BACKEND.md, Privacy).
 */

const NOT_FOUND = 'Student not found.'

export function usersRouter() {
  const router = Router()

  // GET /api/users/:id -> { user, resources, threads, acceptedAnswers }
  router.get('/:id', async (req, res) => {
    const me = req.user!._id
    if (!isValidObjectId(req.params.id)) throw new HttpError(404, 'not_found', NOT_FOUND)
    const u = await User.findById(req.params.id)
    if (!u) throw new HttpError(404, 'not_found', NOT_FOUND)
    const xp = await xpOf(u._id)
    const [rank, threads, acceptedAnswers] = await Promise.all([
      rankOf(xp),
      Thread.find({ author: u._id, kind: { $in: ['question', 'voice'] }, anonymous: { $ne: true } }).sort({ createdAt: -1 }).limit(50),
      Reply.countDocuments({ author: u._id, accepted: true, anonymous: { $ne: true } }),
    ])
    const authors = await loadPeople([u._id])
    res.json({
      user: { ...toClientUser(u), bio: u.bio ?? '', joinedAt: (u.createdAt ?? new Date()).getTime(), xp, rank },
      resources: await resourcesJson(await Resource.find({ uploader: u._id }).sort({ createdAt: -1, _id: -1 }).limit(50), me),
      threads: threads.map((t) => threadJson(t, me, authors)),
      acceptedAnswers,
    })
  })

  return router
}
