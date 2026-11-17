import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Crown, ShieldCheck, Trophy } from 'lucide-react'
import { api } from '@/api/mock'
import { RULES } from '@/api/rules'
import Banner from '@/components/Banner'
import { Avatar, CountUp, ErrorBox, Skeleton } from '@/components/ui'
import { cn } from '@/lib/utils'

const MEDAL = [
  { ring: '#e6a817', bar: 'tone-gold', h: 'h-28', label: '1st' },
  { ring: '#9aa3b5', bar: 'bg-[linear-gradient(135deg,#b8c0cf,#8a94a8)]', h: 'h-20', label: '2nd' },
  { ring: '#c27a43', bar: 'bg-[linear-gradient(135deg,#d99464,#b0652f)]', h: 'h-14', label: '3rd' },
]

export default function Leaderboard() {
  const [period, setPeriod] = useState<'week' | 'all'>('week')
  const { data, isLoading, error } = useQuery({ queryKey: ['leaderboard', period], queryFn: () => api.leaderboard.get(period) })
  const me = useQuery({ queryKey: ['me'], queryFn: api.me.get })
  const P = RULES.points
  const rules: [string, string, string][] = [[`+${P.verified}`, `Your file is verified by ${RULES.verifyThreshold} different students`, 'bg-gold-soft text-gold'], [`+${P.accepted}`, 'Your answer is accepted by the asker', 'bg-violet-soft text-violet'], [`+${P.helpful}`, 'Someone who downloaded your file rates it helpful', 'bg-accent-soft text-accent'], [`+${P.answerUp}`, 'An answer of yours gets an upvote', 'bg-moss-soft text-moss'], [`+${P.questionUp}`, 'A question or post of yours gets an upvote', 'bg-orange-soft text-orange']]
  const mine = data?.find((r) => r.isMe)
  const podium = data ? [data[1], data[0], data[2]] : []
  return (
    <div>
      <Banner tone="gold" icon={<Trophy size={13} />} label="Leaderboard" title="Top contributors" sub="Points come from classmates rating your files and upvoting your answers. You cannot earn them alone."
        stats={[['Your rank', mine ? `#${mine.rank}` : '-'], [period === 'week' ? 'Your week' : 'Your total', <CountUp key={period} value={mine?.xp ?? (period === 'week' ? me.data?.weeklyXp : me.data?.xp) ?? 0} />]]}
        action={<div className="inline-flex rounded-full bg-white/15 p-1 ring-1 ring-white/25">{(['week', 'all'] as const).map((p) => <button key={p} onClick={() => setPeriod(p)} className={cn('h-8 rounded-full px-4 text-[13px] font-medium transition', period === p ? 'bg-white text-[#7a4f00] shadow' : 'text-white/90 hover:text-white')}>{p === 'week' ? 'This week' : 'All time'}</button>)}</div>} />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0">
          {isLoading ? <Skeleton rows={6} /> : error ? <ErrorBox error={error} /> : (
            <>
              <div className="card mb-5 grid grid-cols-3 items-end gap-3 px-4 pt-6 sm:px-8">
                {podium.map((r, i) => { if (!r) return <span key={i} />; const m = MEDAL[r.rank - 1] ?? MEDAL[2]; return (
                  <Link to={`/u/${r.user.id}`} key={r.user.id} className="group flex flex-col items-center text-center">
                    {r.rank === 1 && <Crown size={22} className="mb-1 text-gold" />}
                    <span className="rounded-full p-[3px] transition group-hover:scale-105" style={{ background: m.ring }}><span className="block rounded-full bg-surface p-[2px]"><Avatar user={r.user} size={r.rank === 1 ? 64 : 50} /></span></span>
                    <span className="mt-2 w-full truncate text-[13.5px] font-semibold">{r.user.name}</span>
                    <span className="text-[11.5px] text-muted">{r.user.major}</span>
                    <div className={cn(m.bar, m.h, 'mt-3 grid w-full place-items-center rounded-t-[14px] text-white')}>
                      <span><span className="num block text-[22px] font-semibold leading-none">{r.xp}</span><span className="text-[11px] font-medium text-white/85">{m.label}</span></span>
                    </div>
                  </Link>) })}
              </div>
              <ol className="rows stagger">
                {data?.slice(3).map((r) => (
                  <li key={r.user.id} className={cn('flex items-center gap-3 px-4 py-3', r.isMe && 'bg-accent-soft')}>
                    <span className="num grid size-7 place-items-center rounded-full bg-hover text-[12px] font-semibold text-muted">{r.rank}</span><Avatar user={r.user} size={34} />
                    <Link to={`/u/${r.user.id}`} className="min-w-0 flex-1"><span className="block truncate text-[13.5px] font-medium">{r.user.name}{r.isMe && ' (you)'}</span><span className="text-[12px] text-muted">{r.user.major} · {r.uploads} {r.uploads === 1 ? 'upload' : 'uploads'}</span></Link>
                    <span className="hidden w-28 sm:block"><span className="block h-1.5 overflow-hidden rounded-full bg-hover"><span className="bar block h-full rounded-full bg-gold" style={{ width: `${Math.max(6, (r.xp / (data[0]?.xp || 1)) * 100)}%` }} /></span></span>
                    <span className="num w-12 text-right text-[14px] font-semibold">{r.xp}</span>
                  </li>
                ))}
              </ol>
            </>
          )}
        </div>
        <aside className="grid h-fit gap-4 lg:sticky lg:top-16">
          <div className="card p-5">
            <p className="text-[15px] font-semibold">How points work</p>
            <ul className="mt-4 grid gap-3">{rules.map(([p, t, tone]) => <li key={t} className="flex items-center gap-3 text-[13px]"><span className={cn('num grid h-7 w-11 shrink-0 place-items-center rounded-[8px] text-[12.5px] font-semibold', tone)}>{p}</span><span className="text-muted">{t}</span></li>)}</ul>
          </div>
          <div className="card p-5 text-[12.5px] leading-relaxed text-muted">
            <p className="mb-2 flex items-center gap-1.5 text-[13.5px] font-semibold text-ink"><ShieldCheck size={15} className="text-moss" />Hard to game</p>
            <ul className="grid gap-1.5">{['Points are given by the server, never by your browser.', 'You cannot vote on your own posts or files.', `At most ${RULES.dailyXpCap} points a day.`, `One classmate can give you points ${RULES.pairWeeklyCap} times a week at most.`, 'Re-uploading the same file is rejected.', 'Deleted content loses its points.'].map((x) => <li key={x} className="flex gap-2"><span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-moss" />{x}</li>)}</ul>
          </div>
        </aside>
      </div>
    </div>
  )
}
