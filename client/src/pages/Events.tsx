import { useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CalendarDays, Check, MapPin, Plus, Users, X } from 'lucide-react'
import { api } from '@/api/mock'
import Banner, { bannerBtn } from '@/components/Banner'
import Calendar from '@/components/Calendar'
import { Empty, ErrorBox, Field, Segmented, Skeleton, Spinner, useToast } from '@/components/ui'
import { cn, daysUntil, errMsg, formatDay, formatTime } from '@/lib/utils'
import type { CampusEvent } from '@/api/types'

type Kind = CampusEvent['kind']
const KIND: Record<Kind, { label: string; tone: string; soft: string; dot: string }> = {
  event: { label: 'Event', tone: 'tone-blue', soft: 'bg-accent-soft text-accent', dot: 'bg-accent' },
  deadline: { label: 'Deadline', tone: 'tone-rose', soft: 'bg-rose-soft text-rose', dot: 'bg-rose' },
  club: { label: 'Club', tone: 'tone-green', soft: 'bg-moss-soft text-moss', dot: 'bg-moss' },
}
const blank = { title: '', kind: 'event' as Kind, when: '', location: '', description: '' }

export default function Events() {
  const qc = useQueryClient(); const toast = useToast()
  const list = useQuery({ queryKey: ['events'], queryFn: api.events.list })
  const [open, setOpen] = useState(false); const [err, setErr] = useState(''); const [f, setF] = useState(blank)
  const [kind, setKind] = useState<Kind | 'all'>('all'); const [day, setDay] = useState<number>()
  const go = useMutation({ mutationFn: (id: string) => api.events.toggleGoing(id), onSuccess: () => qc.invalidateQueries({ queryKey: ['events'] }), onError: (e) => toast(errMsg(e), 'err') })
  const create = useMutation({
    mutationFn: () => api.events.create({ title: f.title, kind: f.kind, startsAt: new Date(f.when).getTime(), location: f.location, description: f.description }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['events'] }); setOpen(false); setF(blank); toast('Event added.') }, onError: (e) => setErr(errMsg(e)),
  })
  const submit = (e: FormEvent) => { e.preventDefault(); setErr(''); create.mutate() }

  const all = list.data ?? []
  const now = new Date(), thisMonth = (t: number) => { const d = new Date(t); return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear() }
  const days = new Map<number, string>(); all.filter((e) => thisMonth(e.startsAt)).forEach((e) => { const d = new Date(e.startsAt).getDate(); if (days.get(d) !== 'deadline') days.set(d, e.kind) })
  const shown = all.filter((e) => (kind === 'all' || e.kind === kind) && (!day || (thisMonth(e.startsAt) && new Date(e.startsAt).getDate() === day)))
  const week = Date.now() + 7 * 86400000
  const groups: [string, CampusEvent[]][] = ([['Next 7 days', shown.filter((e) => e.startsAt <= week)], ['Later', shown.filter((e) => e.startsAt > week)]] as [string, CampusEvent[]][]).filter(([, l]) => l.length)

  return (
    <div>
      <Banner tone="rose" icon={<CalendarDays size={13} />} label="Calendar" title="What's coming up" sub="Exams, project deadlines and club meetups in one place. Join an event to keep it on your home page."
        stats={[['This month', all.filter((e) => thisMonth(e.startsAt)).length], ['Deadlines', all.filter((e) => e.kind === 'deadline').length], ["You're going", all.filter((e) => e.iGo).length]]}
        action={<button className={bannerBtn} onClick={() => setOpen(!open)}>{open ? <X size={15} /> : <Plus size={15} />}{open ? 'Close' : 'Add an event'}</button>} />

      {open && (
        <form onSubmit={submit} className="card rise mb-7 grid gap-4 p-6 sm:grid-cols-2">
          <div className="sm:col-span-2"><Field label="Title"><input className="field" required maxLength={100} value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></Field></div>
          <div><span className="label">Type</span><div className="flex gap-2">{(Object.keys(KIND) as Kind[]).map((k) => <button type="button" key={k} onClick={() => setF({ ...f, kind: k })} className={cn('chip h-9 flex-1 cursor-pointer justify-center text-[12.5px] transition', f.kind === k ? KIND[k].soft + ' ring-1 ring-current' : 'hover:text-ink')}>{KIND[k].label}</button>)}</div></div>
          <Field label="When"><input className="field" type="datetime-local" required value={f.when} onChange={(e) => setF({ ...f, when: e.target.value })} /></Field>
          <div className="sm:col-span-2"><Field label="Where"><input className="field" maxLength={80} value={f.location} onChange={(e) => setF({ ...f, location: e.target.value })} placeholder="Room, building or link" /></Field></div>
          <div className="sm:col-span-2"><Field label="Details"><textarea className="field min-h-20" maxLength={500} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></Field></div>
          {err && <p role="alert" className="rounded-[10px] bg-rose-soft px-3 py-2 text-[13px] text-rose sm:col-span-2">{err}</p>}
          <div className="flex justify-end sm:col-span-2"><button className="btn btn-primary h-10 px-6" disabled={create.isPending}>{create.isPending ? <Spinner /> : 'Publish event'}</button></div>
        </form>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <section className="min-w-0">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <Segmented value={kind} onChange={setKind} options={[{ value: 'all', label: 'All' }, { value: 'event', label: 'Events' }, { value: 'deadline', label: 'Deadlines' }, { value: 'club', label: 'Clubs' }]} />
            {day && <button onClick={() => setDay(undefined)} className="chip cursor-pointer gap-1 hover:text-ink"><X size={12} />{now.toLocaleDateString(undefined, { month: 'long' })} {day}</button>}
          </div>
          {list.isLoading ? <Skeleton rows={4} /> : list.error ? <ErrorBox error={list.error} /> : !groups.length ? <Empty title="Nothing scheduled" hint={day ? 'Nothing on that day. Pick another one.' : 'Add the first event.'} /> : groups.map(([g, items]) => (
            <div key={g} className="mb-6">
              <p className="mb-2.5 px-0.5 text-[12px] font-semibold uppercase tracking-wider text-faint">{g}</p>
              <ol className="grid gap-3 stagger">
                {items.map((e) => { const k = KIND[e.kind]; const d = new Date(e.startsAt); return (
                  <li key={e.id} className="card card-hover flex gap-4 p-4">
                    <div className={cn(k.tone, 'grid w-[62px] shrink-0 content-center rounded-[14px] py-2.5 text-center text-white')}>
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-white/80">{d.toLocaleDateString(undefined, { month: 'short' })}</p>
                      <p className="num text-[26px] font-semibold leading-none">{d.getDate()}</p>
                      <p className="mt-1 text-[10.5px] font-medium text-white/85">{d.toLocaleDateString(undefined, { weekday: 'short' })}</p>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5"><span className={cn('chip', k.soft)}>{k.label}</span>{e.courseCode && <span className="chip num">{e.courseCode}</span>}<span className="text-[11.5px] font-semibold text-muted">{daysUntil(e.startsAt)}</span></div>
                      <h3 className="mt-1.5 text-[15.5px] font-semibold leading-snug">{e.title}</h3>
                      {e.description && <p className="mt-0.5 line-clamp-2 text-[13px] text-muted">{e.description}</p>}
                      <p className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-muted"><span>{formatDay(e.startsAt)} · {formatTime(e.startsAt)}</span>{e.location && <span className="flex items-center gap-1"><MapPin size={12} />{e.location}</span>}<span className="flex items-center gap-1"><Users size={12} />{e.going} going</span></p>
                    </div>
                    <button className={cn('btn btn-sm self-start', e.iGo ? 'bg-moss text-white hover:bg-moss/90' : 'btn-ghost')} onClick={() => go.mutate(e.id)}>{e.iGo ? <><Check size={14} />Going</> : 'Join'}</button>
                  </li>) })}
              </ol>
            </div>
          ))}
        </section>

        <aside className="grid h-fit gap-4 lg:sticky lg:top-16">
          <div className="card p-5">
            <div className="mb-4 flex items-center justify-between"><p className="text-[15px] font-semibold">{now.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</p><span className="text-[12px] text-muted">Tap a day</span></div>
            <Calendar days={days} size="lg" selected={day} onSelect={(d) => setDay(day === d ? undefined : d)} />
            <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1 border-t border-line pt-4 text-[12px] text-muted">{(Object.keys(KIND) as Kind[]).map((k) => <span key={k} className="flex items-center gap-1.5"><span className={cn('size-2 rounded-full', KIND[k].dot)} />{KIND[k].label}</span>)}</div>
          </div>
          <div className="card p-5 text-[12.5px] leading-relaxed text-muted"><p className="mb-1 text-[13px] font-semibold text-ink">Anyone can add an event</p>Keep it to things that matter for SMU students. Wrong dates or spam get removed.</div>
        </aside>
      </div>
    </div>
  )
}
