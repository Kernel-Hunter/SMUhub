import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowRight, FileUp, Flame, Medal, Sparkles } from 'lucide-react'
import { api } from '@/api/mock'
import { useAuth } from '@/auth/AuthContext'
import { ResourceCard, ThreadCard } from '@/components/Cards'
import { Avatar, Skeleton } from '@/components/ui'
import { daysUntil, formatDay, formatTime } from '@/lib/utils'

function Head({ title, to, sub }: { title: string; to: string; sub?: string }) {
  return (
    <div className="mb-4 flex items-end justify-between gap-3">
      <div><h2 className="text-[17px] font-bold tracking-tight">{title}</h2>{sub && <p className="text-[13px] text-muted">{sub}</p>}</div>
      <Link to={to} className="flex shrink-0 items-center gap-1 text-[13px] font-semibold text-accent hover:underline">View all <ArrowRight size={13} /></Link>
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
  const greet = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'
  const stats = [
    { icon: Sparkles, label: 'Total XP', value: me.xp.toLocaleString(), tone: 'bg-accent-soft text-accent' },
    { icon: Medal, label: 'Campus rank', value: me.rank ? `#${me.rank}` : '—', tone: 'bg-gold-soft text-gold' },
    { icon: Flame, label: 'XP this week', value: `+${me.weeklyXp}`, tone: 'bg-rose-soft text-rose' },
    { icon: FileUp, label: 'Resources shared', value: String(me.uploads), tone: 'bg-moss-soft text-moss' },
  ]
  return (
    <div className="grid gap-9">
      <header className="rise">
        <h1 className="display text-[1.75rem] sm:text-[2rem]">{greet}, {me.name.split(' ')[0]} 👋</h1>
        <p className="mt-1 text-[15px] text-muted">Here is what is happening across SMUhub today.</p>
      </header>

      <section className="stagger grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stats.map((s) => { const I = s.icon; return (
          <div key={s.label} className="card p-5">
            <span className={`grid size-9 place-items-center rounded-[10px] ${s.tone}`}><I size={17} /></span>
            <p className="num mt-4 text-[1.65rem] font-semibold leading-none">{s.value}</p>
            <p className="mt-1.5 text-[13px] text-muted">{s.label}</p>
          </div>) })}
      </section>

      <div className="grid gap-x-8 gap-y-9 lg:grid-cols-[1fr_20rem]">
        <div className="grid gap-9">
          <section><Head title="New in the library" sub="Latest resources shared by classmates" to="/resources" />{res.isLoading ? <Skeleton rows={3} /> : <div className="stagger grid gap-3">{res.data?.slice(0, 4).map((r) => <ResourceCard key={r.id} r={r} />)}</div>}</section>
          <section><Head title="Waiting for an answer" sub="Be the one who helps" to="/qa" />{qa.isLoading ? <Skeleton rows={2} /> : <div className="grid gap-3">{qa.data?.slice(0, 3).map((t) => <ThreadCard key={t.id} t={t} />)}</div>}</section>
          <section><Head title="Trending on Campus Voice" sub="What students are talking about" to="/voice" />{voice.isLoading ? <Skeleton rows={2} /> : <div className="grid gap-3">{voice.data?.slice(0, 3).map((t) => <ThreadCard key={t.id} t={t} />)}</div>}</section>
        </div>
        <aside className="grid content-start gap-9">
          <section><Head title="Top this week" to="/leaderboard" />
            <ol className="card divide-y divide-line">{board.data?.slice(0, 5).map((r) => (
              <li key={r.user.id} className="flex items-center gap-3 px-4 py-3"><span className="num w-4 text-xs font-medium text-faint">{r.rank}</span><Avatar user={r.user} size={28} />
                <Link to={`/u/${r.user.id}`} className="min-w-0 flex-1 truncate text-[13px] font-semibold hover:text-accent">{r.user.name}{r.isMe && ' (you)'}</Link><span className="num text-xs text-muted">{r.xp}</span></li>))}</ol>
          </section>
          <section><Head title="Upcoming" to="/events" />
            <ul className="card divide-y divide-line">{events.data?.slice(0, 4).map((e) => (
              <li key={e.id} className="flex gap-3 px-4 py-3">
                <span className="grid h-11 w-11 shrink-0 place-content-center rounded-[10px] bg-accent-soft text-center text-accent"><span className="text-[10px] font-bold uppercase leading-none">{new Date(e.startsAt).toLocaleDateString(undefined, { month: 'short' })}</span><span className="num text-base font-semibold leading-tight">{new Date(e.startsAt).getDate()}</span></span>
                <span className="min-w-0"><span className="block text-[13px] font-semibold leading-snug">{e.title}</span><span className="text-xs text-muted">{daysUntil(e.startsAt)} · {formatDay(e.startsAt)}, {formatTime(e.startsAt)}</span></span></li>))}</ul>
          </section>
        </aside>
      </div>
    </div>
  )
}
