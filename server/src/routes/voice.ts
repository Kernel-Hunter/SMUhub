import { Router } from 'express'
import { z } from 'zod'
import { HttpError } from '../lib/errors.js'
import { loadPeople } from '../lib/people.js'
import { LIMITS, ago, escapeRegex, findReply, findThread, replyJson, threadJson } from '../lib/threads.js'
import { XP_RULES, award } from '../lib/xp.js'
import { Thread, VOICE_CATEGORIES } from '../models/Thread.js'
import { Reply } from '../models/Reply.js'

/**
 * Campus Voice API, mounted at /api/voice behind requireAuth (see app.ts).
 * Same rules as docs/BACKEND.md: posts and replies can be anonymous,
 * one vote per student, votes are final, no voting on your own posts; posting is rate limited (budget shared with Q&A).
 * An upvoted named post pays its author voiceUp XP through award(). Anonymous posts pay nothing: a visible XP jump
 * right after an upvote would point at the author. Reply upvotes pay nothing. No accepted answers.
 * Anonymous content never carries its author, not even for the author (who gets `mine: true`).
 */

const newPost = z.object({
  title: z.string().trim().min(8).max(140),
  body: z.string().trim().min(10).max(4000),
  category: z.enum(VOICE_CATEGORIES),
  anonymous: z.boolean().default(false),
})
const newReply = z.object({ body: z.string().trim().min(2).max(3000), anonymous: z.boolean().default(false) })

const POST_NOT_FOUND = 'Post not found.'
const REPLY_NOT_FOUND = 'Reply not found.'

const findPost = (id: string) => findThread(id, 'voice', POST_NOT_FOUND)

export function voiceRouter() {
  const router = Router()

  // Browse and search: GET /api/voice?q=&category=&sort=new|top
  router.get('/', async (req, res) => {
    const me = req.user!._id
    const filter: Record<string, unknown> = { kind: 'voice' }
    const { q, category, sort } = req.query
    if (typeof category === 'string' && category) filter.category = category
    if (typeof q === 'string' && q.trim()) {
      const rx = new RegExp(escapeRegex(q.trim().slice(0, 100)), 'i')
      filter.$or = [{ title: rx }, { body: rx }]
    }
    const order: Record<string, 1 | -1> = sort === 'top' ? { votes: -1, createdAt: -1 } : { createdAt: -1 }
    const threads = await Thread.find(filter).sort(order).limit(50)
    const authors = await loadPeople(threads.filter((t) => !t.anonymous).map((t) => t.author))
    res.json({ threads: threads.map((t) => threadJson(t, me, authors)) })
  })

  // Post: POST /api/voice { title, body, category, anonymous }
  router.post('/', async (req, res) => {
    const me = req.user!._id
    const parsed = newPost.safeParse(req.body)
    if (!parsed.success) {
      throw new HttpError(400, 'invalid_input', 'Pick a topic, a title (at least 8 characters) and a description (at least 10 characters).')
    }
    const recent = await Thread.countDocuments({ author: me, createdAt: { $gte: ago(3_600_000) } })
    if (recent >= LIMITS.threadsPerHour) throw new HttpError(429, 'rate_limited', `Slow down: at most ${LIMITS.threadsPerHour} posts per hour.`)
    const thread = await Thread.create({ ...parsed.data, kind: 'voice', author: me })
    res.status(201).json({ thread: threadJson(thread, me, await loadPeople([me])) })
  })

  // One post with its replies: GET /api/voice/:id
  router.get('/:id', async (req, res) => {
    const me = req.user!._id
    const thread = await findPost(req.params.id)
    const replies = await Reply.find({ thread: thread._id }).sort({ votes: -1, createdAt: 1 })
    const authors = await loadPeople([thread, ...replies].filter((x) => !x.anonymous).map((x) => x.author))
    res.json({ thread: threadJson(thread, me, authors), replies: replies.map((r) => replyJson(r, me, authors)) })
  })

  // Upvote a post: POST /api/voice/:id/vote. Once per student, final, never your own.
  router.post('/:id/vote', async (req, res) => {
    const me = req.user!._id
    const thread = await findPost(req.params.id)
    if (thread.author.equals(me)) throw new HttpError(403, 'self_vote', 'You cannot vote on your own post.')
    // Conditional update: two parallel clicks cannot both count.
    const done = await Thread.updateOne({ _id: thread._id, voters: { $ne: me } }, { $push: { voters: me }, $inc: { votes: 1 } })
    if (done.modifiedCount === 0) throw new HttpError(409, 'already_voted', 'You already voted on this post.')
    if (!thread.anonymous) await award({ user: thread.author, actor: me, kind: 'voice_upvoted', points: XP_RULES.points.voiceUp, refKey: `tv:${me}:${thread._id}`, label: 'Post upvoted' })
    const fresh = (await Thread.findById(thread._id))!
    res.json({ thread: threadJson(fresh, me, await loadPeople(fresh.anonymous ? [] : [fresh.author])) })
  })

  // Reply: POST /api/voice/:id/replies { body, anonymous }
  router.post('/:id/replies', async (req, res) => {
    const me = req.user!._id
    const parsed = newReply.safeParse(req.body)
    if (!parsed.success) throw new HttpError(400, 'invalid_input', 'Your reply is too short.')
    const thread = await findPost(req.params.id)
    const recent = await Reply.countDocuments({ author: me, createdAt: { $gte: ago(600_000) } })
    if (recent >= LIMITS.repliesPer10Min) throw new HttpError(429, 'rate_limited', 'Too many replies in a short time. Take a break.')
    const reply = await Reply.create({ ...parsed.data, thread: thread._id, author: me })
    await Thread.updateOne({ _id: thread._id }, { $inc: { replyCount: 1 } })
    res.status(201).json({ reply: replyJson(reply, me, await loadPeople([me])) })
  })

  // Upvote a reply: POST /api/voice/replies/:replyId/vote. Same rules as posts; pays no XP.
  router.post('/replies/:replyId/vote', async (req, res) => {
    const me = req.user!._id
    const reply = await findReply(req.params.replyId, 'voice', REPLY_NOT_FOUND)
    if (reply.author.equals(me)) throw new HttpError(403, 'self_vote', 'You cannot vote on your own reply.')
    const done = await Reply.updateOne({ _id: reply._id, voters: { $ne: me } }, { $push: { voters: me }, $inc: { votes: 1 } })
    if (done.modifiedCount === 0) throw new HttpError(409, 'already_voted', 'You already voted on this reply.')
    const fresh = (await Reply.findById(reply._id))!
    res.json({ reply: replyJson(fresh, me, await loadPeople(fresh.anonymous ? [] : [fresh.author])) })
  })

  return router
}
