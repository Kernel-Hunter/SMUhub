import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, BadgeCheck, Download, Info, Pencil, ThumbsUp, Trash2 } from 'lucide-react'
import { api } from '@/api/client'
import { RULES } from '@/api/rules'
import type { Course, Resource, ResourceKind } from '@/api/types'
import { FileBadge, ResourceCard } from '@/components/Cards'
import { Avatar, ErrorBox, Field, Skeleton, Spinner, useToast } from '@/components/ui'
import { KIND_LABEL, KIND_TONE, cn, deptOf, errMsg, formatSize, timeAgo } from '@/lib/utils'

export default function ResourceDetail() {
  const { id = '' } = useParams(); const nav = useNavigate(); const qc = useQueryClient(); const toast = useToast()
  const [editing, setEditing] = useState<string | null>(null) // the id being edited, so the form closes on another file
  const { data: r, error, isLoading } = useQuery({ queryKey: ['resource', id], queryFn: () => api.resources.get(id) })
  const courses = useQuery({ queryKey: ['courses'], queryFn: api.courses.list })
  const more = useQuery({ queryKey: ['resources', 'course', r?.courseCode], queryFn: () => api.resources.list({ course: r!.courseCode, sort: 'top' }), enabled: !!r })
  const refresh = () => { qc.invalidateQueries({ queryKey: ['resource', id] }); qc.invalidateQueries({ queryKey: ['resources'] }) }
  // The browser downloads the file itself; the server records it, so rating unlocks now and the counts catch up just after.
  const dl = useMutation({ mutationFn: () => api.resources.download(id), onSuccess: () => { qc.setQueryData<Resource>(['resource', id], (old) => old && { ...old, iDownloaded: true }); setTimeout(refresh, 1500) }, onError: (e) => toast(errMsg(e), 'err') })
  const rate = useMutation({ mutationFn: () => api.resources.rate(id), onSuccess: () => { toast('Thanks. The uploader gets points for this.'); refresh() }, onError: (e) => toast(errMsg(e), 'err') })
  const del = useMutation({ mutationFn: () => api.resources.remove(id), onSuccess: () => { qc.invalidateQueries({ queryKey: ['resources'] }); toast('File deleted.'); nav('/resources') }, onError: (e) => toast(errMsg(e), 'err') })
  if (isLoading) return <Skeleton rows={3} />
  if (error || !r) return <ErrorBox error={error} />
  const course = courses.data?.find((c) => c.code === r.courseCode)
  const d = deptOf(course?.dept ?? '')
  return (
    <div>
      <Link to="/resources" className="mb-5 inline-flex items-center gap-2 text-sm font-medium text-muted hover:text-ink"><ArrowLeft size={14} />Library</Link>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
        <article className="card overflow-hidden">
          <div className="flex items-center gap-4 border-b border-line px-6 py-4">
            <FileBadge ext={r.ext} size="lg" />
            <span className="min-w-0 truncate text-sm text-muted">{course?.name ?? r.courseCode}</span>
          </div>
          {editing === r.id && r.mine ? <EditDetails r={r} courses={courses.data} onDone={() => setEditing(null)} /> : <div className="px-6 pb-6 pt-6">
            <div className="flex flex-wrap items-center gap-2">
              <Link to={`/courses/${r.courseCode}`} className="chip mono hover:text-ink" title="Open the course forum"><span className="size-2 rounded-full" style={{ background: d.dot }} aria-hidden />{r.courseCode}</Link><span className={cn('chip', KIND_TONE[r.kind])}>{KIND_LABEL[r.kind]}</span><span className="chip">{r.semester} · {r.academicYear}</span>
              {r.verified && <span className="chip bg-accent-soft text-accent"><BadgeCheck size={12} />Verified by classmates</span>}
            </div>
            <h1 className="mt-3 text-2xl font-semibold">{r.title}</h1>
            {r.description && <p className="mt-3 max-w-2xl whitespace-pre-line text-sm leading-relaxed text-muted">{r.description}</p>}
            <Link to={`/u/${r.uploader.id}`} className="mt-6 flex w-fit items-center gap-3 rounded-md border border-line py-2 pl-2 pr-4 transition-colors hover:bg-hover">
              <Avatar user={r.uploader} size={34} /><span className="leading-tight"><span className="block text-sm font-semibold">{r.uploader.name}</span><span className="text-xs text-muted">{r.uploader.major} · shared {timeAgo(r.createdAt)}</span></span>
            </Link>
          </div>}
        </article>

        <aside className="grid h-fit gap-4 lg:sticky lg:top-16">
          <div className="card p-5">
            <button className="btn btn-primary h-11 w-full text-sm" onClick={() => dl.mutate()} disabled={dl.isPending}>{dl.isPending ? <Spinner /> : <Download size={16} />}Download {r.ext.toUpperCase()}</button>
            {!r.mine && <button className={cn('btn mt-2 h-11 w-full text-sm', r.iVoted ? 'bg-accent-soft text-accent' : 'btn-ghost')} disabled={r.iVoted || !r.iDownloaded || rate.isPending} onClick={() => rate.mutate()}><ThumbsUp size={15} />{r.iVoted ? 'You rated this' : 'This helped me'}</button>}
            {r.mine && <div className="mt-2 grid grid-cols-2 gap-2">
              <button className="btn btn-secondary h-11" disabled={editing === r.id} onClick={() => setEditing(r.id)}><Pencil size={15} />Edit details</button>
              <button className="btn btn-secondary h-11 text-danger" onClick={() => confirm('Delete this file? Points it earned are removed too.') && del.mutate()}><Trash2 size={15} />Delete</button>
            </div>}
            <div className="mt-5 grid grid-cols-3 gap-2 text-center">
              {[[r.downloads, 'downloads', 'text-heading'], [r.helpful, 'helpful', 'text-heading'], [formatSize(r.fileSize), 'size', 'text-heading']].map(([v, l, c]) => (
                <div key={l as string} className="rounded-md bg-hover px-2 py-3"><p className={cn('num text-base font-semibold', c as string)}>{v}</p><p className="text-xs text-muted">{l}</p></div>))}
            </div>
            <p className="mt-4 flex gap-2 text-xs leading-relaxed text-muted"><Info size={14} className="mt-1 shrink-0" />{r.mine ? `You get ${RULES.points.helpful} XP each time a classmate rates it, and ${RULES.points.verified} XP once ${RULES.verifyThreshold} of them do.` : !r.iDownloaded ? 'Download it first. After that you can tell others if it helped. Ratings can\'t be undone.' : 'Ratings only count from students who downloaded the file.'}</p>
          </div>
        </aside>
      </div>
      {more.data && more.data.length > 1 && (
        <section className="mt-8"><h2 className="mb-3 px-1 text-base font-semibold">More from {r.courseCode}</h2><div className="rows">{more.data.filter((x) => x.id !== r.id).slice(0, 4).map((x) => <ResourceCard key={x.id} r={x} />)}</div></section>
      )}
    </div>
  )
}

type Details = Pick<Resource, 'title' | 'description' | 'courseCode' | 'kind' | 'semester' | 'academicYear'>
const DETAILS = ['title', 'description', 'courseCode', 'kind', 'semester', 'academicYear'] as const

/** Inline form for the uploader: same fields as Upload, prefilled. Sends only what changed. The file itself stays. */
function EditDetails({ r, courses, onDone }: { r: Resource; courses?: Course[]; onDone: () => void }) {
  const qc = useQueryClient(); const toast = useToast()
  const [f, setF] = useState<Details>({ title: r.title, description: r.description, courseCode: r.courseCode, kind: r.kind, semester: r.semester, academicYear: r.academicYear })
  const [err, setErr] = useState('')
  const m = useMutation({
    mutationFn: (patch: Partial<Details>) => api.resources.update(r.id, patch),
    onSuccess: (fresh) => {
      qc.setQueryData(['resource', r.id], fresh)
      for (const key of [['resource', r.id], ['resources'], ['courses'], ['profile'], ['palette']]) qc.invalidateQueries({ queryKey: key })
      toast('Details saved.'); onDone()
    },
    onError: (e) => setErr(errMsg(e)),
  })
  const submit = (e: FormEvent) => {
    e.preventDefault(); setErr('')
    const patch = Object.fromEntries(DETAILS.filter((k) => f[k] !== r[k]).map((k) => [k, f[k]])) as Partial<Details>
    if (Object.keys(patch).length === 0) return onDone()
    m.mutate(patch)
  }
  return (
    <form onSubmit={submit} className="grid gap-5 px-6 pb-6 pt-6">
      <Field label="Title"><input className="field" maxLength={120} value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} required autoFocus /></Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Course"><select className="field" value={f.courseCode} onChange={(e) => setF({ ...f, courseCode: e.target.value })} required>{courses ? courses.map((c) => <option key={c.code} value={c.code}>{c.code} · {c.name}</option>) : <option value={f.courseCode}>{f.courseCode}</option>}</select></Field>
        <Field label="Type"><select className="field" value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value as ResourceKind })}>{Object.entries(KIND_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></Field>
        <Field label="Semester"><select className="field" value={f.semester} onChange={(e) => setF({ ...f, semester: e.target.value as 'S1' | 'S2' })}><option>S1</option><option>S2</option></select></Field>
        <Field label="Academic year"><input className="field" value={f.academicYear} onChange={(e) => setF({ ...f, academicYear: e.target.value })} /></Field>
      </div>
      <Field label="Description" hint="What does it cover, and who is it for?"><textarea className="field min-h-24" maxLength={600} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></Field>
      <p className="flex gap-2 text-xs leading-relaxed text-muted"><Info size={14} className="mt-1 shrink-0" />You can change the details, not the file. To share a new version, upload it as a new file.</p>
      {err && <p role="alert" className="rounded-md bg-danger-soft px-3 py-2 text-sm text-danger">{err}</p>}
      <div className="flex justify-end gap-2 border-t border-line pt-5">
        <button type="button" className="btn btn-ghost h-10 px-4" disabled={m.isPending} onClick={onDone}>Cancel</button>
        <button className="btn btn-primary h-10 px-6" disabled={m.isPending}>{m.isPending ? <Spinner /> : 'Save changes'}</button>
      </div>
    </form>
  )
}
