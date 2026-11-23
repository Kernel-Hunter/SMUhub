/**
 * Typed client for the SMUhub REST API (server/). Every method calls one endpoint through http.ts,
 * so pages never build URLs or parse responses themselves. The server enforces every rule (caps,
 * dedupe, ledger idempotency, self-vote ban); the few checks here only give a faster message.
 *
 * Routes, all under server/src/routes: me.ts, resources.ts, questions.ts (threads of kind 'question'),
 * voice.ts (threads of kind 'voice'), events.ts, rentals.ts, leaderboard.ts and users.ts.
 */
import { RULES } from './rules'
import { COURSES } from './courses'
import { ApiError, apiUrl, http } from './http'
import type {
  Course, LeaderRow, Me, PublicUser, Reply, Resource, ResourceKind, ResourceQuery, Thread,
  ThreadKind, VoiceCategory, CampusEvent, RentalCategory, RentalItem, RentalRequest, XpRow,
} from './types'

export { ApiError }
const fail = (code: string, msg: string): never => { throw new ApiError(code, msg) }

// An id does not say which kind of thread it is, so the caller passes the kind.
const threadApi = (kind: ThreadKind) => (kind === 'voice' ? '/api/voice' : '/api/questions')

/** Public profile, as returned by GET /api/users/:id. */
export type Profile = {
  user: PublicUser & { bio: string; joinedAt: number; xp: number; rank: number }
  resources: Resource[]
  threads: Thread[]
  acceptedAnswers: number
}

const clean = (s: string, max: number) => s.replace(/\s+/g, ' ').trim().slice(0, max)
const cleanBlock = (s: string, max: number) => s.replace(/\r/g, '').replace(/\n{3,}/g, '\n\n').trim().slice(0, max)

export const api = {
  rules: RULES,

  auth: {
    /** Profile (XP, rank, courses) of the signed-in student, from GET /api/me. null when there is no valid session. */
    async session(): Promise<Me | null> {
      try {
        return (await http<{ me: Me }>('/api/me')).me
      } catch (e) {
        if ((e as { status?: number }).status === 401) return null
        throw e
      }
    },
  },

  // GET /api/me, PATCH /api/me, GET /api/me/xp (server/src/routes/me.ts).
  me: {
    async get(): Promise<Me> { return (await http<{ me: Me }>('/api/me')).me },
    /** The name comes from the account and cannot be changed here, so it is not sent. */
    async update(p: { name?: string; major?: string; year?: number; bio?: string; courses?: string[] }): Promise<Me> {
      const body = { major: p.major === undefined ? undefined : clean(p.major, 40), year: p.year, bio: p.bio === undefined ? undefined : cleanBlock(p.bio, 240), courses: p.courses }
      return (await http<{ me: Me }>('/api/me', { method: 'PATCH', body })).me
    },
    async xp(): Promise<XpRow[]> { return (await http<{ rows: XpRow[] }>('/api/me/xp')).rows },
  },

  courses: {
    async list(): Promise<Course[]> {
      // The catalogue is fixed (courses.ts); question and resource counts come from the server.
      const [{ threads }, { resources }] = await Promise.all([http<{ threads: Thread[] }>('/api/questions'), http<{ resources: Resource[] }>('/api/resources')])
      return COURSES.map(([code, name, dept]) => ({ code, name, dept, resources: resources.filter((r) => r.courseCode === code).length, questions: threads.filter((t) => t.courseCode === code).length }))
    },
  },

  // server/src/routes/resources.ts. It checks the file's type on its bytes, its size, its SHA-256 (duplicates),
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
      return (await http<{ resources: Resource[] }>(`/api/resources${qs ? `?${qs}` : ''}`)).resources
    },
    async get(id: string): Promise<Resource> {
      return (await http<{ resource: Resource }>(`/api/resources/${encodeURIComponent(id)}`)).resource
    },
    /** Sent as multipart/form-data: the file in the field `file`, the details as text fields. */
    async upload(input: { file: File; title: string; description: string; courseCode: string; kind: ResourceKind; semester: 'S1' | 'S2'; academicYear: string }): Promise<Resource> {
      const { file, ...details } = input
      const form = new FormData()
      for (const [k, v] of Object.entries(details)) form.append(k, v)
      form.append('file', file, file.name)
      return (await http<{ resource: Resource }>('/api/resources', { method: 'POST', body: form })).resource
    },
    /**
     * Lets the browser download GET /api/resources/:id/file itself (attachment; the session cookie goes with it).
     * The server records the download, which unlocks rating. Checked first so a missing file shows a message, not a broken download.
     */
    async download(id: string): Promise<void> {
      const path = `/api/resources/${encodeURIComponent(id)}`
      await http<{ resource: Resource }>(path)
      const a = Object.assign(document.createElement('a'), { href: apiUrl(`${path}/file`), download: '' })
      document.body.appendChild(a); a.click(); a.remove()
    },
    async rate(id: string): Promise<Resource> {
      return (await http<{ resource: Resource }>(`/api/resources/${encodeURIComponent(id)}/rate`, { method: 'POST' })).resource
    },
    async remove(id: string): Promise<void> {
      await http(`/api/resources/${encodeURIComponent(id)}`, { method: 'DELETE' })
    },
  },

  threads: {
    async list(kind: ThreadKind, f: { q?: string; course?: string; category?: string; sort?: 'new' | 'top'; unsolved?: boolean } = {}): Promise<Thread[]> {
      if (kind === 'question') {
        // GET /api/questions?q=&course=&sort=&unsolved=
        const params = new URLSearchParams()
        if (f.q?.trim()) params.set('q', f.q.trim())
        if (f.course) params.set('course', f.course)
        if (f.sort === 'top') params.set('sort', 'top')
        if (f.unsolved) params.set('unsolved', '1')
        const qs = params.toString()
        const { threads } = await http<{ threads: Thread[] }>(`/api/questions${qs ? `?${qs}` : ''}`)
        return threads
      }
      // GET /api/voice?q=&category=&sort=
      const params = new URLSearchParams()
      if (f.q?.trim()) params.set('q', f.q.trim())
      if (f.category) params.set('category', f.category)
      if (f.sort === 'top') params.set('sort', 'top')
      const qs = params.toString()
      const { threads } = await http<{ threads: Thread[] }>(`/api/voice${qs ? `?${qs}` : ''}`)
      return threads
    },
    async get(id: string, kind: ThreadKind = 'question'): Promise<{ thread: Thread; replies: Reply[] }> {
      return http<{ thread: Thread; replies: Reply[] }>(`${threadApi(kind)}/${id}`)
    },
    async create(i: { kind: ThreadKind; title: string; body: string; courseCode?: string; category?: VoiceCategory; anonymous?: boolean }): Promise<Thread> {
      const title = clean(i.title, 140), body = cleanBlock(i.body, 4000)
      if (title.length < 8) fail('bad_title', 'Title is too short (8+ characters).')
      if (body.length < 10) fail('bad_body', 'Add a little more detail (10+ characters).')
      if (i.kind === 'question' && !COURSES.some((c) => c[0] === i.courseCode)) fail('bad_course', 'Pick the course this question belongs to.')
      // POST /api/questions or POST /api/voice (it re-checks everything above)
      const payload = i.kind === 'question' ? { title, body, courseCode: i.courseCode } : { title, body, category: i.category ?? 'academics', anonymous: !!i.anonymous }
      const { thread } = await http<{ thread: Thread }>(threadApi(i.kind), { method: 'POST', body: payload })
      return thread
    },
    async vote(id: string, kind: ThreadKind = 'question'): Promise<void> {
      await http(`${threadApi(kind)}/${id}/vote`, { method: 'POST' })
    },
    async reply(threadId: string, body: string, anonymous = false, kind: ThreadKind = 'question'): Promise<Reply> {
      const b = cleanBlock(body, 3000)
      if (b.length < 2) fail('bad_body', 'Write something first.')
      const { reply } = await http<{ reply: Reply }>(`${threadApi(kind)}/${threadId}/replies`, { method: 'POST', body: kind === 'voice' ? { body: b, anonymous } : { body: b } })
      return reply
    },
    async voteReply(id: string, kind: ThreadKind = 'question'): Promise<void> {
      await http(`${threadApi(kind)}/replies/${id}/vote`, { method: 'POST' })
    },
    async accept(replyId: string): Promise<void> {
      await http(`/api/questions/replies/${replyId}/accept`, { method: 'POST' })
    },
  },

  // server/src/routes/events.ts (it enforces every rule)
  events: {
    async list(): Promise<CampusEvent[]> { return (await http<{ events: CampusEvent[] }>('/api/events')).events },
    async create(i: { title: string; kind: 'event' | 'deadline' | 'club'; startsAt: number; location: string; description: string; courseCode?: string }): Promise<void> {
      await http('/api/events', { method: 'POST', body: i })
    },
    async toggleGoing(id: string): Promise<void> { await http(`/api/events/${id}/going`, { method: 'POST' }) },
  },

  // server/src/routes/rentals.ts. The owner's contact only comes back in myRequest.contact, once accepted.
  rentals: {
    async list(): Promise<RentalItem[]> { return (await http<{ items: RentalItem[] }>('/api/rentals')).items },
    async create(i: { title: string; category: RentalCategory; pricePerDay: number; deposit: number; condition: 'new' | 'good' | 'worn'; description: string; contact: string }): Promise<void> {
      await http('/api/rentals', { method: 'POST', body: i })
    },
    async request(itemId: string, from: number, to: number, note: string): Promise<void> {
      await http(`/api/rentals/${itemId}/requests`, { method: 'POST', body: { from, to, note } })
    },
    async incoming(): Promise<RentalRequest[]> { return (await http<{ requests: RentalRequest[] }>('/api/rentals/incoming')).requests },
    async respond(requestId: string, accept: boolean): Promise<void> {
      await http(`/api/rentals/requests/${requestId}/respond`, { method: 'POST', body: { accept } })
    },
    async markReturned(itemId: string): Promise<void> { await http(`/api/rentals/${itemId}/returned`, { method: 'POST' }) },
  },

  leaderboard: {
    // GET /api/leaderboard?period=week|all, built from the XP ledger.
    async get(period: 'week' | 'all'): Promise<LeaderRow[]> {
      return (await http<{ rows: LeaderRow[] }>(`/api/leaderboard?period=${period}`)).rows
    },
  },

  users: {
    // GET /api/users/:id
    async profile(id: string): Promise<Profile> { return http<Profile>(`/api/users/${id}`) },
  },
}
