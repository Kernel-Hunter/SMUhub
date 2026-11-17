import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/api/mock'
import { useAuth } from '@/auth/AuthContext'
import { ResourceCard, ThreadCard } from '@/components/Cards'
import { Avatar, Skeleton } from '@/components/ui'
import { daysUntil, formatTime } from '@/lib/utils'

function Head({ n, title, to }: { n: string; title: string; to: string }) {
  return (
    <div className="mb-5 flex items-baseline justify-between">
      <h2 className="display text-3xl" data-n={n}>{title}</h2>
      <Link to={to} className="text-sm font-semibold text-cobalt hover:underline">See all →</Link>
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
  const greet = hour < 12 ? 'Morning' : hour < 18 ? 'Afternoon' : 'Evening'
  const [lead, ...rest] = res.data ?? []
  return (
    <div className="grid gap-16">
      <header className="rise">
        <p className="eyebrow">{new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}</p>
        <h1 className="display mt-4 text-[clamp(3rem,8vw,6.5rem)]">{greet}, <em>{me.name.split(' ')[0]}</em>.<br /><span className="text-muted">What do you need?</span></h1>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link to="/resources/new" className="btn btn-accent">Share a resource</Link>
          <Link to="/qa/new" className="btn btn-ghost">Ask a question</Link>
          <Link to="/voice/new" className="btn btn-ghost">Speak up</Link>
        </div>
      </header>

      <div className="grid gap-x-12 gap-y-16 lg:grid-cols-[1fr_20rem]">
        <section>
          <Head n="01" title="Fresh in the library" to="/resources" />
          {res.isLoading ? <Skeleton rows={3} /> : (
            <div className="stagger grid gap-5 sm:grid-cols-2">
              {lead && <div className="sm:col-span-2"><ResourceCard r={lead} lead /></div>}
              {rest.slice(0, 4).map((r) => <ResourceCard key={r.id} r={r} />)}
            </div>
          )}
        </section>

        <aside className="grid content-start gap-12 ">
          <section>
            <Head n="02" title="Top this week" to="/leaderboard" />
            <ol className="card grid p-2">
              {board.data?.slice(0, 5).map((r) => (
                <li key={r.user.id} className="flex items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-paper">
                  <span className="display w-6 text-2xl text-cobalt">{r.rank}</span><Avatar user={r.user} size={28} />
                  <Link to={`/u/${r.user.id}`} className="min-w-0 flex-1 truncate text-sm font-semibold hover:underline">{r.user.name}{r.isMe && ' (you)'}</Link>
                  <span className="num text-sm text-muted">{r.xp}</span>
                </li>
              ))}
            </ol>
          </section>
          <section>
            <Head n="03" title="Coming up" to="/events" />
            <ul className="card grid gap-4 p-5">
              {events.data?.slice(0, 4).map((e) => (
                <li key={e.id} className="flex gap-3">
                  <span className="grid w-12 shrink-0 place-items-center arch bg-cobalt-soft pb-1.5 pt-3 text-cobalt"><span className="text-[10px] font-bold uppercase tracking-wider">{new Date(e.startsAt).toLocaleDateString(undefined, { month: 'short' })}</span><span className="display text-2xl leading-none">{new Date(e.startsAt).getDate()}</span></span>
                  <span className="min-w-0"><span className="block text-sm font-semibold leading-snug">{e.title}</span><span className="num text-[11px] uppercase text-muted">{daysUntil(e.startsAt)} · {formatTime(e.startsAt)}</span></span>
                </li>
              ))}
            </ul>
          </section>
        </aside>
      </div>

      <div className="grid gap-x-12 gap-y-16 lg:grid-cols-2">
        <section><Head n="04" title="Unanswered" to="/qa" />{qa.isLoading ? <Skeleton rows={2} /> : <div className="grid gap-3">{qa.data?.slice(0, 3).map((t) => <ThreadCard key={t.id} t={t} />)}</div>}</section>
        <section><Head n="05" title="Campus Voice" to="/voice" />{voice.isLoading ? <Skeleton rows={2} /> : <div className="grid gap-3">{voice.data?.slice(0, 3).map((t) => <ThreadCard key={t.id} t={t} />)}</div>}</section>
      </div>
    </div>
  )
}
