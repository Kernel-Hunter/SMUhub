import { useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, MapPin, Plus, Users } from 'lucide-react'
import { api } from '@/api/mock'
import { Chip, Empty, ErrorBox, Field, PageHeader, Skeleton, Spinner, useToast } from '@/components/ui'
import { cn, daysUntil, errMsg, formatDay, formatTime } from '@/lib/utils'

const TONE = { event: 'bg-accent-soft text-ink', deadline: 'bg-rose-soft text-rose', club: 'bg-moss-soft text-moss' } as const

export default function Events() {
  const qc = useQueryClient(); const toast = useToast()
  const list = useQuery({ queryKey: ['events'], queryFn: api.events.list })
  const [open, setOpen] = useState(false); const [err, setErr] = useState('')
  const [f, setF] = useState({ title: '', kind: 'event' as 'event' | 'deadline' | 'club', when: '', location: '', description: '' })
  const go = useMutation({ mutationFn: (id: string) => api.events.toggleGoing(id), onSuccess: () => qc.invalidateQueries({ queryKey: ['events'] }), onError: (e) => toast(errMsg(e), 'err') })
  const create = useMutation({
    mutationFn: () => api.events.create({ title: f.title, kind: f.kind, startsAt: new Date(f.when).getTime(), location: f.location, description: f.description }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['events'] }); setOpen(false); setF({ title: '', kind: 'event', when: '', location: '', description: '' }); toast('Event added.') }, onError: (e) => setErr(errMsg(e)),
  })
  const submit = (e: FormEvent) => { e.preventDefault(); setErr(''); create.mutate() }
  return (
    <div>
      <PageHeader eyebrow="Calendar" title="Events & deadlines." sub="Everything coming up on campus, from exams to club nights." action={<button className="btn btn-accent" onClick={() => setOpen(!open)}><Plus size={16} />Add</button>} />
      {open && (
        <form onSubmit={submit} className="card rise mb-8 grid gap-4 p-5 sm:grid-cols-2">
          <div className="sm:col-span-2"><Field label="Title"><input className="field" required maxLength={100} value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></Field></div>
          <Field label="Type"><select className="field" value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value as typeof f.kind })}><option value="event">Event</option><option value="deadline">Deadline</option><option value="club">Club</option></select></Field>
          <Field label="When"><input className="field" type="datetime-local" required value={f.when} onChange={(e) => setF({ ...f, when: e.target.value })} /></Field>
          <div className="sm:col-span-2"><Field label="Where"><input className="field" maxLength={80} value={f.location} onChange={(e) => setF({ ...f, location: e.target.value })} /></Field></div>
          <div className="sm:col-span-2"><Field label="Details"><textarea className="field min-h-20" maxLength={500} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></Field></div>
          {err && <p role="alert" className="text-sm text-rose sm:col-span-2">{err}</p>}
          <button className="btn btn-primary sm:col-span-2 sm:justify-self-end" disabled={create.isPending}>{create.isPending ? <Spinner /> : 'Publish event'}</button>
        </form>
      )}
      {list.isLoading ? <Skeleton rows={4} /> : list.error ? <ErrorBox error={list.error} /> : !list.data?.length ? <Empty title="Nothing scheduled" hint="Add the first event." /> : (
        <ol className="grid gap-3">
          {list.data.map((e) => (
            <li key={e.id} className="card flex gap-4 p-4 sm:p-5">
              <div className="w-16 shrink-0 text-center"><p className="eyebrow">{new Date(e.startsAt).toLocaleDateString(undefined, { month: 'short' })}</p><p className="display num text-4xl leading-none">{new Date(e.startsAt).getDate()}</p><p className="mt-1 text-[11px] font-semibold uppercase text-ink">{daysUntil(e.startsAt)}</p></div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap gap-1.5"><Chip tone={TONE[e.kind]}>{e.kind === 'deadline' ? 'Deadline' : e.kind === 'club' ? 'Club' : 'Event'}</Chip>{e.courseCode && <Chip className="num">{e.courseCode}</Chip>}</div>
                <h3 className="display mt-2 text-xl font-medium">{e.title}</h3>
                {e.description && <p className="mt-1 text-sm text-muted">{e.description}</p>}
                <p className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted"><span>{formatDay(e.startsAt)} · {formatTime(e.startsAt)}</span><span className="flex items-center gap-1"><MapPin size={12} />{e.location}</span><span className="flex items-center gap-1"><Users size={12} />{e.going} going</span></p>
              </div>
              <button className={cn('btn btn-sm self-start', e.iGo ? 'btn-primary' : 'btn-ghost')} onClick={() => go.mutate(e.id)}>{e.iGo ? <><Check size={14} />Going</> : 'Join'}</button>
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}
