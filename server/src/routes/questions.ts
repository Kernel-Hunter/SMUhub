import { Router } from 'express'
import { z } from 'zod'
import { HttpError } from '../lib/errors.js'
import { isCourseCode } from '../lib/courses.js'
import { loadPeople } from '../lib/people.js'
import { LIMITS, ago, escapeRegex, findReply, findThread, replyJson, threadJson } from '../lib/threads.js'
import { XP_RULES, award } from '../lib/xp.js'
import { Thread } from '../models/Thread.js'
import { Reply } from '../models/Reply.js'

/**
 * Q&A API, mounted at /api/questions behind requireAuth (see app.ts).
 * Same rules as docs/BACKEND.md:
 * one vote per student, votes are final, no voting on your own posts,
 * only the asker accepts, once, and not their own answer; posting is rate limited.
 * XP goes to the author through award() (lib/xp.ts): question upvoted, answer upvoted, answer accepted.
 */

// Limits, per student, shared with Campus Voice (lib/threads.ts). The client shows the same limits (client/src/api/rules.ts).
export { LIMITS }

const newQuestion = z.object({
  title: z.string().trim().min(8).max(140),
  body: z.string().trim().min(10).max(4000),
  courseCode: z.string().trim().toUpperCase().refine(isCourseCode),
})
const newReply = z.object({ body: z.string().trim().min(2).max(3000) })

const QUESTION_NOT_FOUND = 'Question introuvable.'
const REPLY_NOT_FOUND = 'Réponse introuvable.'

const findQuestion = (id: string) => findThread(id, 'question', QUESTION_NOT_FOUND)
const findAnswer = (id: string) => findReply(id, 'question', REPLY_NOT_FOUND)

export function questionsRouter() {
  const router = Router()

  // Browse and search: GET /api/questions?q=&course=&sort=new|top&unsolved=1
  router.get('/', async (req, res) => {
    const me = req.user!._id
    const filter: Record<string, unknown> = { kind: 'question' }
    const { q, course, sort, unsolved } = req.query
    if (typeof course === 'string' && course.trim()) filter.courseCode = course.trim().toUpperCase()
    if (typeof q === 'string' && q.trim()) {
      const rx = new RegExp(escapeRegex(q.trim().slice(0, 100)), 'i')
      filter.$or = [{ title: rx }, { body: rx }]
    }
    if (unsolved === '1') filter.solved = false
    const order: Record<string, 1 | -1> = sort === 'top' ? { votes: -1, createdAt: -1 } : { createdAt: -1 }
    const threads = await Thread.find(filter).sort(order).limit(50)
    const authors = await loadPeople(threads.map((t) => t.author))
    res.json({ threads: threads.map((t) => threadJson(t, me, authors)) })
  })

  // Ask: POST /api/questions { title, body, courseCode }
  router.post('/', async (req, res) => {
    const me = req.user!._id
    const parsed = newQuestion.safeParse(req.body)
    if (!parsed.success) {
      throw new HttpError(400, 'invalid_input', 'Choisis un cours, un titre (8 caractères min.) et une description (10 caractères min.).')
    }
    const recent = await Thread.countDocuments({ author: me, createdAt: { $gte: ago(3_600_000) } })
    if (recent >= LIMITS.threadsPerHour) throw new HttpError(429, 'rate_limited', `Doucement : ${LIMITS.threadsPerHour} questions par heure au maximum.`)
    const thread = await Thread.create({ ...parsed.data, kind: 'question', author: me })
    res.status(201).json({ thread: threadJson(thread, me, await loadPeople([me])) })
  })

  // One question with its answers: GET /api/questions/:id
  router.get('/:id', async (req, res) => {
    const me = req.user!._id
    const thread = await findQuestion(req.params.id)
    const replies = await Reply.find({ thread: thread._id }).sort({ accepted: -1, votes: -1, createdAt: 1 })
    const authors = await loadPeople([thread.author, ...replies.map((r) => r.author)])
    res.json({ thread: threadJson(thread, me, authors), replies: replies.map((r) => replyJson(r, me, authors)) })
  })

  // Upvote a question: POST /api/questions/:id/vote. Once per student, final, never your own.
  router.post('/:id/vote', async (req, res) => {
    const me = req.user!._id
    const thread = await findQuestion(req.params.id)
    if (thread.author.equals(me)) throw new HttpError(403, 'self_vote', 'Tu ne peux pas voter pour ta propre question.')
    // Conditional update: two parallel clicks cannot both count.
    const done = await Thread.updateOne({ _id: thread._id, voters: { $ne: me } }, { $push: { voters: me }, $inc: { votes: 1 } })
    if (done.modifiedCount === 0) throw new HttpError(409, 'already_voted', 'Tu as déjà voté pour cette question.')
    await award({ user: thread.author, actor: me, kind: 'question_upvoted', points: XP_RULES.points.questionUp, refKey: `tv:${me}:${thread._id}`, label: 'Question upvoted' })
    const fresh = (await Thread.findById(thread._id))!
    res.json({ thread: threadJson(fresh, me, await loadPeople([fresh.author])) })
  })

  // Answer: POST /api/questions/:id/replies { body }
  router.post('/:id/replies', async (req, res) => {
    const me = req.user!._id
    const parsed = newReply.safeParse(req.body)
    if (!parsed.success) throw new HttpError(400, 'invalid_input', 'La réponse est trop courte.')
    const thread = await findQuestion(req.params.id)
    const recent = await Reply.countDocuments({ author: me, createdAt: { $gte: ago(600_000) } })
    if (recent >= LIMITS.repliesPer10Min) throw new HttpError(429, 'rate_limited', 'Trop de réponses en peu de temps. Fais une pause.')
    const reply = await Reply.create({ ...parsed.data, thread: thread._id, author: me })
    await Thread.updateOne({ _id: thread._id }, { $inc: { replyCount: 1 } })
    res.status(201).json({ reply: replyJson(reply, me, await loadPeople([me])) })
  })

  // Upvote an answer: POST /api/questions/replies/:replyId/vote. Same rules as questions.
  router.post('/replies/:replyId/vote', async (req, res) => {
    const me = req.user!._id
    const reply = await findAnswer(req.params.replyId)
    if (reply.author.equals(me)) throw new HttpError(403, 'self_vote', 'Tu ne peux pas voter pour ta propre réponse.')
    const done = await Reply.updateOne({ _id: reply._id, voters: { $ne: me } }, { $push: { voters: me }, $inc: { votes: 1 } })
    if (done.modifiedCount === 0) throw new HttpError(409, 'already_voted', 'Tu as déjà voté pour cette réponse.')
    await award({ user: reply.author, actor: me, kind: 'answer_upvoted', points: XP_RULES.points.answerUp, refKey: `rv:${me}:${reply._id}`, label: 'Answer upvoted' })
    const fresh = (await Reply.findById(reply._id))!
    res.json({ reply: replyJson(fresh, me, await loadPeople([fresh.author])) })
  })

  // Accept an answer: POST /api/questions/replies/:replyId/accept. Only the asker, once, not their own answer.
  router.post('/replies/:replyId/accept', async (req, res) => {
    const me = req.user!._id
    const reply = await findAnswer(req.params.replyId)
    const thread = await Thread.findOne({ _id: reply.thread, kind: 'question' })
    if (!thread) throw new HttpError(404, 'not_found', QUESTION_NOT_FOUND)
    if (!thread.author.equals(me)) throw new HttpError(403, 'forbidden', "Seul l'auteur de la question peut accepter une réponse.")
    if (reply.author.equals(me)) throw new HttpError(403, 'own_answer', 'Tu ne peux pas accepter ta propre réponse.')
    // Conditional update: a question can only be solved once, even with parallel requests.
    const done = await Thread.updateOne({ _id: thread._id, solved: false }, { solved: true })
    if (done.modifiedCount === 0) throw new HttpError(409, 'already_solved', 'Cette question a déjà une réponse acceptée.')
    await Reply.updateOne({ _id: reply._id }, { accepted: true })
    await award({ user: reply.author, actor: me, kind: 'answer_accepted', points: XP_RULES.points.accepted, refKey: `accept:${thread._id}`, label: `Answer accepted: ${thread.title}` })
    const fresh = (await Reply.findById(reply._id))!
    res.json({ reply: replyJson(fresh, me, await loadPeople([fresh.author])), solved: true })
  })

  return router
}
