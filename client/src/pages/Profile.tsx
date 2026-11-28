import { Link, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { CheckCircle2, EyeOff, FileUp, MessageSquareQuote, Pencil, Trophy, Zap } from 'lucide-react'
import { api } from '@/api/client'
import { useAuth } from '@/auth/AuthContext'
import { ResourceCard, ThreadCard } from '@/components/Cards'
import { Avatar, CountUp, ErrorBox, Skeleton } from '@/components/ui'
import { cn } from '@/lib/utils'

export default function Profile() {
  const { id = '' } = useParams()
  const { me } = useAuth()
  const { data, error, isLoading } = useQuery({ queryKey: ['profile', id], queryFn: () => api.users.profile(id) })
  if (isLoading) return <Skeleton rows={3} />
  if (error || !data) return <ErrorBox error={error} />
  const { user: u } = data; const self = u.id === 'me' || u.id === me?.id
  const stats: [string, React.ReactNode, typeof Zap, string][] = [
    ['XP', <CountUp value={u.xp} />, Zap, ''],
    ['Rank', u.rank ? `#${u.rank}` : '-', Trophy, ''],
    ['Uploads', data.resources.length, FileUp, ''],
    ['Accepted', data.acceptedAnswers, CheckCircle2, ''],
  ]
  return (
    <div className="rise">
      <section className="card mb-6 overflow-hidden">
        <div className="flex flex-wrap items-center gap-5 p-6">
          <Avatar user={u} size={72} />
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-medium">{u.name}</h1>
            <p className="text-sm text-muted">{u.major}, year {u.year}, joined {new Date(u.joinedAt).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}</p>
          </div>
          {self && <Link to="/settings" className="btn btn-secondary"><Pencil size={14} />Edit profile</Link>}
          {u.bio && <div className="basis-full"><p className="max-w-2xl text-sm leading-relaxed">{u.bio}</p></div>}
        </div>
      </section>

      <div className="mb-8 grid grid-cols-2 gap-3 stagger lg:grid-cols-4">
        {stats.map(([l, v, Icon, tone]) => (
          <div key={l} className={cn(tone, 'card p-4')}>
            <Icon size={16} className="text-faint" aria-hidden />
            <p className="num mt-3 text-2xl font-medium text-heading">{v}</p>
            <p className="mt-1 text-xs text-muted">{l}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-8 xl:grid-cols-2">
        <section className="min-w-0">
          <h2 className="mb-3 flex items-center gap-3 text-base font-medium"><span className="grid size-7 place-items-center rounded-sm bg-subtle text-muted"><FileUp size={15} /></span>Uploads<span className="num text-xs font-normal text-muted">{data.resources.length}</span></h2>
          <div className="rows">{data.resources.length ? data.resources.map((r) => <ResourceCard key={r.id} r={r} />) : <p className="px-4 py-8 text-center text-sm text-muted">No uploads yet.</p>}</div>
        </section>
        <section className="min-w-0">
          <h2 className="mb-3 flex items-center gap-3 text-base font-medium"><span className="grid size-7 place-items-center rounded-sm bg-subtle text-muted"><MessageSquareQuote size={15} /></span>Public posts<span className="num text-xs font-normal text-muted">{data.threads.length}</span></h2>
          <div className="rows">{data.threads.length ? data.threads.map((t) => <ThreadCard key={t.id} t={t} />) : <p className="px-4 py-8 text-center text-sm text-muted">No public posts yet.</p>}</div>
        </section>
      </div>
      <p className="mt-8 flex items-center gap-2 text-xs text-faint"><EyeOff size={13} />Anonymous posts never appear on profiles.</p>
    </div>
  )
}
