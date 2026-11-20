import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowRight, ArrowUpRight, FileText, Handshake, HelpCircle, Megaphone, Trophy, Upload, type LucideIcon } from 'lucide-react'
import { api } from '@/api/mock'
import { useAuth } from '@/auth/AuthContext'
import { ResourceCard, ThreadCard } from '@/components/Cards'
import { Avatar, CountUp, Skeleton } from '@/components/ui'
import Calendar from '@/components/Calendar'
import { cn, deptOf, formatTime } from '@/lib/utils'

const DAY = 86400000

function Head({ title, to, count, icon: Icon, tone }: { title: string; to: string; count?: number; icon?: LucideIcon; tone?: string }) {
  return (
    <div className="mb-3 flex items-center justify-between px-1">
      <h2 className="flex items-center text-base font-semibold">{Icon && <span className={cn('mr-3 grid size-7 place-items-center rounded-md', tone)}><Icon size={15} /></span>}{title}{count !== undefined && <span className="ml-2 rounded-full bg-surface px-2 py-1 text-xs font-medium text-muted shadow-[var(--ring)]">{count}</span>}</h2>
      <Link to={to} className="group flex items-center gap-1 text-xs font-medium text-muted hover:text-accent">View all<ArrowRight size={12} className="transition group-hover:translate-x-0.5" /></Link>
    </div>
  )
}

function Ring({ pct, level }: { pct: number; level: number }) {
  const r = 38, c = 2 * Math.PI * r
  return (
    <div className="relative size-[104px] shrink-0">
      <svg viewBox="0 0 96 96" className="size-full -rotate-90" aria-hidden>
        <circle cx="48" cy="48" r={r} fill="none" stroke="rgb(255 255 255 / .18)" strokeWidth="8" />
        <circle cx="48" cy="48" r={r} fill="none" stroke="#fff" strokeWidth="8" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - pct)} style={{ transition: 'stroke-dashoffset 1.1s cubic-bezier(.2,.8,.2,1)' }} />
      </svg>
      <span className="absolute inset-0 grid place-content-center text-center leading-none text-white"><span className="text-xs font-medium uppercase tracking-wider opacity-70">Level</span><span className="num mt-1 text-2xl font-semibold">{level}</span></span>
    </div>
  )
}

export default function Home() {
  const { me } = useAuth()
  const res = useQuery({ queryKey: ['resources', 'home'], queryFn: () => api.resources.list({ sort: 'new' }) })
  const qa = useQuery({ queryKey: ['threads', 'question', 'all'], queryFn: () => api.threads.list('question') })
  const voice = useQuery({ queryKey: ['threads', 'voice', 'top'], queryFn: () => api.threads.list('voice', { sort: 'top' }) })
  const events = useQuery({ queryKey: ['events'], queryFn: api.events.list })
  const courses = useQuery({ queryKey: ['courses'], queryFn: api.courses.list })
  const board = useQuery({ queryKey: ['leaderboard', 'week'], queryFn: () => api.leaderboard.get('week') })
  if (!me) return null
  const hour = new Date().getHours()
  const greet = hour < 5 ? 'Up late' : hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'
  const level = Math.floor(Math.sqrt(me.xp / 20)), lo = level * level * 20, hi = (level + 1) ** 2 * 20
  const fresh = (res.data ?? []).filter((r) => me.courses.includes(r.courseCode) && Date.now() - r.createdAt < 7 * DAY).length
  const open = (qa.data ?? []).filter((t) => !t.solved)

  // Campus activity: uploads and posts per day, last 7 days.
  const start = new Date(); start.setHours(0, 0, 0, 0)
  const week = Array.from({ length: 7 }, (_, i) => {
    const d0 = start.getTime() - (6 - i) * DAY
    const inDay = (t: number) => t >= d0 && t < d0 + DAY
    return { label: new Date(d0).toLocaleDateString(undefined, { weekday: 'short' }), up: (res.data ?? []).filter((r) => inDay(r.createdAt)).length, posts: [...(qa.data ?? []), ...(voice.data ?? [])].filter((t) => inDay(t.createdAt)).length }
  })
  const peak = Math.max(1, ...week.map((w) => w.up + w.posts))
  const total = week.reduce((s, w) => s + w.up + w.posts, 0)

  const mine = (courses.data ?? []).slice().sort((a, b) => Number(me.courses.includes(b.code)) - Number(me.courses.includes(a.code)) || b.resources - a.resources).slice(0, 4)
  const evDays = new Map<number, string>()
  const now = new Date()
  events.data?.forEach((e) => { const d = new Date(e.startsAt); if (d.getMonth() === now.getMonth()) evDays.set(d.getDate(), e.kind) })

  return (
    <div className="grid gap-7">
      <section className="hero-bg relative overflow-hidden rounded-lg px-6 py-7 text-white shadow-[0_24px_48px_-24px_#3b5bff] sm:px-9 sm:py-9">
        <div className="dots-light pointer-events-none absolute inset-0 opacity-60 [mask-image:linear-gradient(90deg,transparent,#000)]" aria-hidden />
        <div className="pointer-events-none absolute -right-16 -top-24 size-72 rounded-full bg-white/10 blur-2xl" aria-hidden />
        <div className="relative flex flex-wrap items-center gap-8">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-white/70">{new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}</p>
            <h1 className="mt-2 text-2xl font-semibold leading-tight sm:text-2xl">{greet}, {me.name.split(' ')[0]}</h1>
            <p className="mt-2 max-w-md text-sm text-white/80">{fresh > 0 ? `${fresh} new ${fresh === 1 ? 'file' : 'files'} landed in your courses this week.` : 'Nothing new in your courses this week.'} {open.length} {open.length === 1 ? 'question is' : 'questions are'} still waiting for an answer.</p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link to="/resources/new" className="btn h-10 bg-white px-4 text-[#1c2a8f] shadow-[0_6px_16px_-6px_rgb(0_0_0/.35)] hover:bg-white/90"><Upload size={15} />Share a file</Link>
              <Link to="/qa?open=1" className="btn h-10 bg-white/12 px-4 text-white ring-1 ring-white/25 hover:bg-white/20"><HelpCircle size={15} />Answer a question</Link>
            </div>
          </div>
          <div className="hidden items-center gap-5 rounded-lg bg-white/10 p-4 pr-6 ring-1 ring-white/20 backdrop-blur-md sm:flex">
            <Ring pct={Math.max(0.04, (me.xp - lo) / (hi - lo))} level={level} />
            <div className="leading-tight">
              <p className="text-xs text-white/70">Your XP</p>
              <p className="mt-1 text-2xl font-semibold"><CountUp value={me.xp} /></p>
              <p className="mt-1 text-xs text-white/70">{hi - me.xp} more for level {level + 1}</p>
              <p className="mt-3 inline-flex rounded-full bg-white/15 px-3 py-1 text-xs font-medium">{me.rank ? `#${me.rank} on campus` : 'Not ranked yet'}</p>
            </div>
          </div>
        </div>
      </section>

      <section className="stagger grid grid-cols-2 gap-3 lg:grid-cols-4">
        {([
          ['/resources/new', 'Share a file', 'Notes, past exams, slides', Upload, 'tone-blue'],
          ['/qa/new', 'Ask a question', `${open.length} waiting for answers`, HelpCircle, 'tone-violet'],
          ['/voice/new', 'Speak up', 'Name or no name, your call', Megaphone, 'tone-orange'],
          ['/rentals', 'Borrow something', 'Calculators, lab gear, books', Handshake, 'tone-green'],
        ] as [string, string, string, LucideIcon, string][]).map(([to, t, sub, Icon, tone]) => (
          <Link key={to} to={to} className={cn(tone, 'group relative overflow-hidden rounded-lg p-4 text-white transition hover:-translate-y-0.5')}>
            <span className="grid size-9 place-items-center rounded-md bg-white/18 ring-1 ring-white/25"><Icon size={17} /></span>
            <p className="mt-3 text-sm font-semibold">{t}</p>
            <p className="mt-1 text-xs text-white/80">{sub}</p>
            <ArrowUpRight size={16} className="absolute right-3 top-3 text-white/60 transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-white" />
            <Icon size={84} className="pointer-events-none absolute -bottom-5 -right-4 text-white/10" aria-hidden />
          </Link>
        ))}
      </section>

      <section>
        <Head title="Your courses" to="/resources" />
        <div className="stagger grid grid-cols-2 gap-4 lg:grid-cols-4">
          {(courses.isLoading ? [] : mine).map((c) => { const d = deptOf(c.dept); return (
            <Link key={c.code} to={`/resources?course=${c.code}`} className="card card-hover group overflow-hidden">
              <div className="relative h-20 overflow-hidden" style={{ background: `linear-gradient(135deg, ${d.from}, ${d.to})` }}>
                <div className="dots-light absolute inset-0 opacity-70" aria-hidden />
                <span className="num absolute bottom-3 left-4 text-lg font-semibold text-white">{c.code}</span>
                <ArrowUpRight size={16} className="absolute right-3 top-3 text-white/70 transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-white" />
              </div>
              <div className="px-4 py-3">
                <p className="truncate text-sm font-medium">{c.name}</p>
                <p className="mt-1 text-xs text-muted">{c.resources} {c.resources === 1 ? 'file' : 'files'} · {c.questions} {c.questions === 1 ? 'question' : 'questions'}</p>
              </div>
            </Link>) })}
        </div>
      </section>

      <div className="grid gap-7 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="grid min-w-0 content-start gap-7">
          <section className="card p-5">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div><p className="text-sm text-muted">Campus activity, last 7 days</p><p className="mt-1 text-2xl font-semibold"><CountUp value={total} /> <span className="text-sm font-medium text-muted">uploads and posts</span></p></div>
              <div className="flex gap-4 text-xs text-muted"><span className="flex items-center gap-2"><span className="size-2 rounded-full bg-accent" />Uploads</span><span className="flex items-center gap-2"><span className="size-2 rounded-full bg-violet" />Posts</span></div>
            </div>
            <div className="mt-6 grid h-36 grid-cols-7 items-end gap-3">
              {week.map((w, i) => (
                <div key={i} className="group flex h-full flex-col items-center justify-end gap-2">
                  <div className="relative flex w-full max-w-10 flex-1 flex-col justify-end overflow-hidden rounded-md bg-hover">
                    <span className="bar block w-full bg-violet/80" style={{ height: `${(w.posts / peak) * 100}%`, animationDelay: `${i * 50}ms` }} />
                    <span className="bar block w-full bg-accent" style={{ height: `${(w.up / peak) * 100}%`, animationDelay: `${i * 50}ms` }} />
                    <span className="num pointer-events-none absolute inset-x-0 top-1 text-center text-xs font-semibold text-ink opacity-0 transition group-hover:opacity-100">{w.up + w.posts}</span>
                  </div>
                  <span className={cn('text-xs', i === 6 ? 'font-semibold text-ink' : 'text-faint')}>{i === 6 ? 'Today' : w.label}</span>
                </div>
              ))}
            </div>
          </section>
          <section><Head title="Latest in the library" to="/resources" count={res.data?.length} icon={FileText} tone="bg-accent-soft text-accent" />{res.isLoading ? <Skeleton rows={4} /> : <div className="rows">{res.data?.slice(0, 5).map((r) => <ResourceCard key={r.id} r={r} />)}</div>}</section>
          <section><Head title="Waiting for an answer" to="/qa?open=1" count={open.length} icon={HelpCircle} tone="bg-violet-soft text-violet" />{qa.isLoading ? <Skeleton rows={2} /> : <div className="rows">{open.slice(0, 3).map((t) => <ThreadCard key={t.id} t={t} />)}</div>}</section>
          <section><Head title="Most discussed on Campus Voice" to="/voice?sort=top" icon={Megaphone} tone="bg-orange-soft text-orange" />{voice.isLoading ? <Skeleton rows={2} /> : <div className="rows">{voice.data?.slice(0, 3).map((t) => <ThreadCard key={t.id} t={t} />)}</div>}</section>
        </div>
        <aside className="grid content-start gap-7">
          <section className="card p-5">
            <div className="mb-3 flex items-center justify-between"><p className="text-sm font-semibold">{now.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</p><Link to="/events" className="text-xs font-medium text-accent hover:underline">Open calendar</Link></div>
            <Calendar days={evDays} />
            <ol className="mt-4 grid gap-1 border-t border-line pt-3">{events.data?.slice(0, 3).map((e) => (
              <li key={e.id} className="flex items-center gap-3 rounded-md px-2 py-2 transition hover:bg-hover">
                <span className={cn('grid size-9 shrink-0 place-content-center rounded-md text-center leading-none', e.kind === 'deadline' ? 'bg-rose-soft text-rose' : e.kind === 'club' ? 'bg-moss-soft text-moss' : 'bg-accent-soft text-accent')}><span className="num text-sm font-semibold">{new Date(e.startsAt).getDate()}</span></span>
                <span className="min-w-0"><span className="block truncate text-sm font-medium">{e.title}</span><span className="text-xs text-muted">{new Date(e.startsAt).toLocaleDateString(undefined, { weekday: 'short' })}, {formatTime(e.startsAt)}</span></span>
              </li>))}</ol>
          </section>
          <section><Head title="Leaders this week" to="/leaderboard" icon={Trophy} tone="bg-gold-soft text-gold" />
            <div className="card p-2">
              <ol>{board.data?.slice(0, 6).map((r) => (
                <li key={r.user.id}><Link to={`/u/${r.user.id}`} className={cn('flex items-center gap-3 rounded-md px-3 py-2 transition-colors hover:bg-hover', r.isMe && 'bg-accent-soft')}>
                  <span className={cn('num grid size-6 place-items-center rounded-full text-xs font-semibold', r.rank === 1 ? 'bg-gradient-to-br from-[#ffd36b] to-[#f2a20c] text-white shadow-[0_3px_8px_-2px_#f2a20c]' : r.rank === 2 ? 'bg-gradient-to-br from-[#e3e7ef] to-[#aab3c5] text-white' : r.rank === 3 ? 'bg-gradient-to-br from-[#f3c19b] to-[#c9773c] text-white' : 'text-faint')}>{r.rank}</span>
                  <Avatar user={r.user} size={28} /><span className="min-w-0 flex-1 truncate text-sm font-medium">{r.user.name}</span><span className="num text-xs font-medium text-muted">{r.xp}</span></Link></li>))}</ol>
            </div>
          </section>
        </aside>
      </div>
    </div>
  )
}
