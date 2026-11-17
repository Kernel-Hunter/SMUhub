import { useRef, useState, type DragEvent, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CloudUpload, FileCheck2, ShieldCheck, X } from 'lucide-react'
import { api } from '@/api/mock'
import { RULES } from '@/api/rules'
import { Field, PageHeader, Spinner, useToast } from '@/components/ui'
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
    onSuccess: (r) => { qc.invalidateQueries({ queryKey: ['resources'] }); qc.invalidateQueries({ queryKey: ['me'] }); toast('Uploaded. Classmates can now find it.'); nav(`/resources/${r.id}`) },
    onError: (e) => setErr(errMsg(e)),
  })
  function pick(x?: File) {
    setErr(''); if (!x) return
    const ext = x.name.split('.').pop()?.toLowerCase() ?? ''
    if (!(RULES.allowedExt as readonly string[]).includes(ext)) return setErr(`Unsupported type. Allowed: ${RULES.allowedExt.join(', ').toUpperCase()}.`)
    if (x.size > RULES.maxBytes) return setErr('That file is over 25 MB.')
    setFile(x); if (!f.title) setF((s) => ({ ...s, title: x.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ') }))
  }
  const drop = (e: DragEvent) => { e.preventDefault(); setDrag(false); pick(e.dataTransfer.files[0]) }
  const submit = (e: FormEvent) => { e.preventDefault(); setErr(''); if (!file) return setErr('Choose a file first.'); if (!f.courseCode) return setErr('Pick a course.'); m.mutate() }
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader eyebrow="Share" title="Upload a resource." sub="Good uploads earn XP once classmates download and rate them. Duplicates and low-effort files earn nothing." />
      <form onSubmit={submit} className="grid gap-5">
        <div onDragOver={(e) => { e.preventDefault(); setDrag(true) }} onDragLeave={() => setDrag(false)} onDrop={drop}
          className={cn('card flex flex-col items-center border-2 border-dashed px-6 py-12 text-center transition', drag && 'border-accent bg-accent-soft')}>
          {file ? (
            <div className="flex items-center gap-3"><FileCheck2 className="text-moss" /><span className="text-left"><span className="block font-semibold">{file.name}</span><span className="text-xs text-muted">{formatSize(file.size)}</span></span>
              <button type="button" aria-label="Remove file" className="btn btn-ghost btn-sm !px-2" onClick={() => setFile(null)}><X size={14} /></button></div>
          ) : (<>
            <CloudUpload size={34} strokeWidth={1.4} className="text-faint" />
            <p className="display mt-3 text-xl">Drop a file here</p>
            <p className="mt-1 text-sm text-muted">{RULES.allowedExt.join(' · ').toUpperCase()} · up to 25 MB</p>
            <button type="button" className="btn btn-ghost mt-4" onClick={() => input.current?.click()}>Browse files</button>
          </>)}
          <input ref={input} type="file" hidden accept={RULES.allowedExt.map((e) => '.' + e).join(',')} onChange={(e) => pick(e.target.files?.[0])} />
        </div>
        <Field label="Title"><input className="field" maxLength={120} value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="e.g. Data Structures — Full Course Summary" required /></Field>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Course"><select className="field" value={f.courseCode} onChange={(e) => setF({ ...f, courseCode: e.target.value })} required><option value="">Select…</option>{courses.data?.map((c) => <option key={c.code} value={c.code}>{c.code} · {c.name}</option>)}</select></Field>
          <Field label="Type"><select className="field" value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value as ResourceKind })}>{Object.entries(KIND_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></Field>
          <Field label="Semester"><select className="field" value={f.semester} onChange={(e) => setF({ ...f, semester: e.target.value as 'S1' | 'S2' })}><option>S1</option><option>S2</option></select></Field>
          <Field label="Academic year"><input className="field" value={f.academicYear} onChange={(e) => setF({ ...f, academicYear: e.target.value })} /></Field>
        </div>
        <Field label="Description" hint="What does it cover? Who is it for?"><textarea className="field min-h-24" maxLength={600} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></Field>
        {err && <p role="alert" className="rounded-xl bg-rose-soft px-3 py-2 text-sm text-rose">{err}</p>}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <p className="flex max-w-md items-start gap-2 text-xs text-muted"><ShieldCheck size={14} className="mt-0.5 shrink-0 text-moss" />Files are checked on the server for type, size and duplicates. Max {RULES.uploadsPerDay} uploads per day.</p>
          <button className="btn btn-accent h-12 px-8" disabled={m.isPending}>{m.isPending ? <Spinner /> : 'Publish'}</button>
        </div>
      </form>
    </div>
  )
}
