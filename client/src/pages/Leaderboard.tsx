import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Crown, ShieldCheck } from 'lucide-react'
import { api } from '@/api/mock'
import { RULES } from '@/api/rules'
import { Avatar, ErrorBox, PageHeader, Segmented, Skeleton } from '@/components/ui'
import { cn } from '@/lib/utils'

export default function Leaderboard() {
  const [period, setPeriod] = useState<'week' | 'all'>('week')
  const { data, isLoading, error } = useQuery({ queryKey: ['leaderboard', period], queryFn: () => api.leaderboard.get(period) })
  const P = RULES.points
  const rules = [[`+${P.helpful}`, 'A classmate who downloaded your file rates it helpful'], [`+${P.verified}`, `Your file is verified by ${RULES.verifyThreshold} different students`], [`+${P.accepted}`, 'Your answer is accepted by the asker'], [`+${P.answerUp}`, 'An answer of yours is upvoted'], [`+${P.questionUp}`, 'A question or post of yours is upvoted']]
  return (
    <div>
      <PageHeader title="Leaderboard" sub="Points come only from classmates who found your work useful." action={<Segmented value={period} onChange={setPeriod} options={[{ value: 'week', label: 'This week' }, { value: 'all', label: 'All time' }]} />} />
      <div className="grid gap-8 lg:grid-cols-[1.6fr_1fr]">
        <div>
          {isLoading ? <Skeleton rows={6} /> : error ? <ErrorBox error={error} /> : (
            <>
              <div className="mb-4 grid grid-cols-3 items-end gap-3">
                {[data?.[1], data?.[0], data?.[2]].map((r, i) => r && (
                  <Link to={`/u/${r.user.id}`} key={r.user.id} className={cn('card card-hover flex flex-col items-center p-4 text-center', i === 1 && 'border-ink pb-8 pt-6')}>
                    {i === 1 && <Crown size={20} className="mb-1 text-ink" />}<Avatar user={r.user} size={i === 1 ? 60 : 46} />
                    <span className="mt-2 w-full truncate text-sm font-semibold">{r.user.name}</span><span className="display num text-2xl">{r.xp}</span><span className="eyebrow">#{r.rank}</span>
                  </Link>
                ))}
              </div>
              <ol className="card divide-y divide-line overflow-hidden">
                {data?.slice(3).map((r) => (
                  <li key={r.user.id} className={cn('flex items-center gap-3 px-4 py-3', r.isMe && 'bg-accent-soft')}>
                    <span className="num w-6 text-sm text-faint">{r.rank}</span><Avatar user={r.user} size={32} />
                    <Link to={`/u/${r.user.id}`} className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{r.user.name}{r.isMe && ' (you)'}</span><span className="text-xs text-muted">{r.user.major} · {r.uploads} uploads</span></Link>
                    <span className="num font-semibold">{r.xp}</span>
                  </li>
                ))}
              </ol>
            </>
          )}
        </div>
        <aside className="card h-fit p-5">
          <h2 className="display text-xl">How points work</h2>
          <ul className="mt-4 grid gap-3">{rules.map(([p, t]) => <li key={t} className="flex gap-3 text-sm"><span className="num w-9 shrink-0 font-semibold text-ink">{p}</span><span className="text-muted">{t}</span></li>)}</ul>
          <div className="mt-5 rounded-xl bg-paper p-4 text-xs leading-relaxed text-muted"><p className="mb-1 flex items-center gap-1.5 font-semibold text-ink"><ShieldCheck size={14} className="text-moss" />Built to resist gaming</p>
            Server-side only · one claim per event · no self-votes · duplicate files rejected · {P.helpful === 5 ? RULES.dailyXpCap : ''} XP daily cap · max {RULES.pairWeeklyCap} points per student pair weekly · removed content loses its points.</div>
        </aside>
      </div>
    </div>
  )
}
