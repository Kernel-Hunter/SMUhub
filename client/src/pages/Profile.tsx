import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Award, FileUp, MessageSquareQuote } from 'lucide-react'
import { api } from '@/api/mock'
import { ResourceCard, ThreadCard } from '@/components/Cards'
import { Avatar, ErrorBox, Skeleton } from '@/components/ui'

export default function Profile() {
  const { id = '' } = useParams()
  const { data, error, isLoading } = useQuery({ queryKey: ['profile', id], queryFn: () => api.users.profile(id) })
  if (isLoading) return <Skeleton rows={3} />
  if (error || !data) return <ErrorBox error={error} />
  const { user: u } = data
  return (
    <div className="rise mx-auto max-w-3xl">
      <header className="flex flex-wrap items-center gap-5"><Avatar user={u} size={84} />
        <div><h1 className="display text-4xl font-medium">{u.name}</h1><p className="text-muted">{u.major} · Year {u.year} · joined {new Date(u.joinedAt).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}</p>{u.bio && <p className="mt-2 max-w-lg text-sm">{u.bio}</p>}</div></header>
      <div className="card my-8 grid grid-cols-4 divide-x divide-line text-center">
        {[[u.xp, 'XP'], [u.rank ? `#${u.rank}` : '0', 'rank'], [data.resources.length, 'uploads'], [data.acceptedAnswers, 'accepted']].map(([v, l]) => <div key={l as string} className="p-4"><p className="display num text-2xl">{v}</p><p className="text-xs text-muted">{l}</p></div>)}
      </div>
      <h2 className="display mb-3 flex items-center gap-2 text-2xl"><FileUp size={20} />Uploads</h2>
      <div className="rows mb-10">{data.resources.length ? data.resources.map((r) => <ResourceCard key={r.id} r={r} />) : <p className="px-4 py-6 text-[13px] text-muted">No uploads yet.</p>}</div>
      <h2 className="display mb-3 flex items-center gap-2 text-2xl"><MessageSquareQuote size={20} />Public posts</h2>
      <div className="rows">{data.threads.length ? data.threads.map((t) => <ThreadCard key={t.id} t={t} />) : <p className="px-4 py-6 text-[13px] text-muted">No public posts yet.</p>}</div>
      <p className="mt-8 flex items-center gap-2 text-xs text-faint"><Award size={13} />Anonymous posts never appear on profiles.</p>
    </div>
  )
}
