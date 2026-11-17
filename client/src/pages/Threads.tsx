import { Link, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Plus, Search } from 'lucide-react'
import { api } from '@/api/mock'
import { ThreadCard } from '@/components/Cards'
import { Empty, ErrorBox, PageHeader, Skeleton } from '@/components/ui'
import { VOICE_LABEL } from '@/lib/utils'
import type { ThreadKind } from '@/api/types'

export default function Threads({ kind }: { kind: ThreadKind }) {
  const [sp, setSp] = useSearchParams()
  const q = sp.get('q') ?? '', course = sp.get('course') ?? '', category = sp.get('cat') ?? '', sort = (sp.get('sort') ?? 'new') as 'new' | 'top', unsolved = sp.get('open') === '1'
  const set = (k: string, v: string) => setSp((p) => { const n = new URLSearchParams(p); v ? n.set(k, v) : n.delete(k); return n }, { replace: true })
  const courses = useQuery({ queryKey: ['courses'], queryFn: api.courses.list })
  const list = useQuery({ queryKey: ['threads', kind, { q, course, category, sort, unsolved }], queryFn: () => api.threads.list(kind, { q, course, category, sort, unsolved }) })
  const qa = kind === 'question'
  return (
    <div>
      <PageHeader title={qa ? 'Questions & answers' : 'Campus Voice'}
        sub={qa ? 'Ask by course. When an answer works for you, mark it as accepted.' : 'Feedback on courses, facilities and administration. You can post without your name.'}
        action={<Link to={qa ? '/qa/new' : '/voice/new'} className="btn btn-accent"><Plus size={16} />{qa ? 'Ask a question' : 'New post'}</Link>} />
      <div className="card mb-6 grid gap-3 p-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="relative"><Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-faint" /><input className="field !pl-10" placeholder="Search" value={q} onChange={(e) => set('q', e.target.value)} aria-label="Search" /></label>
        {qa ? <select className="field" value={course} onChange={(e) => set('course', e.target.value)} aria-label="Course"><option value="">All courses</option>{courses.data?.map((c) => <option key={c.code} value={c.code}>{c.code} · {c.name}</option>)}</select>
          : <select className="field" value={category} onChange={(e) => set('cat', e.target.value)} aria-label="Category"><option value="">All topics</option>{Object.entries(VOICE_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>}
        <select className="field" value={sort} onChange={(e) => set('sort', e.target.value)} aria-label="Sort"><option value="new">Newest</option><option value="top">Top voted</option></select>
        {qa && <label className="flex h-[2.8rem] items-center gap-2 rounded-xl px-2 text-sm"><input type="checkbox" checked={unsolved} onChange={(e) => set('open', e.target.checked ? '1' : '')} className="size-4 accent-[var(--accent)]" />Unanswered only</label>}
      </div>
      {list.isLoading ? <Skeleton rows={4} /> : list.error ? <ErrorBox error={list.error} /> : !list.data?.length ? <Empty title="Quiet in here" hint="Nothing matches yet." /> : <div className="rows">{list.data.map((t) => <ThreadCard key={t.id} t={t} />)}</div>}
    </div>
  )
}
