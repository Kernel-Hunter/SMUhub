import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { EyeOff, HelpCircle, Megaphone } from 'lucide-react'
import { api } from '@/api/mock'
import Banner from '@/components/Banner'
import { Field, Spinner, useToast } from '@/components/ui'
import { VOICE_LABEL, VOICE_TONE, cn, errMsg } from '@/lib/utils'
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
    <div>
      <Banner tone={qa ? 'violet' : 'orange'} icon={qa ? <HelpCircle size={13} /> : <Megaphone size={13} />} label={qa ? 'Questions' : 'Campus Voice'} title={qa ? 'Ask a question' : 'Write a post'} sub={qa ? 'Specific questions get answered faster.' : 'Say what happened and what would make it better.'} />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
        <form onSubmit={submit} className="card grid gap-5 p-6">
          {qa ? <Field label="Course"><select className="field" required value={f.courseCode} onChange={(e) => setF({ ...f, courseCode: e.target.value })}><option value="">Select a course</option>{courses.data?.map((c) => <option key={c.code} value={c.code}>{c.code} · {c.name}</option>)}</select></Field>
            : <div><span className="label">Topic</span><div className="flex flex-wrap gap-2">{Object.entries(VOICE_LABEL).map(([k, l]) => <button type="button" key={k} onClick={() => setF({ ...f, category: k as VoiceCategory })} className={cn('chip h-8 cursor-pointer px-3 text-xs transition', f.category === k ? VOICE_TONE[k as VoiceCategory] + ' ring-1 ring-current' : 'hover:text-ink')}>{l}</button>)}</div></div>}
          <Field label="Title"><input className="field" required maxLength={140} value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder={qa ? 'What exactly are you stuck on?' : 'Sum it up in one line'} /></Field>
          <Field label="Details"><textarea className="field min-h-44" required maxLength={4000} value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} /></Field>
          {!qa && (
            <button type="button" onClick={() => setF({ ...f, anonymous: !f.anonymous })} className={cn('flex items-center gap-3 rounded-lg p-4 text-left transition', f.anonymous ? 'bg-orange-soft' : 'bg-hover')}>
              <span className={cn('grid size-9 place-items-center rounded-md', f.anonymous ? 'tone-orange text-white' : 'bg-surface text-muted shadow-[var(--ring)]')}><EyeOff size={16} /></span>
              <span className="flex-1"><span className="block text-sm font-semibold">Post without my name</span><span className="text-xs text-muted">Classmates won't see who wrote it. Moderators can, if the post breaks the rules.</span></span>
              <span className={cn('relative h-5 w-9 rounded-full transition', f.anonymous ? 'bg-orange' : 'bg-line-strong')}><span className={cn('absolute top-1 size-4 rounded-full bg-white shadow transition-all', f.anonymous ? 'left-[18px]' : 'left-1')} /></span>
            </button>
          )}
          {err && <p role="alert" className="rounded-md bg-rose-soft px-3 py-2 text-sm text-rose">{err}</p>}
          <div className="flex justify-end border-t border-line pt-5"><button className="btn btn-primary h-10 px-6" disabled={m.isPending}>{m.isPending ? <Spinner /> : 'Publish'}</button></div>
        </form>
        <aside className="card h-fit p-5 text-xs leading-relaxed text-muted">
          <p className="mb-2 text-sm font-semibold text-ink">{qa ? 'Tips' : 'Before you post'}</p>
          <ul className="grid gap-2">{(qa ? ['Name the chapter, slide or exercise.', 'Say what you already tried.', 'Mark the answer that worked so others find it.'] : ['Stick to things you saw or lived.', 'Suggest a fix when you can.', 'Personal attacks get removed.']).map((x) => <li key={x} className="flex gap-2"><span className={cn('mt-2 size-1.5 shrink-0 rounded-full', qa ? 'bg-violet' : 'bg-orange')} />{x}</li>)}</ul>
        </aside>
      </div>
    </div>
  )
}
