import { Link, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { CheckCircle2, EyeOff, FileUp, MessageSquareQuote, Pencil, Trophy, Zap } from 'lucide-react'
import { api } from '@/api/mock'
import { ResourceCard, ThreadCard } from '@/components/Cards'
import { Avatar, CountUp, ErrorBox, Skeleton } from '@/components/ui'
import { cn } from '@/lib/utils'

export default function Profile() {
  const { id = '' } = useParams()
  const { data, error, isLoading } = useQuery({ queryKey: ['profile', id], queryFn: () => api.users.profile(id) })
  if (isLoading) return <Skeleton rows={3} />
  if (error || !data) return <ErrorBox error={error} />
  const { user: u } = data; const self = u.id === 'me'
  const stats: [string, React.ReactNode, typeof Zap, string][] = [
    ['XP', <CountUp value={u.xp} />, Zap, 'tone-blue'],
    ['Rank', u.rank ? `#${u.rank}` : '-', Trophy, 'tone-gold'],
    ['Uploads', data.resources.length, FileUp, 'tone-violet'],
    ['Accepted', data.acceptedAnswers, CheckCircle2, 'tone-green'],
  ]
  return (
    <div className="rise">
      <section className="card mb-6 overflow-hidden">
        <div className="hero-bg relative h-36">
          <div className="dots-light pointer-events-none absolute inset-0 opacity-60 [mask-image:linear-gradient(90deg,transparent_20%,#000)]" aria-hidden />
        </div>
        <div className="flex flex-wrap items-end gap-5 px-6 pb-6">
          <span className="-mt-12 rounded-full bg-surface p-1.5 shadow-[var(--lift)]"><Avatar user={u} size={92} /></span>
          <div className="min-w-0 flex-1 pt-3">
            <h1 className="text-[1.7rem] font-semibold tracking-[-0.025em]">{u.name}</h1>
            <p className="text-[13.5px] text-muted">{u.major} · Year {u.year} · joined {new Date(u.joinedAt).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}</p>
          </div>
          {self && <Link to="/settings" className="btn btn-ghost"><Pencil size={14} />Edit profile</Link>}
          {u.bio && <p className="w-full max-w-2xl text-[14px] leading-relaxed">{u.bio}</p>}
        </div>
      </section>

      <div className="mb-8 grid grid-cols-2 gap-3 stagger lg:grid-cols-4">
        {stats.map(([l, v, Icon, tone]) => (
          <div key={l} className={cn(tone, 'relative overflow-hidden rounded-[16px] p-4 text-white')}>
            <Icon size={16} className="text-white/80" />
            <p className="num mt-3 text-[26px] font-semibold leading-none tracking-tight">{v}</p>
            <p className="mt-1 text-[12px] text-white/80">{l}</p>
            <Icon size={70} className="pointer-events-none absolute -bottom-3 -right-3 text-white/10" aria-hidden />
          </div>
        ))}
      </div>

      <div className="grid gap-8 xl:grid-cols-2">
        <section className="min-w-0">
          <h2 className="mb-3 flex items-center gap-2.5 text-[15px] font-semibold"><span className="grid size-7 place-items-center rounded-[8px] bg-accent-soft text-accent"><FileUp size={15} /></span>Uploads<span className="num text-[12.5px] font-normal text-muted">{data.resources.length}</span></h2>
          <div className="rows">{data.resources.length ? data.resources.map((r) => <ResourceCard key={r.id} r={r} />) : <p className="px-4 py-8 text-center text-[13px] text-muted">No uploads yet.</p>}</div>
        </section>
        <section className="min-w-0">
          <h2 className="mb-3 flex items-center gap-2.5 text-[15px] font-semibold"><span className="grid size-7 place-items-center rounded-[8px] bg-violet-soft text-violet"><MessageSquareQuote size={15} /></span>Public posts<span className="num text-[12.5px] font-normal text-muted">{data.threads.length}</span></h2>
          <div className="rows">{data.threads.length ? data.threads.map((t) => <ThreadCard key={t.id} t={t} />) : <p className="px-4 py-8 text-center text-[13px] text-muted">No public posts yet.</p>}</div>
        </section>
      </div>
      <p className="mt-8 flex items-center gap-2 text-[12px] text-faint"><EyeOff size={13} />Anonymous posts never appear on profiles.</p>
    </div>
  )
}
