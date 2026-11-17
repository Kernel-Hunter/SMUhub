import { Link, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Search, Upload } from 'lucide-react'
import { api } from '@/api/mock'
import { ResourceCard } from '@/components/Cards'
import { Empty, ErrorBox, PageHeader, Skeleton } from '@/components/ui'
import { KIND_LABEL } from '@/lib/utils'
import type { ResourceKind } from '@/api/types'

export default function Resources() {
  const [sp, setSp] = useSearchParams()
  const q = sp.get('q') ?? '', course = sp.get('course') ?? '', kind = (sp.get('kind') ?? '') as ResourceKind | '', semester = (sp.get('sem') ?? '') as 'S1' | 'S2' | '', sort = (sp.get('sort') ?? 'new') as 'new' | 'top' | 'downloads'
  const set = (k: string, v: string) => setSp((p) => { const n = new URLSearchParams(p); v ? n.set(k, v) : n.delete(k); return n }, { replace: true })
  const courses = useQuery({ queryKey: ['courses'], queryFn: api.courses.list })
  const list = useQuery({ queryKey: ['resources', { q, course, kind, semester, sort }], queryFn: () => api.resources.list({ q, course, kind, semester, sort }) })
  return (
    <div>
      <PageHeader eyebrow="Library" title={<>Everything students <em>actually</em> use.</>} sub="Notes, past exams, summaries and slides uploaded by classmates. Rate what helped you so the best material rises."
        action={<Link to="/resources/new" className="btn btn-accent"><Upload size={16} />Upload</Link>} />
      <div className="card mb-6 grid gap-3 p-3 sm:grid-cols-2 lg:grid-cols-[2fr_1.2fr_1fr_.8fr_1fr]">
        <label className="relative sm:col-span-2 lg:col-span-1"><Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-faint" /><input className="field !pl-10" placeholder="Search title, topic or course" value={q} onChange={(e) => set('q', e.target.value)} aria-label="Search resources" /></label>
        <select className="field" value={course} onChange={(e) => set('course', e.target.value)} aria-label="Course"><option value="">All courses</option>{courses.data?.map((c) => <option key={c.code} value={c.code}>{c.code} · {c.name}</option>)}</select>
        <select className="field" value={kind} onChange={(e) => set('kind', e.target.value)} aria-label="Type"><option value="">Any type</option>{Object.entries(KIND_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
        <select className="field" value={semester} onChange={(e) => set('sem', e.target.value)} aria-label="Semester"><option value="">Any term</option><option value="S1">S1</option><option value="S2">S2</option></select>
        <select className="field" value={sort} onChange={(e) => set('sort', e.target.value)} aria-label="Sort"><option value="new">Newest</option><option value="top">Most helpful</option><option value="downloads">Most downloaded</option></select>
      </div>
      {list.isLoading ? <Skeleton rows={5} /> : list.error ? <ErrorBox error={list.error} /> : !list.data?.length ? (
        <Empty title="Nothing here yet" hint="No resources match these filters. Be the first to share one for this course." action={<Link to="/resources/new" className="btn btn-primary">Upload a resource</Link>} />
      ) : <div className="grid gap-3">{list.data.map((r) => <ResourceCard key={r.id} r={r} />)}</div>}
    </div>
  )
}
