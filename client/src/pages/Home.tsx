import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowUpRight, HelpCircle, Megaphone, Search, Upload } from 'lucide-react'
import { api } from '@/api/mock'
import { useAuth } from '@/auth/AuthContext'
import { ResourceCard, ThreadCard } from '@/components/Cards'
import { Avatar, Skeleton } from '@/components/ui'
import { daysUntil, formatTime } from '@/lib/utils'

function Head({ title, to }: { title: string; to: string }) {
  return <div className="mb-3 flex items-baseline justify-between"><h2 className="text-[15px] font-semibold tracking-tight">{title}</h2><Link to={to} className="flex items-center gap-0.5 text-[13px] text-muted hover:text-ink">View all <ArrowUpRight size={13} /></Link></div>
}

function Ring({ pct, level }: { pct: number; level: number }) {
  const r = 44, c = 2 * Math.PI * r
  return (
    <svg viewBox="0 0 108 108" className="size-28 shrink-0 -rotate-90" aria-hidden>
      <circle cx="54" cy="54" r={r} fill="none" stroke="var(--line-strong)" strokeWidth="7" />
      <circle cx="54" cy="54" r={r} fill="none" stroke="url(#ring)" strokeWidth="7" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - pct)} style={{ transition: 'stroke-dashoffset .8s cubic-bezier(.2,.7,.2,1)' }} />
      <defs><linearGradient id="ring" x1="0" y1="0" x2="1" y2="1"><stop stopColor="var(--accent)" /><stop offset="1" stopColor="#ff4d6d" /></linearGradient></defs>
      <text x="54" y="54" transform="rotate(90 54 54)" textAnchor="middle" dominantBaseline="central" fill="var(--ink)" fontSize="26" fontWeight="600" fontFamily="var(--font-mono)">{level}</text>
    </svg>
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
  const level = Math.floor(Math.sqrt(me.xp / 20)), lo = level * level * 20, hi = (level + 1) ** 2 * 20
  const pct = Math.max(0.03, (me.xp - lo) / (hi - lo))
  const openSearch = () => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true }))
  return (
    <div className="grid gap-12">
      <header className="rise pt-4 text-center">
        <p className="mx-auto inline-flex items-center gap-2 rounded-full border border-line-strong bg-[var(--hi)] px-3 py-1 text-xs text-muted"><span className="size-1.5 rounded-full bg-moss shadow-[0_0_8px_var(--moss)]" />{res.data?.length ?? '…'} resources from classmates</p>
        <h1 className="display gradient-text mx-auto mt-5 max-w-3xl text-[clamp(2.6rem,6.5vw,4.6rem)]">{greet}, {me.name.split(' ')[0]}.</h1>
        <p className="mx-auto mt-4 max-w-md text-[15px] text-muted">Find what you need, ask anything, and help someone pass.</p>
        <button onClick={openSearch} className="glass mx-auto mt-8 flex h-12 w-full max-w-lg items-center gap-3 rounded-full border border-line-strong px-5 text-left text-[14px] text-faint shadow-[0_8px_40px_-12px_var(--glow)] transition hover:border-faint"><Search size={16} />Search resources, questions, courses<span className="kbd ml-auto">⌘K</span></button>
      </header>

      <section className="stagger grid gap-4 md:grid-cols-3">
        <div className="card flex items-center gap-6 p-6 md:col-span-2">
          <Ring pct={pct} level={level} />
          <div className="min-w-0 flex-1">
            <p className="eyebrow">Your contribution</p>
            <p className="num mt-1 text-4xl font-medium">{me.xp.toLocaleString()}<span className="ml-1.5 text-base text-faint">XP</span></p>
            <p className="mt-1 text-[13px] text-muted">{hi - me.xp} XP to level {level + 1}</p>
            <div className="mt-4 flex gap-6 text-[13px]"><span><span className="num font-medium">{me.rank ? `#${me.rank}` : '—'}</span> <span className="text-muted">campus rank</span></span><span><span className="num font-medium">+{me.weeklyXp}</span> <span className="text-muted">this week</span></span><span><span className="num font-medium">{me.uploads}</span> <span className="text-muted">uploads</span></span></div>
          </div>
        </div>
        <div className="card grid divide-y divide-line">
          {[[Upload, 'Upload a resource', 'Earn XP when it helps', '/resources/new'], [HelpCircle, 'Ask a question', 'Get answers from peers', '/qa/new'], [Megaphone, 'Post to Campus Voice', 'Anonymous if you want', '/voice/new']].map(([Icon, t, d, to]) => {
            const I = Icon as typeof Upload
            return <Link key={to as string} to={to as string} className="group flex items-center gap-3 px-5 py-3.5 transition hover:bg-line"><span className="grid size-8 place-items-center rounded-lg bg-accent-soft text-accent"><I size={15} /></span><span className="min-w-0 flex-1"><span className="block text-[13px] font-medium">{t as string}</span><span className="block text-xs text-muted">{d as string}</span></span><ArrowUpRight size={14} className="text-faint transition group-hover:text-ink" /></Link>
          })}
        </div>
      </section>

      <div className="grid gap-x-8 gap-y-12 lg:grid-cols-[1fr_19rem]">
        <div className="grid gap-12">
          <section><Head title="New in the library" to="/resources" />{res.isLoading ? <Skeleton rows={3} /> : <div className="stagger grid gap-3">{res.data?.slice(0, 4).map((r) => <ResourceCard key={r.id} r={r} />)}</div>}</section>
          <section><Head title="Waiting for an answer" to="/qa" />{qa.isLoading ? <Skeleton rows={2} /> : <div className="grid gap-3">{qa.data?.slice(0, 3).map((t) => <ThreadCard key={t.id} t={t} />)}</div>}</section>
          <section><Head title="Trending on Campus Voice" to="/voice" />{voice.isLoading ? <Skeleton rows={2} /> : <div className="grid gap-3">{voice.data?.slice(0, 3).map((t) => <ThreadCard key={t.id} t={t} />)}</div>}</section>
        </div>
        <aside className="grid content-start gap-10">
          <section><Head title="Top this week" to="/leaderboard" />
            <ol className="card divide-y divide-line">{board.data?.slice(0, 5).map((r) => (
              <li key={r.user.id} className="flex items-center gap-3 px-4 py-2.5"><span className="num w-4 text-xs text-faint">{r.rank}</span><Avatar user={r.user} size={26} />
                <Link to={`/u/${r.user.id}`} className="min-w-0 flex-1 truncate text-[13px] font-medium hover:underline">{r.user.name}{r.isMe && ' (you)'}</Link><span className="num text-xs text-muted">{r.xp}</span></li>))}</ol>
          </section>
          <section><Head title="Coming up" to="/events" />
            <ul className="card divide-y divide-line">{events.data?.slice(0, 4).map((e) => (
              <li key={e.id} className="px-4 py-3"><p className="text-[13px] font-medium leading-snug">{e.title}</p><p className="mt-0.5 text-xs text-muted">{daysUntil(e.startsAt)} · {formatTime(e.startsAt)} · {e.location}</p></li>))}</ul>
          </section>
        </aside>
      </div>
    </div>
  )
}
