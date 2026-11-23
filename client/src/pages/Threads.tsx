import { Link, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { HelpCircle, Megaphone, Plus, Search, X } from 'lucide-react'
import { api } from '@/api/client'
import { ThreadCard } from '@/components/Cards'
import Banner, { bannerBtn } from '@/components/Banner'
import { Empty, ErrorBox, Segmented, Skeleton } from '@/components/ui'
import { VOICE_LABEL, VOICE_TONE, cn, deptOf } from '@/lib/utils'
import type { ThreadKind } from '@/api/types'

export default function Threads({ kind }: { kind: ThreadKind }) {
  const [sp, setSp] = useSearchParams()
  const q = sp.get('q') ?? '', course = sp.get('course') ?? '', category = sp.get('cat') ?? '', sort = (sp.get('sort') ?? 'new') as 'new' | 'top', unsolved = sp.get('open') === '1'
  const set = (k: string, v: string) => setSp((p) => { const n = new URLSearchParams(p); v ? n.set(k, v) : n.delete(k); return n }, { replace: true })
  const qa = kind === 'question'
  const courses = useQuery({ queryKey: ['courses'], queryFn: api.courses.list })
  const all = useQuery({ queryKey: ['threads', kind, 'all'], queryFn: () => api.threads.list(kind) })
  const list = useQuery({ queryKey: ['threads', kind, { q, course, category, sort, unsolved }], queryFn: () => api.threads.list(kind, { q, course, category, sort, unsolved }) })
  const a = all.data ?? []
  const active = [q, course, category, unsolved ? '1' : ''].filter(Boolean).length
  const stats: [string, number][] = qa
    ? [['Questions', a.length], ['Solved', a.filter((t) => t.solved).length], ['Open', a.filter((t) => !t.solved).length]]
    : [['Posts', a.length], ['Votes', a.reduce((s, t) => s + t.votes, 0)], ['Replies', a.reduce((s, t) => s + t.replyCount, 0)]]
  const Item = ({ on, onClick, dot, label, count }: { on: boolean; onClick: () => void; dot: React.ReactNode; label: React.ReactNode; count: number }) => (
    <button onClick={onClick} className={cn('flex items-center gap-3 rounded-md px-2 py-2 text-left text-sm transition', on ? 'bg-accent-soft font-medium text-accent' : 'hover:bg-hover')}>{dot}{label}<span className="num ml-auto text-xs text-faint">{count}</span></button>
  )
  return (
    <div>
      <Banner tone={qa ? 'violet' : 'orange'} icon={qa ? <HelpCircle size={13} /> : <Megaphone size={13} />} label={qa ? 'Questions' : 'Campus Voice'}
        title={qa ? 'Ask, answer, get unstuck' : 'Say it out loud'}
        sub={qa ? 'Ask by course. When an answer works for you, mark it as accepted.' : 'Feedback on courses, facilities and administration. You can post without your name.'}
        stats={stats} action={<Link to={qa ? '/qa/new' : '/voice/new'} className={bannerBtn}><Plus size={15} />{qa ? 'Ask a question' : 'New post'}</Link>} />

      <div className="grid gap-6 lg:grid-cols-[250px_minmax(0,1fr)]">
        <aside className="card h-fit p-4 lg:sticky lg:top-16">
          <label className="relative block"><Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-faint" /><input className="field !pl-9" placeholder={qa ? 'Search questions' : 'Search posts'} value={q} onChange={(e) => set('q', e.target.value)} aria-label="Search" /></label>
          {qa && (
            <button onClick={() => set('open', unsolved ? '' : '1')} className="mt-4 flex w-full items-center justify-between rounded-md bg-hover px-3 py-3 text-sm font-medium">
              Unanswered only<span className={cn('relative h-5 w-9 rounded-full transition', unsolved ? 'bg-accent-fill' : 'bg-line-strong')}><span className={cn('absolute top-1 size-4 rounded-full bg-white ring-1 ring-black/10 transition-all', unsolved ? 'left-[18px]' : 'left-1')} /></span>
            </button>
          )}
          <p className="mb-2 mt-5 text-xs font-semibold uppercase tracking-wider text-faint">{qa ? 'Courses' : 'Topics'}</p>
          <div className="-mx-1 grid max-h-80 grid-cols-1 gap-1 overflow-auto">
            {qa ? (<>
              <Item on={!course} onClick={() => set('course', '')} dot={<span className="size-2 rounded-full bg-ink/30" />} label="All courses" count={a.length} />
              {courses.data?.filter((c) => c.questions > 0).map((c) => <Item key={c.code} on={course === c.code} onClick={() => set('course', course === c.code ? '' : c.code)} dot={<span className="size-2 shrink-0 rounded-full" style={{ background: deptOf(c.dept).dot }} aria-hidden />} label={<><span className="mono text-xs">{c.code}</span><span className="min-w-0 truncate text-muted">{c.name}</span></>} count={c.questions} />)}
            </>) : (<>
              <Item on={!category} onClick={() => set('cat', '')} dot={<span className="size-2 rounded-full bg-ink/30" />} label="All topics" count={a.length} />
              {Object.entries(VOICE_LABEL).map(([k, l]) => <Item key={k} on={category === k} onClick={() => set('cat', category === k ? '' : k)} dot={<span className={cn('size-2 rounded-full', VOICE_TONE[k as keyof typeof VOICE_TONE].split(' ')[1].replace('text-', 'bg-'))} />} label={l} count={a.filter((t) => t.category === k).length} />)}
            </>)}
          </div>
          {active > 0 && <button onClick={() => setSp({}, { replace: true })} className="mt-5 flex items-center gap-1 text-xs font-medium text-muted hover:text-ink"><X size={13} />Clear filters</button>}
        </aside>
        <section className="min-w-0">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted"><span className="font-semibold text-ink">{list.data?.length ?? 0}</span> {qa ? (list.data?.length === 1 ? 'question' : 'questions') : (list.data?.length === 1 ? 'post' : 'posts')}</p>
            <Segmented value={sort} onChange={(v) => set('sort', v === 'new' ? '' : v)} options={[{ value: 'new', label: 'Newest' }, { value: 'top', label: 'Top voted' }]} />
          </div>
          {list.isLoading ? <Skeleton rows={5} /> : list.error ? <ErrorBox error={list.error} /> : !list.data?.length ? <Empty title="Nothing here yet" hint={qa ? 'No questions match. Ask the first one.' : 'No posts match these filters.'} /> : <div className="rows stagger">{list.data.map((t) => <ThreadCard key={t.id} t={t} />)}</div>}
        </section>
      </div>
    </div>
  )
}
