import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowRight, ArrowUpRight, FileText, Handshake, HelpCircle, Megaphone, Newspaper, Pin, Trophy, Upload, type LucideIcon } from 'lucide-react'
import { api } from '@/api/client'
import { useAuth } from '@/auth/AuthContext'
import { ResourceCard, ThreadCard } from '@/components/Cards'
import { Avatar, CountUp, Skeleton } from '@/components/ui'
import Calendar from '@/components/Calendar'
import Flow from '@/components/Flow'
import { cn, deptOf, formatTime, timeAgo } from '@/lib/utils'

const DAY = 86400000

/** Section title with an optional neutral icon, count and "View all" link. */
function Head({ title, to, count, icon: Icon, hue = 'blue' }: { title: string; to: string; count?: number; icon?: LucideIcon; hue?: string }) {
  return (
    <div className={cn(`hue-${hue}`, 'mb-3 flex items-center justify-between')}>
      <h2 className="flex items-center gap-2 text-base font-semibold">
        {Icon && <span className="tile size-7"><Icon size={16} /></span>}
        {title}
        {count !== undefined && <span className="num rounded-sm border border-line bg-surface px-2 text-xs font-medium text-muted">{count}</span>}
      </h2>
      <Link to={to} className="flex items-center gap-1 text-xs font-medium text-accent hover:underline">View all<ArrowRight size={12} /></Link>
    </div>
  )
}

export default function Home() {
  const { me } = useAuth()
  const res = useQuery({ queryKey: ['resources', 'home'], queryFn: () => api.resources.list({ sort: 'new' }) })
  const qa = useQuery({ queryKey: ['threads', 'question', 'all'], queryFn: () => api.threads.list('question') })
  const voice = useQuery({ queryKey: ['threads', 'voice', 'top'], queryFn: () => api.threads.list('voice', { sort: 'top' }) })
  const events = useQuery({ queryKey: ['events'], queryFn: api.events.list })
  const news = useQuery({ queryKey: ['announcements', ''], queryFn: () => api.announcements.list() })
  const courses = useQuery({ queryKey: ['courses'], queryFn: api.courses.list })
  const board = useQuery({ queryKey: ['leaderboard', 'week'], queryFn: () => api.leaderboard.get('week') })
  if (!me) return null
  const hour = new Date().getHours()
  const greet = hour < 5 ? 'Up late' : hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'
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
    <div className="grid grid-cols-1 gap-8">
      <header className="night relative overflow-hidden rounded-[14px] px-6 py-7 sm:px-8">
        <Flow className="text-[#3fb0d0] opacity-70" />
        <div className="relative flex flex-wrap items-center justify-between gap-6">
          <div className="min-w-0 max-w-xl">
            <p className="text-xs font-medium text-white/60">{new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}</p>
            <h1 className="mt-1 text-[28px] font-semibold leading-tight">{greet}, {me.name.split(' ')[0]}</h1>
            <p className="mt-2 text-sm text-white/75">{fresh > 0 ? `${fresh} new ${fresh === 1 ? 'file' : 'files'} landed in your courses this week.` : 'Nothing new in your courses this week.'} {open.length} {open.length === 1 ? 'question is' : 'questions are'} still waiting for an answer.</p>
            <div className="mt-5 flex flex-wrap gap-2">
              <Link to="/resources/new" className="btn h-9 bg-[#3fb0d0] text-[#06222c] hover:bg-[#5cc0dc]"><Upload size={16} />Share a file</Link>
              <Link to="/qa?open=1" className="btn h-9 border-white/20 bg-white/10 text-white hover:bg-white/15"><HelpCircle size={16} />Answer a question</Link>
            </div>
          </div>
          <dl className="flex gap-3">
            {([['Your XP', <CountUp value={me.xp} />], ['Rank', me.rank ? `#${me.rank}` : '-'], ['Uploads', me.uploads]] as [string, React.ReactNode][]).map(([l, v]) => (
              <div key={l} className="flex min-w-24 flex-col-reverse rounded-[10px] border border-white/12 bg-white/[.06] px-4 py-3">
                <dt className="text-xs text-white/60">{l}</dt><dd className="num text-2xl font-semibold">{v}</dd>
              </div>))}
          </dl>
        </div>
      </header>

      <section className="stagger grid grid-cols-2 gap-3 lg:grid-cols-4">
        {([
          ['/resources/new', 'Share a file', 'Notes, past exams, slides', Upload, 'blue'],
          ['/qa/new', 'Ask a question', `${open.length} waiting for answers`, HelpCircle, 'violet'],
          ['/voice/new', 'Speak up', 'Name or no name, your call', Megaphone, 'orange'],
          ['/rentals', 'Borrow something', 'Calculators, lab gear, books', Handshake, 'green'],
        ] as [string, string, string, LucideIcon, string][]).map(([to, t, sub, Icon, hue]) => (
          <Link key={to} to={to} className={cn(`hue-${hue}`, 'card card-hover group flex items-start gap-3 p-4 hover:!border-[var(--hue-line)]')}>
            <span className="tile size-9 transition-colors group-hover:bg-[var(--hue)] group-hover:text-white"><Icon size={17} /></span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-medium text-ink">{t}</span>
              <span className="mt-1 block text-xs text-muted">{sub}</span>
            </span>
            <ArrowUpRight size={16} className="shrink-0 text-faint transition-colors group-hover:text-ink" aria-hidden />
          </Link>
        ))}
      </section>

      <section>
        <Head title="Your courses" to="/resources" />
        <div className="stagger grid grid-cols-2 gap-3 lg:grid-cols-4">
          {(courses.isLoading ? [] : mine).map((c) => (
            <Link key={c.code} to={`/resources?course=${c.code}`} className="card card-hover group overflow-hidden p-4" style={{ boxShadow: `inset 0 3px 0 ${deptOf(c.dept).dot}, var(--shadow-card)` }}>
              <span className="flex items-center gap-2">
                <span className="mono rounded-[5px] px-1.5 py-0.5 text-xs font-semibold" style={{ color: deptOf(c.dept).dot, background: `color-mix(in srgb, ${deptOf(c.dept).dot} 12%, var(--surface))` }}>{c.code}</span>
                <ArrowUpRight size={14} className="ml-auto text-faint transition-colors group-hover:text-ink" aria-hidden />
              </span>
              <span className="mt-2 block truncate text-sm font-medium text-ink">{c.name}</span>
              <span className="mt-1 block text-xs text-muted">{c.resources} {c.resources === 1 ? 'file' : 'files'} · {c.questions} {c.questions === 1 ? 'question' : 'questions'}</span>
            </Link>))}
        </div>
      </section>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="grid min-w-0 grid-cols-1 content-start gap-8">
          <section className="card p-5">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div><p className="text-sm text-muted">Campus activity, last 7 days</p><p className="mt-1 text-2xl font-semibold text-heading"><CountUp value={total} /> <span className="text-sm font-normal text-muted">uploads and posts</span></p></div>
              <div className="flex gap-4 text-xs text-muted"><span className="flex items-center gap-2"><span className="size-2 rounded-full bg-accent-fill" />Uploads</span><span className="flex items-center gap-2"><span className="size-2 rounded-full bg-[#5b54c9]" />Posts</span></div>
            </div>
            <div className="mt-6 grid h-36 grid-cols-7 items-end gap-3">
              {week.map((w, i) => (
                <div key={i} className="group flex h-full flex-col items-center justify-end gap-2">
                  <div className="relative flex w-full max-w-10 flex-1 flex-col justify-end overflow-hidden rounded-sm bg-subtle">
                    <span className="bar block w-full bg-[#5b54c9]/80" style={{ height: `${(w.posts / peak) * 100}%`, animationDelay: `${i * 50}ms` }} />
                    <span className="bar block w-full bg-accent-fill" style={{ height: `${(w.up / peak) * 100}%`, animationDelay: `${i * 50}ms` }} />
                    <span className="num pointer-events-none absolute inset-x-0 top-1 text-center text-xs font-semibold text-ink opacity-0 transition group-hover:opacity-100">{w.up + w.posts}</span>
                  </div>
                  <span className={cn('text-xs', i === 6 ? 'font-semibold text-ink' : 'text-faint')}>{i === 6 ? 'Today' : w.label}</span>
                </div>
              ))}
            </div>
          </section>
          <section><Head title="Latest in the library" to="/resources" count={res.data?.length} icon={FileText} />{res.isLoading ? <Skeleton rows={4} /> : <div className="rows">{res.data?.slice(0, 5).map((r) => <ResourceCard key={r.id} r={r} />)}</div>}</section>
          <section><Head title="Waiting for an answer" to="/qa?open=1" count={open.length} icon={HelpCircle} hue="violet" />{qa.isLoading ? <Skeleton rows={2} /> : <div className="rows">{open.slice(0, 3).map((t) => <ThreadCard key={t.id} t={t} />)}</div>}</section>
          <section><Head title="Most discussed on Campus Voice" to="/voice?sort=top" icon={Megaphone} hue="orange" />{voice.isLoading ? <Skeleton rows={2} /> : <div className="rows">{voice.data?.slice(0, 3).map((t) => <ThreadCard key={t.id} t={t} />)}</div>}</section>
        </div>
        <aside className="grid min-w-0 grid-cols-1 content-start gap-8">
          <section><Head title="Announcements" to="/events" count={news.data?.length} icon={Newspaper} hue="rose" />
            <div className="card p-2">{news.isLoading ? <Skeleton rows={2} className="h-12" /> : !news.data?.length
              ? <p className="px-3 py-3 text-sm text-muted">No announcements right now. <Link to="/events?new=announcement" className="font-medium text-accent hover:underline">Post one</Link></p>
              : <ol>{news.data.slice(0, 3).map((a) => (
                <li key={a.id}><Link to="/events" className="block rounded-sm px-3 py-2 transition-colors hover:bg-hover">
                  <span className="flex items-center gap-1.5 text-sm font-medium">{a.pinned && <Pin size={12} className="hue-rose shrink-0 text-hue" aria-label="Pinned" />}<span className="truncate">{a.title}</span></span>
                  <span className="mt-0.5 block truncate text-xs text-muted">{a.courseCode ? `${a.courseCode} · ` : ''}{a.author.name} · {timeAgo(a.createdAt)}</span>
                </Link></li>))}</ol>}
            </div>
          </section>
          <section className="card p-5">
            <div className="mb-3 flex items-center justify-between"><h2 className="text-sm font-semibold">{now.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</h2><Link to="/events" className="text-xs font-medium text-accent hover:underline">Open calendar</Link></div>
            <Calendar days={evDays} />
            <ol className="mt-4 grid grid-cols-1 gap-1 border-t border-line pt-3">{events.data?.slice(0, 3).map((e) => (
              <li key={e.id} className="flex items-center gap-3 rounded-sm px-2 py-2 transition-colors hover:bg-hover">
                <span className={cn('grid size-9 shrink-0 place-content-center rounded-sm text-center', e.kind === 'deadline' ? 'bg-danger-soft text-danger' : e.kind === 'event' ? 'bg-accent-soft text-accent' : 'bg-subtle text-muted')}><span className="num text-sm font-semibold">{new Date(e.startsAt).getDate()}</span></span>
                <span className="min-w-0"><span className="block truncate text-sm font-medium">{e.title}</span><span className="text-xs text-muted">{new Date(e.startsAt).toLocaleDateString(undefined, { weekday: 'short' })}, {formatTime(e.startsAt)}</span></span>
              </li>))}</ol>
          </section>
          <section><Head title="Leaders this week" to="/leaderboard" icon={Trophy} hue="gold" />
            <div className="card p-2">
              <ol>{board.data?.slice(0, 6).map((r) => (
                <li key={r.user.id}><Link to={`/u/${r.user.id}`} className={cn('flex items-center gap-3 rounded-sm px-3 py-2 transition-colors hover:bg-hover', r.isMe && 'bg-accent-soft')}>
                  <span className={cn('num grid size-6 place-items-center rounded-full text-xs font-semibold', r.rank <= 3 ? 'bg-subtle text-ink' : 'text-faint')}>{r.rank}</span>
                  <Avatar user={r.user} size={28} /><span className="min-w-0 flex-1 truncate text-sm font-medium">{r.user.name}</span><span className="num text-xs font-medium text-muted">{r.xp}</span></Link></li>))}</ol>
            </div>
          </section>
        </aside>
      </div>
    </div>
  )
}
