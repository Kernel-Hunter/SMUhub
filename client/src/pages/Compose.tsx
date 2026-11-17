import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { EyeOff } from 'lucide-react'
import { api } from '@/api/mock'
import { Field, PageHeader, Spinner, useToast } from '@/components/ui'
import { VOICE_LABEL, errMsg } from '@/lib/utils'
import type { ThreadKind, VoiceCategory } from '@/api/types'

export default function Compose({ kind }: { kind: ThreadKind }) {
  const nav = useNavigate(); const qc = useQueryClient(); const toast = useToast(); const qa = kind === 'question'
  const courses = useQuery({ queryKey: ['courses'], queryFn: api.courses.list })
  const [f, setF] = useState({ title: '', body: '', courseCode: '', category: 'academics' as VoiceCategory, anonymous: false }); const [err, setErr] = useState('')
  const m = useMutation({
    mutationFn: () => api.threads.create({ kind, ...f }),
    onSuccess: (t) => { qc.invalidateQueries({ queryKey: ['threads'] }); toast('Posted.'); nav(`/${qa ? 'qa' : 'voice'}/${t.id}`) }, onError: (e) => setErr(errMsg(e)),
  })
  const submit = (e: FormEvent) => { e.preventDefault(); setErr(''); m.mutate() }
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title={qa ? 'Ask a question' : 'New post'} sub={qa ? 'The more specific the question, the faster the answer.' : 'Criticism is welcome when it is specific and fair. Personal attacks are removed.'} />
      <form onSubmit={submit} className="grid gap-5">
        {qa ? <Field label="Course"><select className="field" required value={f.courseCode} onChange={(e) => setF({ ...f, courseCode: e.target.value })}><option value="">Select…</option>{courses.data?.map((c) => <option key={c.code} value={c.code}>{c.code} · {c.name}</option>)}</select></Field>
          : <Field label="Topic"><select className="field" value={f.category} onChange={(e) => setF({ ...f, category: e.target.value as VoiceCategory })}>{Object.entries(VOICE_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></Field>}
        <Field label="Title"><input className="field" required maxLength={140} value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder={qa ? 'What exactly are you stuck on?' : 'Summarize it in one line'} /></Field>
        <Field label="Details"><textarea className="field min-h-40" required maxLength={4000} value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} /></Field>
        {!qa && (
          <label className="card flex cursor-pointer items-start gap-3 p-4"><input type="checkbox" className="mt-1 size-4 accent-[var(--accent)]" checked={f.anonymous} onChange={(e) => setF({ ...f, anonymous: e.target.checked })} />
            <span><span className="flex items-center gap-1.5 text-sm font-semibold"><EyeOff size={14} />Post anonymously</span><span className="text-xs text-muted">Classmates will not see your name. Moderators can still act on abuse.</span></span></label>
        )}
        {err && <p role="alert" className="rounded-xl bg-rose-soft px-3 py-2 text-sm text-rose">{err}</p>}
        <button className="btn btn-accent h-12 justify-self-end px-8" disabled={m.isPending}>{m.isPending ? <Spinner /> : 'Publish'}</button>
      </form>
    </div>
  )
}
