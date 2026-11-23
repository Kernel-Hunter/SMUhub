/**
 * Mock backend. Mirrors the future REST API: same method shapes, same rules.
 * Every rule below (caps, dedupe, ledger idempotency, self-vote ban) is the
 * reference implementation the real server must enforce. The client is never trusted.
 *
 * Exceptions, served by the real server: Q&A questions (threads of kind 'question', routes/questions.ts),
 * Campus Voice posts (threads of kind 'voice', routes/voice.ts),
 * XP, the student's own profile, real students' profiles and the leaderboard (routes/me.ts, users.ts, leaderboard.ts),
 * events (routes/events.ts), rentals (routes/rentals.ts) and the resources library
 * (routes/resources.ts: uploads, downloads, ratings), all under server/src. Only the demo data below still lives here.
 */
import { RULES } from './rules'
import * as S from './seed'
import type {
  Course, LeaderRow, Me, PublicUser, Reply, Resource, ResourceKind, ResourceQuery, Thread,
  ThreadKind, VoiceCategory, CampusEvent, RentalCategory, RentalItem, RentalRequest, XpKind, XpRow,
} from './types'

export class ApiError extends Error {
  code: string
  constructor(code: string, message: string) { super(message); this.code = code }
}
const fail = (code: string, msg: string): never => { throw new ApiError(code, msg) }

// http.ts imports ApiError from this file, so it is loaded lazily to avoid a circular import.
const realHttp = async () => (await import('./http')).http
// Real questions and voice posts have 24-character database ids; the demo ones in seed.ts do not.
const isRealId = (id: string) => /^[0-9a-f]{24}$/.test(id)
// A real id does not say which kind of thread it is, so the caller passes the kind.
const threadApi = (kind: ThreadKind) => (kind === 'voice' ? '/api/voice' : '/api/questions')

/** Public profile, as returned by GET /api/users/:id (real students) or the mock (demo students). */
export type Profile = {
  user: PublicUser & { bio: string; joinedAt: number; xp: number; rank: number }
  resources: Resource[]
  threads: Thread[]
  acceptedAnswers: number
}

type UserRow = { id: string; name: string; major: string; year: number; bio: string; joinedAt: number; role: 'student' | 'admin'; courses: string[] }
type ThreadRow = { id: string; kind: ThreadKind; title: string; body: string; courseCode?: string; category?: VoiceCategory; authorId: string; anonymous: boolean; createdAt: number; votes: number; solved: boolean }
type ReplyRow = { id: string; threadId: string; body: string; authorId: string; anonymous: boolean; createdAt: number; votes: number; accepted: boolean }
type EventRow = { id: string; title: string; kind: 'event' | 'deadline' | 'club'; startsAt: number; location: string; courseCode?: string; description: string; authorId: string; going: number }
type RentalRow = { id: string; title: string; category: RentalCategory; pricePerDay: number; deposit: number; condition: 'new' | 'good' | 'worn'; description: string; ownerId: string; available: boolean; createdAt: number; contact: string }
type ReqRow = { id: string; itemId: string; renterId: string; from: number; to: number; note: string; status: RentalRequest['status'] }
type Ledger = { id: string; userId: string; actorId: string; kind: XpKind | 'seed'; points: number; refKey: string; label: string; at: number }
type DB = {
  v: 1; users: UserRow[]; threads: ThreadRow[]; replies: ReplyRow[]; events: EventRow[]
  rentals: RentalRow[]; requests: ReqRow[]; votes: string[]; going: string[]; ledger: Ledger[]
}

const KEY = 'smuhub.mock.v2'
const SESSION = 'smuhub.mock.session'
const OWNER = 'smuhub.mock.owner' // id (from the real API) of the student the mock data belongs to
const ME = 'me'
const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4)
const sleep = (ms = 160) => new Promise((r) => setTimeout(r, ms + Math.random() * 120))

function seed(): DB {
  const db: DB = { v: 1, users: [], threads: [], replies: [], events: [], rentals: [], requests: [], votes: [], going: [], ledger: [] }
  S.USERS.forEach(([id, name, major, year, bio], i) => db.users.push({ id, name, major, year, bio, joinedAt: S.daysAgo(200 + i * 9), role: 'student', courses: [] }))
  S.THREADS.forEach(([id, kind, title, body, c, cat, a, anonymous, d, votes, solved]) =>
    db.threads.push({ id, kind, title, body, courseCode: c || undefined, category: cat || undefined, authorId: a, anonymous, createdAt: S.daysAgo(d, 2), votes, solved }))
  S.REPLIES.forEach(([id, threadId, a, anonymous, body, d, votes, accepted]) =>
    db.replies.push({ id, threadId, authorId: a, anonymous, body, createdAt: S.daysAgo(d, 1), votes, accepted }))
  S.EVENTS.forEach(([id, title, kind, d, h, location, c, a, going, description]) =>
    db.events.push({ id, title, kind, startsAt: S.inDays(d, h), location, courseCode: c || undefined, description, authorId: a, going }))
  S.RENTALS.forEach(([id, title, category, price, deposit, condition, a, available, description, contact], i) =>
    db.rentals.push({ id, title, category, pricePerDay: price, deposit, condition, ownerId: a, available, description, contact, createdAt: S.daysAgo(i + 1) }))
  // Seed leaderboard: history rows so the board is populated. Marked kind 'seed'.
  const base = [1840, 1520, 1310, 980, 870, 760, 540, 470, 330, 260, 190, 120]
  S.USERS.forEach(([id], i) => {
    const week = Math.round(base[i] * (0.08 + ((i * 7) % 5) / 40))
    db.ledger.push({ id: uid(), userId: id, actorId: 'system', kind: 'seed', points: base[i] - week, refKey: `seed:${id}:all`, label: 'History', at: S.daysAgo(30) })
    db.ledger.push({ id: uid(), userId: id, actorId: 'system', kind: 'seed', points: week, refKey: `seed:${id}:week`, label: 'This week', at: S.daysAgo(2) })
  })
  return db
}

let db: DB = load()
function load(): DB {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) { const p = JSON.parse(raw) as DB; if (p.v === 1) return p }
  } catch { /* fall through */ }
  return seed()
}
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(db)) } catch { /* quota */ } }
const WEEK = 7 * 86400000

// ---------- helpers ----------
const sessionId = () => { try { const id = localStorage.getItem(SESSION); return id && db.users.some((u) => u.id === id) ? id : null } catch { return null } }
const requireMe = () => { if (!sessionId()) fail('unauthenticated', 'Please sign in again.'); return ME }
const userRow = (id: string) => db.users.find((u) => u.id === id)!
const handleOf = (u: UserRow) => u.name.toLowerCase().replace(/[^a-z]+/g, '.').replace(/^\.|\.$/g, '')
const pub = (id: string): PublicUser => { const u = userRow(id); return { id: u.id, name: u.name, handle: handleOf(u), major: u.major, year: u.year } }
const xpOf = (id: string, since = 0) => db.ledger.filter((l) => l.userId === id && l.at >= since).reduce((s, l) => s + l.points, 0)
const standings = (since = 0) => db.users.map((u) => ({ id: u.id, xp: xpOf(u.id, since) })).filter((r) => r.xp > 0).sort((a, b) => b.xp - a.xp)
const rankOf = (id: string, since = 0) => { const i = standings(since).findIndex((r) => r.id === id); return i < 0 ? 0 : i + 1 }
const hide = (authorId: string, anonymous: boolean, viewer: string) => (anonymous && authorId !== viewer ? null : pub(authorId))

/** Single choke point for points. Enforces idempotency, self-award ban, pair cap and daily cap. */
function award(userId: string, actorId: string, kind: XpKind, points: number, refKey: string, label: string): number {
  if (userId === actorId || points === 0) return 0
  if (db.ledger.some((l) => l.refKey === refKey)) return 0 // idempotent: one claim per event
  const t = Date.now()
  const pair = db.ledger.filter((l) => l.actorId === actorId && l.userId === userId && l.points > 0 && t - l.at < WEEK).length
  if (pair >= RULES.pairWeeklyCap) return 0
  const today = db.ledger.filter((l) => l.userId === userId && l.points > 0 && t - l.at < 86400000 && l.kind !== 'seed').reduce((s, l) => s + l.points, 0)
  const pts = Math.min(points, Math.max(0, RULES.dailyXpCap - today))
  if (pts <= 0) return 0
  db.ledger.push({ id: uid(), userId, actorId, kind, points: pts, refKey, label, at: t })
  return pts
}

function toThread(t: ThreadRow, viewer: string): Thread {
  return {
    id: t.id, kind: t.kind, title: t.title, body: t.body, courseCode: t.courseCode, category: t.category,
    author: hide(t.authorId, t.anonymous, viewer), mine: t.authorId === viewer, createdAt: t.createdAt, votes: t.votes,
    iVoted: db.votes.includes(`${viewer}|thread|${t.id}`), replyCount: db.replies.filter((r) => r.threadId === t.id).length, solved: t.solved,
  }
}
function toReply(r: ReplyRow, viewer: string): Reply {
  return { id: r.id, threadId: r.threadId, body: r.body, author: hide(r.authorId, r.anonymous, viewer), mine: r.authorId === viewer, createdAt: r.createdAt, votes: r.votes, iVoted: db.votes.includes(`${viewer}|reply|${r.id}`), accepted: r.accepted }
}

function castVote(actor: string, type: 'thread' | 'reply', id: string) {
  const key = `${actor}|${type}|${id}`
  if (db.votes.includes(key)) fail('already_voted', 'Votes are final. You already voted on this.')
  const P = RULES.points
  if (type === 'thread') {
    const t = db.threads.find((x) => x.id === id) ?? fail('not_found', 'Post not found.')
    if (t!.authorId === actor) fail('self_vote', 'You cannot vote on your own post.')
    db.votes.push(key); t!.votes++
    const q = t!.kind === 'question'
    award(t!.authorId, actor, q ? 'question_upvoted' : 'voice_upvoted', q ? P.questionUp : P.voiceUp, `tv:${actor}:${id}`, q ? 'Question upvoted' : 'Post upvoted')
  } else {
    const r = db.replies.find((x) => x.id === id) ?? fail('not_found', 'Reply not found.')
    if (r!.authorId === actor) fail('self_vote', 'You cannot vote on your own reply.')
    db.votes.push(key); r!.votes++
    const th = db.threads.find((x) => x.id === r!.threadId)
    if (th?.kind === 'question') award(r!.authorId, actor, 'answer_upvoted', P.answerUp, `rv:${actor}:${id}`, 'Answer upvoted')
  }
  save()
}

const clean = (s: string, max: number) => s.replace(/\s+/g, ' ').trim().slice(0, max)
const cleanBlock = (s: string, max: number) => s.replace(/\r/g, '').replace(/\n{3,}/g, '\n\n').trim().slice(0, max)

export const api = {
  rules: RULES,

  auth: {
    /** Profile (XP, rank, courses) of the signed-in student, from GET /api/me. null when there is no valid session. */
    async session(): Promise<Me | null> {
      try {
        return (await (await realHttp())<{ me: Me }>('/api/me')).me
      } catch (e) {
        if ((e as { status?: number }).status === 401) return null
        throw e
      }
    },
  },

  /**
   * Bridge between the real auth API (server/) and the parts still on the mock.
   * Login and logout happen on the server; these calls only keep the mock's "current student" in sync.
   * Remove once resources, Q&A and events have their own endpoints.
   */
  bridge: {
    attach(user: { id: string; firstName: string; lastName: string; major: string; year: number; createdAt: string }) {
      let owner: string | null = null
      try { owner = localStorage.getItem(OWNER) } catch { /* ignore */ }
      // Another student signed in on this browser: start from fresh demo data so nothing leaks between accounts.
      if (owner !== user.id) { db = seed(); try { localStorage.setItem(OWNER, user.id) } catch { /* ignore */ } }
      if (!db.users.some((u) => u.id === ME)) {
        db.users.push({ id: ME, name: `${user.firstName} ${user.lastName}`.trim(), major: user.major || 'Undeclared', year: user.year || 1, bio: '', joinedAt: Date.parse(user.createdAt) || Date.now(), role: 'student', courses: ['CS324', 'CS224', 'MATH210'] })
        db.ledger.push({ id: uid(), userId: ME, actorId: 'system', kind: 'seed', points: 40, refKey: 'seed:me', label: 'Welcome bonus', at: Date.now() })
      }
      try { localStorage.setItem(SESSION, ME) } catch { /* ignore */ }
      save()
    },
    detach() { try { localStorage.removeItem(SESSION) } catch { /* ignore */ } },
  },

  // Real server: GET /api/me, PATCH /api/me, GET /api/me/xp (server/src/routes/me.ts).
  me: {
    async get(): Promise<Me> { return (await (await realHttp())<{ me: Me }>('/api/me')).me },
    /** The name comes from the account and cannot be changed here, so it is not sent. */
    async update(p: { name?: string; major?: string; year?: number; bio?: string; courses?: string[] }): Promise<Me> {
      const body = { major: p.major === undefined ? undefined : clean(p.major, 40), year: p.year, bio: p.bio === undefined ? undefined : cleanBlock(p.bio, 240), courses: p.courses }
      return (await (await realHttp())<{ me: Me }>('/api/me', { method: 'PATCH', body })).me
    },
    async xp(): Promise<XpRow[]> { return (await (await realHttp())<{ rows: XpRow[] }>('/api/me/xp')).rows },
  },

  courses: {
    async list(): Promise<Course[]> {
      requireMe(); await sleep(80)
      // Question and resource counts come from the real server, like the questions and resources themselves.
      const http = await realHttp()
      const [{ threads }, { resources }] = await Promise.all([http<{ threads: Thread[] }>('/api/questions'), http<{ resources: Resource[] }>('/api/resources')])
      return S.COURSES.map(([code, name, dept]) => ({ code, name, dept, resources: resources.filter((r) => r.courseCode === code).length, questions: threads.filter((t) => t.courseCode === code).length }))
    },
  },

  // Real server: server/src/routes/resources.ts. It checks the file's type on its bytes, its size, its SHA-256 (duplicates),
  // the daily upload limit, and every rating rule; XP is paid there too.
  resources: {
    async list(q: ResourceQuery = {}): Promise<Resource[]> {
      const params = new URLSearchParams()
      if (q.q?.trim()) params.set('q', q.q.trim())
      if (q.course) params.set('course', q.course)
      if (q.kind) params.set('kind', q.kind)
      if (q.semester) params.set('semester', q.semester)
      if (q.sort && q.sort !== 'new') params.set('sort', q.sort)
      const qs = params.toString()
      return (await (await realHttp())<{ resources: Resource[] }>(`/api/resources${qs ? `?${qs}` : ''}`)).resources
    },
    async get(id: string): Promise<Resource> {
      return (await (await realHttp())<{ resource: Resource }>(`/api/resources/${encodeURIComponent(id)}`)).resource
    },
    /** Sent as multipart/form-data: the file in the field `file`, the details as text fields. */
    async upload(input: { file: File; title: string; description: string; courseCode: string; kind: ResourceKind; semester: 'S1' | 'S2'; academicYear: string }): Promise<Resource> {
      const { file, ...details } = input
      const form = new FormData()
      for (const [k, v] of Object.entries(details)) form.append(k, v)
      form.append('file', file, file.name)
      return (await (await realHttp())<{ resource: Resource }>('/api/resources', { method: 'POST', body: form })).resource
    },
    /**
     * Lets the browser download GET /api/resources/:id/file itself (attachment; the session cookie goes with it).
     * The server records the download, which unlocks rating. Checked first so a missing file shows a message, not a broken download.
     */
    async download(id: string): Promise<void> {
      const { http, apiUrl } = await import('./http')
      const path = `/api/resources/${encodeURIComponent(id)}`
      await http<{ resource: Resource }>(path)
      const a = Object.assign(document.createElement('a'), { href: apiUrl(`${path}/file`), download: '' })
      document.body.appendChild(a); a.click(); a.remove()
    },
    async rate(id: string): Promise<Resource> {
      return (await (await realHttp())<{ resource: Resource }>(`/api/resources/${encodeURIComponent(id)}/rate`, { method: 'POST' })).resource
    },
    async remove(id: string): Promise<void> {
      await (await realHttp())(`/api/resources/${encodeURIComponent(id)}`, { method: 'DELETE' })
    },
  },

  threads: {
    async list(kind: ThreadKind, f: { q?: string; course?: string; category?: string; sort?: 'new' | 'top'; unsolved?: boolean } = {}): Promise<Thread[]> {
      if (kind === 'question') {
        // Real server: GET /api/questions?q=&course=&sort=&unsolved=
        const params = new URLSearchParams()
        if (f.q?.trim()) params.set('q', f.q.trim())
        if (f.course) params.set('course', f.course)
        if (f.sort === 'top') params.set('sort', 'top')
        if (f.unsolved) params.set('unsolved', '1')
        const qs = params.toString()
        const { threads } = await (await realHttp())<{ threads: Thread[] }>(`/api/questions${qs ? `?${qs}` : ''}`)
        return threads
      }
      // Real server: GET /api/voice?q=&category=&sort=
      const params = new URLSearchParams()
      if (f.q?.trim()) params.set('q', f.q.trim())
      if (f.category) params.set('category', f.category)
      if (f.sort === 'top') params.set('sort', 'top')
      const qs = params.toString()
      const { threads } = await (await realHttp())<{ threads: Thread[] }>(`/api/voice${qs ? `?${qs}` : ''}`)
      return threads
    },
    async get(id: string, kind: ThreadKind = 'question'): Promise<{ thread: Thread; replies: Reply[] }> {
      if (isRealId(id)) return (await realHttp())<{ thread: Thread; replies: Reply[] }>(`${threadApi(kind)}/${id}`)
      const me = requireMe(); await sleep(100)
      const t = db.threads.find((x) => x.id === id) ?? fail('not_found', 'This post no longer exists.')
      const replies = db.replies.filter((r) => r.threadId === id).sort((a, b) => Number(b.accepted) - Number(a.accepted) || b.votes - a.votes || a.createdAt - b.createdAt)
      return { thread: toThread(t!, me), replies: replies.map((r) => toReply(r, me)) }
    },
    async create(i: { kind: ThreadKind; title: string; body: string; courseCode?: string; category?: VoiceCategory; anonymous?: boolean }): Promise<Thread> {
      const title = clean(i.title, 140), body = cleanBlock(i.body, 4000)
      if (title.length < 8) fail('bad_title', 'Title is too short (8+ characters).')
      if (body.length < 10) fail('bad_body', 'Add a little more detail (10+ characters).')
      if (i.kind === 'question' && !S.COURSES.some((c) => c[0] === i.courseCode)) fail('bad_course', 'Pick the course this question belongs to.')
      // Real server: POST /api/questions or POST /api/voice (it re-checks everything above)
      const payload = i.kind === 'question' ? { title, body, courseCode: i.courseCode } : { title, body, category: i.category ?? 'academics', anonymous: !!i.anonymous }
      const { thread } = await (await realHttp())<{ thread: Thread }>(threadApi(i.kind), { method: 'POST', body: payload })
      return thread
    },
    async vote(id: string, kind: ThreadKind = 'question'): Promise<void> {
      if (isRealId(id)) { await (await realHttp())(`${threadApi(kind)}/${id}/vote`, { method: 'POST' }); return }
      const me = requireMe(); await sleep(100); castVote(me, 'thread', id)
    },
    async reply(threadId: string, body: string, anonymous = false, kind: ThreadKind = 'question'): Promise<Reply> {
      if (isRealId(threadId)) {
        const b = cleanBlock(body, 3000)
        if (b.length < 2) fail('bad_body', 'Write something first.')
        const { reply } = await (await realHttp())<{ reply: Reply }>(`${threadApi(kind)}/${threadId}/replies`, { method: 'POST', body: kind === 'voice' ? { body: b, anonymous } : { body: b } })
        return reply
      }
      const me = requireMe(); await sleep(250)
      const t = db.threads.find((x) => x.id === threadId) ?? fail('not_found', 'Post not found.')
      const b = cleanBlock(body, 3000)
      if (b.length < 2) fail('bad_body', 'Write something first.')
      const recent = db.replies.filter((r) => r.authorId === me && Date.now() - r.createdAt < 600000).length
      if (recent >= 8) fail('rate_limited', 'Too many replies in a short time. Take a breath.')
      const row: ReplyRow = { id: 'p' + uid(), threadId: t!.id, body: b, authorId: me, anonymous: false, createdAt: Date.now(), votes: 0, accepted: false }
      db.replies.push(row); save()
      return toReply(row, me)
    },
    async voteReply(id: string, kind: ThreadKind = 'question'): Promise<void> {
      if (isRealId(id)) { await (await realHttp())(`${threadApi(kind)}/replies/${id}/vote`, { method: 'POST' }); return }
      const me = requireMe(); await sleep(100); castVote(me, 'reply', id)
    },
    async accept(replyId: string): Promise<void> {
      if (isRealId(replyId)) { await (await realHttp())(`/api/questions/replies/${replyId}/accept`, { method: 'POST' }); return }
      const me = requireMe(); await sleep(150)
      const r = db.replies.find((x) => x.id === replyId) ?? fail('not_found', 'Reply not found.')
      const t = db.threads.find((x) => x.id === r!.threadId)!
      if (t.kind !== 'question') fail('bad_request', 'Only questions have accepted answers.')
      if (t.authorId !== me) fail('forbidden', 'Only the asker can accept an answer.')
      if (t.solved) fail('already_solved', 'This question already has an accepted answer.')
      r!.accepted = true; t.solved = true
      award(r!.authorId, me, 'answer_accepted', RULES.points.accepted, `accept:${t.id}`, `Answer accepted: ${t.title}`)
      save()
    },
  },

  // Real server: server/src/routes/events.ts (it enforces every rule)
  events: {
    async list(): Promise<CampusEvent[]> { return (await (await realHttp())<{ events: CampusEvent[] }>('/api/events')).events },
    async create(i: { title: string; kind: 'event' | 'deadline' | 'club'; startsAt: number; location: string; description: string; courseCode?: string }): Promise<void> {
      await (await realHttp())('/api/events', { method: 'POST', body: i })
    },
    async toggleGoing(id: string): Promise<void> { await (await realHttp())(`/api/events/${id}/going`, { method: 'POST' }) },
  },

  // Real server: server/src/routes/rentals.ts. The owner's contact only comes back in myRequest.contact, once accepted.
  rentals: {
    async list(): Promise<RentalItem[]> { return (await (await realHttp())<{ items: RentalItem[] }>('/api/rentals')).items },
    async create(i: { title: string; category: RentalCategory; pricePerDay: number; deposit: number; condition: 'new' | 'good' | 'worn'; description: string; contact: string }): Promise<void> {
      await (await realHttp())('/api/rentals', { method: 'POST', body: i })
    },
    async request(itemId: string, from: number, to: number, note: string): Promise<void> {
      await (await realHttp())(`/api/rentals/${itemId}/requests`, { method: 'POST', body: { from, to, note } })
    },
    async incoming(): Promise<RentalRequest[]> { return (await (await realHttp())<{ requests: RentalRequest[] }>('/api/rentals/incoming')).requests },
    async respond(requestId: string, accept: boolean): Promise<void> {
      await (await realHttp())(`/api/rentals/requests/${requestId}/respond`, { method: 'POST', body: { accept } })
    },
    async markReturned(itemId: string): Promise<void> { await (await realHttp())(`/api/rentals/${itemId}/returned`, { method: 'POST' }) },
  },

  leaderboard: {
    // Real server: GET /api/leaderboard?period=week|all, built from the XP ledger.
    async get(period: 'week' | 'all'): Promise<LeaderRow[]> {
      return (await (await realHttp())<{ rows: LeaderRow[] }>(`/api/leaderboard?period=${period}`)).rows
    },
  },

  users: {
    async profile(id: string): Promise<Profile> {
      if (isRealId(id)) return (await realHttp())<Profile>(`/api/users/${id}`) // real student: GET /api/users/:id
      const me = requireMe(); await sleep(100)
      const u = db.users.find((x) => x.id === id) ?? fail('not_found', 'Student not found.')
      return {
        user: { ...pub(id), bio: u!.bio, joinedAt: u!.joinedAt, xp: xpOf(id), rank: rankOf(id) },
        resources: [], // demo students have no files: the library lives on the server
        // anonymous posts are never listed on a profile
        threads: db.threads.filter((t) => t.authorId === id && !t.anonymous).map((t) => toThread(t, me)),
        acceptedAnswers: db.replies.filter((r) => r.authorId === id && r.accepted && !r.anonymous).length,
      }
    },
  },

  dev: { reset() { localStorage.removeItem(KEY); localStorage.removeItem(SESSION); location.reload() } },
}
