import { Link, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { BookOpen, Search, Upload, X } from 'lucide-react'
import { api } from '@/api/mock'
import { ResourceCard } from '@/components/Cards'
import Banner, { bannerBtn } from '@/components/Banner'
import { Empty, ErrorBox, Segmented, Skeleton } from '@/components/ui'
import { KIND_LABEL, KIND_TONE, cn, deptOf } from '@/lib/utils'
import type { ResourceKind } from '@/api/types'

export default function Resources() {
  const [sp, setSp] = useSearchParams()
  const q = sp.get('q') ?? '', course = sp.get('course') ?? '', kind = (sp.get('kind') ?? '') as ResourceKind | '', semester = (sp.get('sem') ?? '') as 'S1' | 'S2' | '', sort = (sp.get('sort') ?? 'new') as 'new' | 'top' | 'downloads'
  const set = (k: string, v: string) => setSp((p) => { const n = new URLSearchParams(p); v ? n.set(k, v) : n.delete(k); return n }, { replace: true })
  const courses = useQuery({ queryKey: ['courses'], queryFn: api.courses.list })
  const all = useQuery({ queryKey: ['resources', 'all'], queryFn: () => api.resources.list({}) })
  const list = useQuery({ queryKey: ['resources', { q, course, kind, semester, sort }], queryFn: () => api.resources.list({ q, course, kind, semester, sort }) })
  const active = [course, kind, semester, q].filter(Boolean).length
  return (
    <div>
      <Banner tone="blue" icon={<BookOpen size={13} />} label="Library" title="Course library" sub="Notes, past exams and slides shared by SMU students. Rate a file after you download it."
        stats={[['Files', all.data?.length ?? 0], ['Verified', all.data?.filter((r) => r.verified).length ?? 0], ['Courses', courses.data?.filter((c) => c.resources > 0).length ?? 0]]}
        action={<Link to="/resources/new" className={bannerBtn}><Upload size={15} />Share a file</Link>} />

      <div className="grid gap-6 lg:grid-cols-[250px_minmax(0,1fr)]">
        <aside className="card h-fit p-4 lg:sticky lg:top-16">
          <label className="relative block"><Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-faint" /><input className="field !pl-9" placeholder="Search files" value={q} onChange={(e) => set('q', e.target.value)} aria-label="Search files" /></label>
          <p className="mb-1.5 mt-5 text-[11.5px] font-semibold uppercase tracking-wider text-faint">Courses</p>
          <div className="-mx-1 grid max-h-72 gap-0.5 overflow-auto">
            <button onClick={() => set('course', '')} className={cn('flex items-center gap-2.5 rounded-[8px] px-2 py-1.5 text-left text-[13px] transition', !course ? 'bg-accent-soft font-medium text-accent' : 'hover:bg-hover')}><span className="size-2 rounded-full bg-ink/30" />All courses<span className="num ml-auto text-[11.5px] text-faint">{all.data?.length}</span></button>
            {courses.data?.map((c) => (
              <button key={c.code} onClick={() => set('course', course === c.code ? '' : c.code)} className={cn('flex items-center gap-2.5 rounded-[8px] px-2 py-1.5 text-left text-[13px] transition', course === c.code ? 'bg-accent-soft font-medium text-accent' : 'hover:bg-hover')} title={c.name}>
                <span className="size-2 shrink-0 rounded-full" style={{ background: deptOf(c.dept).from }} /><span className="num">{c.code}</span><span className="truncate text-muted">{c.name}</span><span className="num ml-auto text-[11.5px] text-faint">{c.resources}</span>
              </button>))}
          </div>
          <p className="mb-2 mt-5 text-[11.5px] font-semibold uppercase tracking-wider text-faint">Type</p>
          <div className="flex flex-wrap gap-1.5">
            {Object.entries(KIND_LABEL).map(([k, l]) => <button key={k} onClick={() => set('kind', kind === k ? '' : k)} className={cn('chip h-7 cursor-pointer px-2.5 text-[12px] transition', kind === k ? KIND_TONE[k as ResourceKind] + ' ring-1 ring-current' : 'hover:text-ink')}>{l}</button>)}
          </div>
          <p className="mb-2 mt-5 text-[11.5px] font-semibold uppercase tracking-wider text-faint">Semester</p>
          <Segmented value={semester || 'all'} onChange={(v) => set('sem', v === 'all' ? '' : v)} options={[{ value: 'all', label: 'Any' }, { value: 'S1', label: 'S1' }, { value: 'S2', label: 'S2' }]} />
          {active > 0 && <button onClick={() => setSp({}, { replace: true })} className="mt-5 flex items-center gap-1 text-[12.5px] font-medium text-muted hover:text-ink"><X size={13} />Clear {active} {active === 1 ? 'filter' : 'filters'}</button>}
        </aside>

        <section className="min-w-0">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <p className="text-[13px] text-muted"><span className="font-semibold text-ink">{list.data?.length ?? 0}</span> {list.data?.length === 1 ? 'file' : 'files'}{course && <> in <span className="font-medium text-ink">{course}</span></>}</p>
            <Segmented value={sort} onChange={(v) => set('sort', v === 'new' ? '' : v)} options={[{ value: 'new', label: 'Newest' }, { value: 'top', label: 'Most helpful' }, { value: 'downloads', label: 'Most downloaded' }]} />
          </div>
          {list.isLoading ? <Skeleton rows={6} /> : list.error ? <ErrorBox error={list.error} /> : !list.data?.length ? (
            <Empty title="No files match" hint="Try another course or clear the filters. You can also be the first to share something here." action={<Link to="/resources/new" className="btn btn-primary">Share a file</Link>} />
          ) : <div className="rows stagger">{list.data.map((r) => <ResourceCard key={r.id} r={r} />)}</div>}
        </section>
      </div>
    </div>
  )
}
