import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Upload } from 'lucide-react'
import { api } from '@/api/mock'
import { useAuth } from '@/auth/AuthContext'
import { ResourceCard, ThreadCard } from '@/components/Cards'
import { Avatar, Skeleton } from '@/components/ui'
import { daysUntil, formatTime } from '@/lib/utils'

function Head({ title, to }: { title: string; to: string }) {
  return (
    <div className="mb-3 flex items-baseline justify-between"><h2 className="text-lg font-semibold tracking-tight">{title}</h2><Link to={to} className="text-sm font-medium text-muted hover:text-ink">View all</Link></div>
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
  return (
    <div className="grid gap-10">
      <header className="rise flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">{new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}</p>
          <h1 className="display mt-1 text-[2rem] sm:text-[2.5rem]">{greet}, {me.name.split(' ')[0]}</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to="/resources/new" className="btn btn-accent"><Upload size={15} />Upload resource</Link>
          <Link to="/qa/new" className="btn btn-ghost">Ask a question</Link>
          <Link to="/voice/new" className="btn btn-ghost">Post to Voice</Link>
        </div>
      </header>

      <div className="rise grid grid-cols-3 divide-x divide-line overflow-hidden rounded-xl border border-line bg-surface">
        {[[me.xp.toLocaleString(), 'Total XP'], [me.rank ? `#${me.rank}` : '—', 'Campus rank'], [`+${me.weeklyXp}`, 'This week']].map(([v, l]) => (
          <div key={l} className="px-5 py-4"><p className="num text-2xl font-semibold">{v}</p><p className="text-xs text-muted">{l}</p></div>
        ))}
      </div>

      <div className="grid gap-x-10 gap-y-10 lg:grid-cols-[1fr_17rem]">
        <div className="grid gap-10">
          <section><Head title="New in the library" to="/resources" />{res.isLoading ? <Skeleton rows={3} /> : <div className="stagger grid gap-3">{res.data?.slice(0, 4).map((r) => <ResourceCard key={r.id} r={r} />)}</div>}</section>
          <section><Head title="Questions waiting for an answer" to="/qa" />{qa.isLoading ? <Skeleton rows={2} /> : <div className="grid gap-3">{qa.data?.slice(0, 3).map((t) => <ThreadCard key={t.id} t={t} />)}</div>}</section>
          <section><Head title="Trending on Campus Voice" to="/voice" />{voice.isLoading ? <Skeleton rows={2} /> : <div className="grid gap-3">{voice.data?.slice(0, 3).map((t) => <ThreadCard key={t.id} t={t} />)}</div>}</section>
        </div>
        <aside className="grid content-start gap-8">
          <section><Head title="Top this week" to="/leaderboard" />
            <ol className="card divide-y divide-line">{board.data?.slice(0, 5).map((r) => (
              <li key={r.user.id} className="flex items-center gap-3 px-3.5 py-2.5"><span className="num w-4 text-xs text-faint">{r.rank}</span><Avatar user={r.user} size={26} />
                <Link to={`/u/${r.user.id}`} className="min-w-0 flex-1 truncate text-sm font-medium hover:underline">{r.user.name}{r.isMe && ' (you)'}</Link><span className="num text-xs text-muted">{r.xp}</span></li>))}</ol>
          </section>
          <section><Head title="Upcoming" to="/events" />
            <ul className="card divide-y divide-line">{events.data?.slice(0, 4).map((e) => (
              <li key={e.id} className="px-3.5 py-3"><p className="text-sm font-medium leading-snug">{e.title}</p><p className="mt-0.5 text-xs text-muted">{daysUntil(e.startsAt)} · {formatTime(e.startsAt)} · {e.location}</p></li>))}</ul>
          </section>
        </aside>
      </div>
    </div>
  )
}
