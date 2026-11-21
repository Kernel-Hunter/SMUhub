import { useRef, useState, type DragEvent, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { BookOpen, CloudUpload, FileCheck2, ShieldCheck, X } from 'lucide-react'
import { api } from '@/api/mock'
import { RULES } from '@/api/rules'
import Banner from '@/components/Banner'
import { FileBadge } from '@/components/Cards'
import { Field, Spinner, useToast } from '@/components/ui'
import { KIND_LABEL, cn, errMsg, formatSize } from '@/lib/utils'
import type { ResourceKind } from '@/api/types'

export default function Upload() {
  const nav = useNavigate(); const qc = useQueryClient(); const toast = useToast()
  const courses = useQuery({ queryKey: ['courses'], queryFn: api.courses.list })
  const [file, setFile] = useState<File | null>(null); const [drag, setDrag] = useState(false); const [err, setErr] = useState('')
  const [f, setF] = useState({ title: '', description: '', courseCode: '', kind: 'notes' as ResourceKind, semester: 'S1' as 'S1' | 'S2', academicYear: '2025/26' })
  const input = useRef<HTMLInputElement>(null)
  const m = useMutation({
    mutationFn: () => api.resources.upload({ ...f, file: file! }),
    onSuccess: (r) => { qc.invalidateQueries({ queryKey: ['resources'] }); qc.invalidateQueries({ queryKey: ['me'] }); toast('Shared. Classmates can find it now.'); nav(`/resources/${r.id}`) },
    onError: (e) => setErr(errMsg(e)),
  })
  function pick(x?: File) {
    setErr(''); if (!x) return
    const ext = x.name.split('.').pop()?.toLowerCase() ?? ''
    if (!(RULES.allowedExt as readonly string[]).includes(ext)) return setErr(`That file type isn't allowed. Use ${RULES.allowedExt.join(', ').toUpperCase()}.`)
    if (x.size > RULES.maxBytes) return setErr('That file is over 25 MB.')
    setFile(x); if (!f.title) setF((s) => ({ ...s, title: x.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ') }))
  }
  const drop = (e: DragEvent) => { e.preventDefault(); setDrag(false); pick(e.dataTransfer.files[0]) }
  const submit = (e: FormEvent) => { e.preventDefault(); setErr(''); if (!file) return setErr('Choose a file first.'); if (!f.courseCode) return setErr('Pick a course.'); m.mutate() }
  const P = RULES.points
  return (
    <div>
      <Banner tone="blue" icon={<BookOpen size={13} />} label="Library" title="Share a file" sub="Upload notes, exams or slides for a course. You earn points when classmates find it useful." />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
        <form onSubmit={submit} className="card grid gap-5 p-6">
          <div onDragOver={(e) => { e.preventDefault(); setDrag(true) }} onDragLeave={() => setDrag(false)} onDrop={drop} onClick={() => !file && input.current?.click()}
            className={cn('flex cursor-pointer flex-col items-center rounded-lg border-2 border-dashed px-6 py-10 text-center transition', drag ? 'border-accent bg-accent-soft' : 'border-line-strong bg-hover hover:border-accent/50')}>
            {file ? (
              <div className="flex items-center gap-3 text-left"><FileBadge ext={file.name.split('.').pop()?.toLowerCase() ?? 'pdf'} /><span><span className="flex items-center gap-2 text-sm font-medium"><FileCheck2 size={14} className="text-success" />{file.name}</span><span className="text-xs text-muted">{formatSize(file.size)}</span></span>
                <button type="button" aria-label="Remove file" className="btn btn-ghost btn-sm ml-2 !px-2" onClick={(e) => { e.stopPropagation(); setFile(null) }}><X size={14} /></button></div>
            ) : (<>
              <span className="grid size-12 place-items-center rounded-md bg-subtle text-muted"><CloudUpload size={22} /></span>
              <p className="mt-3 text-sm font-semibold">Drop your file here, or click to browse</p>
              <p className="mt-1 text-xs text-muted">{RULES.allowedExt.join(', ').toUpperCase()} up to 25 MB</p>
            </>)}
            <input ref={input} type="file" hidden accept={RULES.allowedExt.map((e) => '.' + e).join(',')} onChange={(e) => pick(e.target.files?.[0])} />
          </div>
          <Field label="Title"><input className="field" maxLength={120} value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="e.g. Data Structures full course summary" required /></Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Course"><select className="field" value={f.courseCode} onChange={(e) => setF({ ...f, courseCode: e.target.value })} required><option value="">Select a course</option>{courses.data?.map((c) => <option key={c.code} value={c.code}>{c.code} · {c.name}</option>)}</select></Field>
            <Field label="Type"><select className="field" value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value as ResourceKind })}>{Object.entries(KIND_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></Field>
            <Field label="Semester"><select className="field" value={f.semester} onChange={(e) => setF({ ...f, semester: e.target.value as 'S1' | 'S2' })}><option>S1</option><option>S2</option></select></Field>
            <Field label="Academic year"><input className="field" value={f.academicYear} onChange={(e) => setF({ ...f, academicYear: e.target.value })} /></Field>
          </div>
          <Field label="Description" hint="What does it cover, and who is it for?"><textarea className="field min-h-24" maxLength={600} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></Field>
          {err && <p role="alert" className="rounded-md bg-danger-soft px-3 py-2 text-sm text-danger">{err}</p>}
          <div className="flex items-center justify-between gap-4 border-t border-line pt-5"><p className="text-xs text-muted">Up to {RULES.uploadsPerDay} uploads a day.</p><button className="btn btn-primary h-10 px-6" disabled={m.isPending}>{m.isPending ? <Spinner /> : 'Publish'}</button></div>
        </form>
        <aside className="grid h-fit gap-4">
          <div className="card p-5">
            <p className="text-sm font-semibold">How you earn points</p>
            <ul className="mt-3 grid gap-3">
              {[[`+${P.helpful}`, 'each classmate who rates it helpful', 'bg-accent-soft text-accent'], [`+${P.verified}`, `when ${RULES.verifyThreshold} different students rate it`, 'bg-accent-soft text-accent'], ['0', 'for duplicates or files nobody rates', 'bg-hover text-muted']].map(([p, t, c]) => (
                <li key={t} className="flex items-center gap-3 text-sm"><span className={cn('num grid h-7 w-11 shrink-0 place-items-center rounded-md text-xs font-semibold', c)}>{p}</span><span className="text-muted">{t}</span></li>))}
            </ul>
          </div>
          <div className="card flex gap-3 p-5 text-xs leading-relaxed text-muted"><ShieldCheck size={18} className="mt-1 shrink-0 text-muted" />The server checks every file's type, size and fingerprint. Copies of a file that's already here are rejected.</div>
        </aside>
      </div>
    </div>
  )
}
