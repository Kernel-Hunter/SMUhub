import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowRight, CalendarClock } from 'lucide-react'
import { api } from '@/api/mock'
import { useAuth } from '@/auth/AuthContext'
import { ResourceCard, ThreadCard } from '@/components/Cards'
import { Avatar, Skeleton } from '@/components/ui'
import { cn, daysUntil, formatDay, formatTime } from '@/lib/utils'

function Head({ title, to, count }: { title: string; to: string; count?: number }) {
  return (
    <div className="mb-2.5 flex items-center justify-between px-0.5">
      <h2 className="text-[13.5px] font-semibold">{title}{count !== undefined && <span className="ml-1.5 font-normal text-faint">{count}</span>}</h2>
      <Link to={to} className="group flex items-center gap-1 text-[12.5px] text-muted hover:text-ink">View all<ArrowRight size={12} className="transition group-hover:translate-x-0.5" /></Link>
    </div>
  )
}

export default function Home() {
  const { me } = useAuth()
  const res = useQuery({ queryKey: ['resources', 'home'], queryFn: () => api.resources.list({ sort: 'new' }) })
  const voice = useQuery({ queryKey: ['threads', 'voice', 'home'], queryFn: () => api.threads.list('voice', { sort: 'top' }) })
  const qa = useQuery({ queryKey: ['threads', 'question', 'home'], queryFn: () => api.threads.list('question', { unsolved: true }) })
  const events = useQuery({ queryKey: ['events'], queryFn: api.events.list })
  const board = useQuery({ queryKey: ['leaderboard', 'week'], queryFn: () => api.leaderboard.get('week') })
  if (!me) return null
  const hour = new Date().getHours()
  const greet = hour < 5 ? 'Up late' : hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'
  const level = Math.floor(Math.sqrt(me.xp / 20)), hi = (level + 1) ** 2 * 20
  const next = events.data?.find((e) => e.kind === 'deadline')
  const metrics = [
    ['Total XP', me.xp.toLocaleString(), `${hi - me.xp} to level ${level + 1}`],
    ['Campus rank', me.rank ? `#${me.rank}` : 'None yet', 'all time'],
    ['This week', `+${me.weeklyXp}`, 'XP in the last 7 days'],
    ['Shared', String(me.uploads), me.uploads === 1 ? 'resource' : 'resources'],
  ]
  return (
    <div className="grid gap-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">{new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}</p>
          <h1 className="display mt-1 text-[1.75rem]">{greet}, {me.name.split(' ')[0]}</h1>
        </div>
        {next && (
          <Link to="/events" className="group flex items-center gap-3 rounded-[10px] bg-surface py-2 pl-2 pr-3.5 shadow-[var(--ring)] transition hover:shadow-[var(--lift)]">
            <span className="grid size-8 place-items-center rounded-[7px] bg-rose-soft text-rose"><CalendarClock size={15} /></span>
            <span className="leading-tight"><span className="block text-[12px] text-muted">Next deadline · {daysUntil(next.startsAt).toLowerCase()}</span><span className="block text-[13px] font-medium">{next.title}</span></span>
          </Link>
        )}
      </header>

      <section className="card grid grid-cols-2 lg:grid-cols-4">
        {metrics.map(([l, v, c], i) => (
          <div key={l} className={cn('px-5 py-4', i % 2 === 1 && 'border-l border-line', i > 1 && 'border-t border-line lg:border-t-0', i === 2 && 'lg:border-l')}>
            <p className="text-[12.5px] text-muted">{l}</p>
            <p className="num mt-1.5 text-[22px] font-semibold tracking-[-0.02em]">{v}</p>
            <p className="mt-0.5 text-[12px] text-faint">{c}</p>
          </div>
        ))}
      </section>

      <div className="grid gap-x-8 gap-y-8 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="grid min-w-0 content-start gap-8">
          <section><Head title="Latest in the library" to="/resources" count={res.data?.length} />{res.isLoading ? <Skeleton rows={4} /> : <div className="rows">{res.data?.slice(0, 5).map((r) => <ResourceCard key={r.id} r={r} />)}</div>}</section>
          <section><Head title="Questions without an answer" to="/qa?open=1" count={qa.data?.length} />{qa.isLoading ? <Skeleton rows={2} /> : <div className="rows">{qa.data?.slice(0, 3).map((t) => <ThreadCard key={t.id} t={t} />)}</div>}</section>
          <section><Head title="Most discussed on Campus Voice" to="/voice?sort=top" />{voice.isLoading ? <Skeleton rows={2} /> : <div className="rows">{voice.data?.slice(0, 3).map((t) => <ThreadCard key={t.id} t={t} />)}</div>}</section>
        </div>
        <aside className="grid content-start gap-8">
          <section><Head title="Leaders this week" to="/leaderboard" />
            <ol className="rows">{board.data?.slice(0, 5).map((r) => (
              <li key={r.user.id}><Link to={`/u/${r.user.id}`} className={cn('flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-hover', r.isMe && 'bg-accent-soft')}>
                <span className={cn('num grid size-5 place-items-center rounded-full text-[11px] font-semibold', r.rank === 1 ? 'bg-gold-soft text-gold' : r.rank <= 3 ? 'bg-hover text-ink' : 'text-faint')}>{r.rank}</span>
                <Avatar user={r.user} size={24} /><span className="min-w-0 flex-1 truncate text-[13px] font-medium">{r.user.name}</span><span className="num text-[12.5px] text-muted">{r.xp} XP</span></Link></li>))}</ol>
          </section>
          <section><Head title="Coming up" to="/events" />
            <ol className="card px-4 py-1">{events.data?.slice(0, 5).map((e, i, a) => (
              <li key={e.id} className="relative flex gap-3.5 py-3">
                {i < a.length - 1 && <span className="absolute left-[3.5px] top-[22px] h-[calc(100%-10px)] w-px bg-line-strong" aria-hidden />}
                <span className={cn('mt-[7px] size-2 shrink-0 rounded-full ring-4 ring-surface', e.kind === 'deadline' ? 'bg-rose' : e.kind === 'club' ? 'bg-moss' : 'bg-accent')} />
                <span className="min-w-0"><span className="block text-[13px] font-medium leading-snug">{e.title}</span><span className="text-[12px] text-muted">{formatDay(e.startsAt)}, {formatTime(e.startsAt)}</span></span>
              </li>))}</ol>
          </section>
        </aside>
      </div>
    </div>
  )
}
