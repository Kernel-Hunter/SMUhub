import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowRight, CalendarDays, Trophy, Upload } from 'lucide-react'
import { api } from '@/api/mock'
import { useAuth } from '@/auth/AuthContext'
import { ResourceCard, ThreadCard } from '@/components/Cards'
import { Avatar, Skeleton } from '@/components/ui'
import { daysUntil, formatTime } from '@/lib/utils'

function Section({ title, to, children }: { title: string; to: string; children: React.ReactNode }) {
  return (
    <section className="rise">
      <div className="mb-4 flex items-baseline justify-between"><h2 className="display text-2xl">{title}</h2><Link to={to} className="flex items-center gap-1 text-sm font-medium text-muted hover:text-accent">See all <ArrowRight size={14} /></Link></div>
      {children}
    </section>
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
  const first = me.name.split(' ')[0]
  return (
    <div className="grid gap-12">
      <header className="rise">
        <p className="eyebrow">{new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}</p>
        <h1 className="display mt-2 text-5xl font-medium leading-[1.03] sm:text-6xl">Hey {first}, <span className="text-muted">what do you need today?</span></h1>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link to="/resources/new" className="btn btn-accent"><Upload size={16} />Share a resource</Link>
          <Link to="/qa/new" className="btn btn-ghost">Ask a question</Link>
          <Link to="/voice/new" className="btn btn-ghost">Speak up</Link>
        </div>
      </header>

      <div className="grid gap-8 lg:grid-cols-[1.6fr_1fr]">
        <div className="grid gap-12">
          <Section title="Fresh resources" to="/resources">
            {res.isLoading ? <Skeleton rows={3} /> : <div className="grid gap-3">{res.data?.slice(0, 4).map((r) => <ResourceCard key={r.id} r={r} />)}</div>}
          </Section>
          <Section title="Questions waiting for you" to="/qa">
            {qa.isLoading ? <Skeleton rows={2} /> : <div className="grid gap-3">{qa.data?.slice(0, 3).map((t) => <ThreadCard key={t.id} t={t} />)}</div>}
          </Section>
          <Section title="Hot on Campus Voice" to="/voice">
            {voice.isLoading ? <Skeleton rows={2} /> : <div className="grid gap-3">{voice.data?.slice(0, 3).map((t) => <ThreadCard key={t.id} t={t} />)}</div>}
          </Section>
        </div>

        <aside className="grid content-start gap-6">
          <div className="card rise p-5">
            <div className="mb-4 flex items-center justify-between"><h3 className="display flex items-center gap-2 text-xl"><Trophy size={18} className="text-accent" />This week</h3><Link to="/leaderboard" className="text-sm text-muted hover:text-accent">Full board</Link></div>
            <ol className="grid gap-3">
              {board.data?.slice(0, 5).map((r) => (
                <li key={r.user.id} className="flex items-center gap-3">
                  <span className="num w-5 text-sm text-faint">{r.rank}</span><Avatar user={r.user} size={30} />
                  <Link to={`/u/${r.user.id}`} className="min-w-0 flex-1 truncate text-sm font-medium hover:text-accent">{r.user.name}{r.isMe && ' (you)'}</Link>
                  <span className="num text-sm text-muted">{r.xp}</span>
                </li>
              ))}
            </ol>
          </div>
          <div className="card rise p-5">
            <div className="mb-4 flex items-center justify-between"><h3 className="display flex items-center gap-2 text-xl"><CalendarDays size={18} className="text-accent" />Coming up</h3><Link to="/events" className="text-sm text-muted hover:text-accent">All</Link></div>
            <ul className="grid gap-4">
              {events.data?.slice(0, 4).map((e) => (
                <li key={e.id} className="flex gap-3">
                  <span className="w-16 shrink-0 text-xs font-semibold uppercase tracking-wide text-accent">{daysUntil(e.startsAt)}</span>
                  <span className="min-w-0"><span className="block truncate text-sm font-medium">{e.title}</span><span className="text-xs text-muted">{formatTime(e.startsAt)} · {e.location}</span></span>
                </li>
              ))}
            </ul>
          </div>
        </aside>
      </div>
    </div>
  )
}
