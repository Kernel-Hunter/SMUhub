/**
 * Mock backend. Mirrors the future REST API: same method shapes, same rules.
 * Every rule below (caps, dedupe, ledger idempotency, self-vote ban) is the
 * reference implementation the real server must enforce. The client is never trusted.
 *
 * Exceptions, served by the real server: Q&A questions (threads of kind 'question',
 * server/src/routes/questions.ts), events (server/src/routes/events.ts) and rentals
 * (server/src/routes/rentals.ts). Campus Voice and everything else still use this mock.
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
// Real questions have 24-character database ids; the demo ones in seed.ts do not.
const isRealId = (id: string) => /^[0-9a-f]{24}$/.test(id)

type UserRow = { id: string; name: string; major: string; year: number; bio: string; joinedAt: number; role: 'student' | 'admin'; courses: string[] }
type ResRow = { id: string; title: string; description: string; courseCode: string; kind: ResourceKind; semester: 'S1' | 'S2'; academicYear: string; fileName: string; fileSize: number; ext: string; uploaderId: string; createdAt: number; downloads: number; helpful: number; verified: boolean; hash: string }
type ThreadRow = { id: string; kind: ThreadKind; title: string; body: string; courseCode?: string; category?: VoiceCategory; authorId: string; anonymous: boolean; createdAt: number; votes: number; solved: boolean }
type ReplyRow = { id: string; threadId: string; body: string; authorId: string; anonymous: boolean; createdAt: number; votes: number; accepted: boolean }
type EventRow = { id: string; title: string; kind: 'event' | 'deadline' | 'club'; startsAt: number; location: string; courseCode?: string; description: string; authorId: string; going: number }
type RentalRow = { id: string; title: string; category: RentalCategory; pricePerDay: number; deposit: number; condition: 'new' | 'good' | 'worn'; description: string; ownerId: string; available: boolean; createdAt: number; contact: string }
type ReqRow = { id: string; itemId: string; renterId: string; from: number; to: number; note: string; status: RentalRequest['status'] }
type Ledger = { id: string; userId: string; actorId: string; kind: XpKind | 'seed'; points: number; refKey: string; label: string; at: number }
type DB = {
  v: 1; users: UserRow[]; resources: ResRow[]; threads: ThreadRow[]; replies: ReplyRow[]; events: EventRow[]
  rentals: RentalRow[]; requests: ReqRow[]; votes: string[]; downloads: string[]; going: string[]; ledger: Ledger[]
}

const KEY = 'smuhub.mock.v2'
const SESSION = 'smuhub.mock.session'
const OWNER = 'smuhub.mock.owner' // id (from the real API) of the student the mock data belongs to
const ME = 'me'
const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4)
const sleep = (ms = 160) => new Promise((r) => setTimeout(r, ms + Math.random() * 120))
const files = new Map<string, Blob>() // uploaded blobs live only for this tab (mock)

function seed(): DB {
  const db: DB = { v: 1, users: [], resources: [], threads: [], replies: [], events: [], rentals: [], requests: [], votes: [], downloads: [], going: [], ledger: [] }
  S.USERS.forEach(([id, name, major, year, bio], i) => db.users.push({ id, name, major, year, bio, joinedAt: S.daysAgo(200 + i * 9), role: 'student', courses: [] }))
  S.RESOURCES.forEach(([id, title, courseCode, kind, semester, academicYear, ext, kb, up, d, downloads, helpful, description]) =>
    db.resources.push({ id, title, description, courseCode, kind, semester, academicYear, ext, fileName: `${title.replace(/[^\w]+/g, '_').slice(0, 48)}.${ext}`, fileSize: kb * 1024, uploaderId: up, createdAt: S.daysAgo(d), downloads, helpful, verified: helpful >= RULES.verifyThreshold, hash: `seed-${id}` }))
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

function toResource(r: ResRow, viewer: string): Resource {
  return {
    id: r.id, title: r.title, description: r.description, courseCode: r.courseCode, kind: r.kind, semester: r.semester,
    academicYear: r.academicYear, fileName: r.fileName, fileSize: r.fileSize, ext: r.ext, uploader: pub(r.uploaderId),
    createdAt: r.createdAt, downloads: r.downloads, helpful: r.helpful, verified: r.verified, mine: r.uploaderId === viewer,
    iVoted: db.votes.includes(`${viewer}|resource|${r.id}`), iDownloaded: db.downloads.includes(`${viewer}|${r.id}`),
  }
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
function toMe(): Me {
  const u = userRow(ME)
  return { ...pub(ME), bio: u.bio, joinedAt: u.joinedAt, role: u.role, courses: u.courses, xp: xpOf(ME), weeklyXp: xpOf(ME, Date.now() - WEEK), rank: rankOf(ME), uploads: db.resources.filter((r) => r.uploaderId === ME).length }
}

/** DEMO ONLY: simulated classmates react to what the signed-in student posts so XP flow is visible. */
function simulatePeers(type: 'resource' | 'thread', id: string) {
  const peers = S.USERS.map((u) => u[0]).sort(() => Math.random() - 0.5).slice(0, 3)
  peers.forEach((p, i) => setTimeout(() => {
    try {
      if (type === 'resource' && !db.downloads.includes(`${p}|${id}`)) { db.downloads.push(`${p}|${id}`); const r = db.resources.find((x) => x.id === id); if (r) r.downloads++ }
      castVote(p, type, id)
    } catch { /* ignore */ }
  }, 5000 + i * 4500))
}

function castVote(actor: string, type: 'resource' | 'thread' | 'reply', id: string) {
  const key = `${actor}|${type}|${id}`
  if (db.votes.includes(key)) fail('already_voted', 'Votes are final. You already voted on this.')
  const P = RULES.points
  if (type === 'resource') {
    const r = db.resources.find((x) => x.id === id) ?? fail('not_found', 'Resource not found.')
    if (r!.uploaderId === actor) fail('self_vote', 'You cannot rate your own upload.')
    if (!db.downloads.includes(`${actor}|${id}`)) fail('download_first', 'Download the file before rating it.')
    db.votes.push(key); r!.helpful++
    award(r!.uploaderId, actor, 'resource_helpful', P.helpful, `helpful:${actor}:${id}`, `Helpful: ${r!.title}`)
    if (!r!.verified && r!.helpful >= RULES.verifyThreshold) {
      r!.verified = true
      award(r!.uploaderId, 'system-verify', 'resource_verified', P.verified, `verify:${id}`, `Verified: ${r!.title}`)
    }
  } else if (type === 'thread') {
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
async function sha256(file: File) {
  const buf = await file.arrayBuffer()
  const h = await crypto.subtle.digest('SHA-256', buf)
  return [...new Uint8Array(h)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

export const api = {
  rules: RULES,

  auth: {
    /** Mock profile (XP, rank, uploads) of the student signed in through the real API. */
    async session(): Promise<Me | null> { await sleep(60); return sessionId() ? toMe() : null },
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

  me: {
    async get(): Promise<Me> { requireMe(); await sleep(80); return toMe() },
    async update(p: { name?: string; major?: string; year?: number; bio?: string; courses?: string[] }): Promise<Me> {
      requireMe(); await sleep()
      const u = userRow(ME)
      if (p.name !== undefined) u.name = clean(p.name, 50) || u.name
      if (p.major !== undefined) u.major = clean(p.major, 40) || u.major
      if (p.year !== undefined) u.year = Math.min(6, Math.max(1, Math.round(p.year)))
      if (p.bio !== undefined) u.bio = cleanBlock(p.bio, 240)
      if (p.courses) u.courses = p.courses.slice(0, 12)
      save(); return toMe()
    },
    async xp(): Promise<XpRow[]> {
      requireMe(); await sleep(80)
      return db.ledger.filter((l) => l.userId === ME && l.kind !== 'seed').sort((a, b) => b.at - a.at).slice(0, 20)
        .map((l) => ({ id: l.id, points: l.points, kind: l.kind as XpKind, label: l.label, at: l.at }))
    },
  },

  courses: {
    async list(): Promise<Course[]> {
      requireMe(); await sleep(80)
      // Question counts come from the real server, like the questions themselves.
      const { threads } = await (await realHttp())<{ threads: Thread[] }>('/api/questions')
      return S.COURSES.map(([code, name, dept]) => ({ code, name, dept, resources: db.resources.filter((r) => r.courseCode === code).length, questions: threads.filter((t) => t.courseCode === code).length }))
    },
  },

  resources: {
    async list(q: ResourceQuery = {}): Promise<Resource[]> {
      const me = requireMe(); await sleep()
      const term = (q.q ?? '').toLowerCase().trim()
      let rows = db.resources.filter((r) =>
        (!q.course || r.courseCode === q.course) && (!q.kind || r.kind === q.kind) && (!q.semester || r.semester === q.semester) &&
        (!term || `${r.title} ${r.description} ${r.courseCode}`.toLowerCase().includes(term)))
      const sort = q.sort ?? 'new'
      rows = rows.sort((a, b) => sort === 'top' ? b.helpful - a.helpful : sort === 'downloads' ? b.downloads - a.downloads : b.createdAt - a.createdAt)
      return rows.map((r) => toResource(r, me))
    },
    async get(id: string): Promise<Resource> {
      const me = requireMe(); await sleep(80)
      const r = db.resources.find((x) => x.id === id) ?? fail('not_found', 'Resource not found.')
      return toResource(r!, me)
    },
    async upload(input: { file: File; title: string; description: string; courseCode: string; kind: ResourceKind; semester: 'S1' | 'S2'; academicYear: string }): Promise<Resource> {
      const me = requireMe(); await sleep(400)
      const { file } = input
      const ext = (file.name.split('.').pop() ?? '').toLowerCase()
      if (!(RULES.allowedExt as readonly string[]).includes(ext)) fail('bad_type', `Only ${RULES.allowedExt.join(', ').toUpperCase()} files are accepted.`)
      if (file.size > RULES.maxBytes) fail('too_large', 'File is larger than 25 MB.')
      if (file.size < RULES.minBytes) fail('too_small', 'File is too small to be a real resource (min 10 KB).')
      if (!S.COURSES.some((c) => c[0] === input.courseCode)) fail('bad_course', 'Choose a valid course.')
      const title = clean(input.title, 120)
      if (title.length < 6) fail('bad_title', 'Give the resource a descriptive title (6+ characters).')
      const todayCount = db.resources.filter((r) => r.uploaderId === me && Date.now() - r.createdAt < 86400000).length
      if (todayCount >= RULES.uploadsPerDay) fail('rate_limited', `Daily upload limit reached (${RULES.uploadsPerDay}). Come back tomorrow.`)
      const hash = await sha256(file)
      if (db.resources.some((r) => r.hash === hash)) fail('duplicate', 'Someone already uploaded this exact file. Duplicates don\'t earn XP.')
      const row: ResRow = {
        id: 'r' + uid(), title, description: cleanBlock(input.description, 600), courseCode: input.courseCode, kind: input.kind, semester: input.semester,
        academicYear: input.academicYear, fileName: file.name.replace(/[^\w.\- ]+/g, '_').slice(0, 100), fileSize: file.size, ext, uploaderId: me,
        createdAt: Date.now(), downloads: 0, helpful: 0, verified: false, hash,
      }
      db.resources.unshift(row); files.set(row.id, file); save()
      simulatePeers('resource', row.id)
      return toResource(row, me)
    },
    async download(id: string): Promise<{ blob: Blob; fileName: string }> {
      const me = requireMe(); await sleep(300)
      const r = db.resources.find((x) => x.id === id) ?? fail('not_found', 'Resource not found.')
      const key = `${me}|${id}`
      if (!db.downloads.includes(key)) { db.downloads.push(key); if (r!.uploaderId !== me) r!.downloads++; save() }
      const blob = files.get(id) ?? new Blob([`SMUhub demo file\n\n${r!.title}\n(${r!.courseCode})\n\nIn production this is the real uploaded file.`], { type: 'text/plain' })
      return { blob, fileName: files.has(id) ? r!.fileName : r!.fileName.replace(/\.\w+$/, '') + '.demo.txt' }
    },
    async rate(id: string): Promise<Resource> {
      const me = requireMe(); await sleep(120)
      castVote(me, 'resource', id)
      return toResource(db.resources.find((x) => x.id === id)!, me)
    },
    async remove(id: string): Promise<void> {
      const me = requireMe(); await sleep(150)
      const i = db.resources.findIndex((x) => x.id === id)
      if (i < 0) fail('not_found', 'Resource not found.')
      const r = db.resources[i]
      if (r.uploaderId !== me && userRow(me).role !== 'admin') fail('forbidden', 'You can only delete your own uploads.')
      // Ledger is append-only: claw back earned points with a compensating row instead of editing history.
      const earned = db.ledger.filter((l) => l.userId === r.uploaderId && (l.refKey.endsWith(`:${id}`) || l.refKey === `verify:${id}`) && l.points > 0).reduce((s, l) => s + l.points, 0)
      if (earned > 0) db.ledger.push({ id: uid(), userId: r.uploaderId, actorId: 'system', kind: 'removal_penalty', points: -earned, refKey: `remove:${id}`, label: `Removed: ${r.title}`, at: Date.now() })
      db.resources.splice(i, 1); files.delete(id); save()
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
      const me = requireMe(); await sleep()
      const term = (f.q ?? '').toLowerCase().trim()
      return db.threads.filter((t) => t.kind === kind && (!f.course || t.courseCode === f.course) && (!f.category || t.category === f.category) && (!f.unsolved || !t.solved) &&
        (!term || `${t.title} ${t.body}`.toLowerCase().includes(term)))
        .sort((a, b) => (f.sort === 'top' ? b.votes - a.votes : b.createdAt - a.createdAt)).map((t) => toThread(t, me))
    },
    async get(id: string): Promise<{ thread: Thread; replies: Reply[] }> {
      if (isRealId(id)) return (await realHttp())<{ thread: Thread; replies: Reply[] }>(`/api/questions/${id}`)
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
      if (i.kind === 'question') {
        // Real server: POST /api/questions (it re-checks everything above)
        const { thread } = await (await realHttp())<{ thread: Thread }>('/api/questions', { method: 'POST', body: { title, body, courseCode: i.courseCode } })
        return thread
      }
      const me = requireMe(); await sleep(250)
      const recent = db.threads.filter((t) => t.authorId === me && Date.now() - t.createdAt < 3600000).length
      if (recent >= 5) fail('rate_limited', 'Slow down: you can post 5 times per hour.')
      // Only Campus Voice posts reach this point; questions returned above.
      const row: ThreadRow = { id: 't' + uid(), kind: 'voice', title, body, courseCode: undefined, category: i.category ?? 'academics', authorId: me, anonymous: !!i.anonymous, createdAt: Date.now(), votes: 0, solved: false }
      db.threads.unshift(row); save(); simulatePeers('thread', row.id)
      return toThread(row, me)
    },
    async vote(id: string): Promise<void> {
      if (isRealId(id)) { await (await realHttp())(`/api/questions/${id}/vote`, { method: 'POST' }); return }
      const me = requireMe(); await sleep(100); castVote(me, 'thread', id)
    },
    async reply(threadId: string, body: string, anonymous = false): Promise<Reply> {
      if (isRealId(threadId)) {
        const b = cleanBlock(body, 3000)
        if (b.length < 2) fail('bad_body', 'Write something first.')
        const { reply } = await (await realHttp())<{ reply: Reply }>(`/api/questions/${threadId}/replies`, { method: 'POST', body: { body: b } })
        return reply
      }
      const me = requireMe(); await sleep(250)
      const t = db.threads.find((x) => x.id === threadId) ?? fail('not_found', 'Post not found.')
      const b = cleanBlock(body, 3000)
      if (b.length < 2) fail('bad_body', 'Write something first.')
      const recent = db.replies.filter((r) => r.authorId === me && Date.now() - r.createdAt < 600000).length
      if (recent >= 8) fail('rate_limited', 'Too many replies in a short time. Take a breath.')
      const row: ReplyRow = { id: 'p' + uid(), threadId, body: b, authorId: me, anonymous: t!.kind === 'voice' && anonymous, createdAt: Date.now(), votes: 0, accepted: false }
      db.replies.push(row); save()
      return toReply(row, me)
    },
    async voteReply(id: string): Promise<void> {
      if (isRealId(id)) { await (await realHttp())(`/api/questions/replies/${id}/vote`, { method: 'POST' }); return }
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
    async get(period: 'week' | 'all'): Promise<LeaderRow[]> {
      const me = requireMe(); await sleep()
      const since = period === 'week' ? Date.now() - WEEK : 0
      return standings(since).slice(0, 50).map((r, i) => ({ user: pub(r.id), xp: r.xp, rank: i + 1, uploads: db.resources.filter((x) => x.uploaderId === r.id).length, isMe: r.id === me }))
    },
  },

  users: {
    async profile(id: string) {
      const me = requireMe(); await sleep(100)
      const u = db.users.find((x) => x.id === id) ?? fail('not_found', 'Student not found.')
      return {
        user: { ...pub(id), bio: u!.bio, joinedAt: u!.joinedAt, xp: xpOf(id), rank: rankOf(id) },
        resources: db.resources.filter((r) => r.uploaderId === id).map((r) => toResource(r, me)),
        // anonymous posts are never listed on a profile
        threads: db.threads.filter((t) => t.authorId === id && !t.anonymous).map((t) => toThread(t, me)),
        acceptedAnswers: db.replies.filter((r) => r.authorId === id && r.accepted && !r.anonymous).length,
      }
    },
  },

  dev: { reset() { localStorage.removeItem(KEY); localStorage.removeItem(SESSION); location.reload() } },
}
