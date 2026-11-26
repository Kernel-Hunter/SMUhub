import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Newspaper, Pin, Trash2 } from 'lucide-react'
import { api } from '@/api/client'
import { COURSES } from '@/api/courses'
import { useAuth } from '@/auth/AuthContext'
import { Avatar, Empty, ErrorBox, Field, Skeleton, Spinner, useToast } from './ui'
import { cn, errMsg, formatDay, timeAgo } from '@/lib/utils'
import type { Announcement } from '@/api/types'

/** Announcements (US-18, US-19): short dated notices shown above the calendar. Server rules in server/src/routes/announcements.ts. */

const blank = { title: '', body: '', courseCode: '', until: '', pinned: false }
const SHOWN = 3

/** The "Post an announcement" form. `until` is a date: the notice stays up until the end of that day. */
export function AnnouncementForm({ onDone }: { onDone: () => void }) {
  const { me } = useAuth(); const qc = useQueryClient(); const toast = useToast()
  const [f, setF] = useState(blank); const [err, setErr] = useState('')
  const create = useMutation({
    mutationFn: () => api.announcements.create({ title: f.title, body: f.body, courseCode: f.courseCode || undefined, expiresAt: f.until ? new Date(`${f.until}T23:59:59`).getTime() : undefined, pinned: f.pinned || undefined }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['announcements'] }); setF(blank); toast('Announcement published.'); onDone() }, onError: (e) => setErr(errMsg(e)),
  })
  const submit = (e: FormEvent) => { e.preventDefault(); setErr(''); create.mutate() }
  const today = new Date(); today.setMinutes(today.getMinutes() - today.getTimezoneOffset())
  return (
    <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
      <div className="sm:col-span-2"><Field label="Title"><input className="field" required minLength={5} maxLength={120} value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="Library closed on Friday" /></Field></div>
      <div className="sm:col-span-2"><Field label="Message"><textarea className="field min-h-24" required minLength={10} maxLength={2000} value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} placeholder="What should students know?" /></Field></div>
      <Field label="Course" hint="Optional. Leave empty if it concerns everyone."><select className="field" value={f.courseCode} onChange={(e) => setF({ ...f, courseCode: e.target.value })}><option value="">All students</option>{COURSES.map(([code, name]) => <option key={code} value={code}>{code} · {name}</option>)}</select></Field>
      <Field label="Show until" hint="Optional. It disappears after this day."><input className="field" type="date" min={today.toISOString().slice(0, 10)} value={f.until} onChange={(e) => setF({ ...f, until: e.target.value })} /></Field>
      {me?.role === 'admin' && <label className="flex items-center gap-2 text-sm sm:col-span-2"><input type="checkbox" checked={f.pinned} onChange={(e) => setF({ ...f, pinned: e.target.checked })} />Pin to the top of the feed</label>}
      {err && <p role="alert" className="rounded-md bg-danger-soft px-3 py-2 text-sm text-danger sm:col-span-2">{err}</p>}
      <div className="flex items-center justify-between gap-3 sm:col-span-2"><p className="text-xs text-faint">Up to 3 announcements a day. They earn no XP.</p><button className="btn btn-primary h-10 px-6" disabled={create.isPending}>{create.isPending ? <Spinner /> : 'Publish announcement'}</button></div>
    </form>
  )
}

/** One announcement in the full feed, with a delete button for its author and for admins. */
function Item({ a, onDelete }: { a: Announcement; onDelete?: () => void }) {
  return (
    <li className={cn('card flex gap-4 p-4', a.pinned && 'hue-rose !border-[var(--hue-line)]')}>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          {a.pinned && <span className="chip bg-hue-soft text-hue"><Pin size={11} />Pinned</span>}
          {a.courseCode && <span className="chip num">{a.courseCode}</span>}
          <span className="text-xs text-muted">{timeAgo(a.createdAt)}</span>
          {a.expiresAt && <span className="text-xs text-faint">· until {formatDay(a.expiresAt)}</span>}
        </div>
        <h3 className="mt-2 text-base font-semibold leading-snug">{a.title}</h3>
        <p className="mt-1 whitespace-pre-line text-sm text-muted">{a.body}</p>
        <Link to={`/u/${a.author.id}`} className="mt-3 inline-flex items-center gap-2 text-xs text-muted hover:text-ink"><Avatar user={a.author} size={20} />{a.author.name}</Link>
      </div>
      {onDelete && <button type="button" aria-label="Delete announcement" title="Delete" onClick={onDelete} className="grid size-8 shrink-0 place-items-center self-start rounded-sm text-faint hover:bg-hover hover:text-danger"><Trash2 size={15} /></button>}
    </li>
  )
}

/** The feed: pinned first, then newest. Shows a few, the rest on demand. Filter by course. */
export function AnnouncementFeed({ onPost }: { onPost: () => void }) {
  const { me } = useAuth(); const qc = useQueryClient(); const toast = useToast()
  const [course, setCourse] = useState(''); const [all, setAll] = useState(false)
  const list = useQuery({ queryKey: ['announcements', course], queryFn: () => api.announcements.list(course || undefined) })
  const del = useMutation({ mutationFn: (id: string) => api.announcements.remove(id), onSuccess: () => { qc.invalidateQueries({ queryKey: ['announcements'] }); toast('Announcement deleted.') }, onError: (e) => toast(errMsg(e), 'err') })
  const items = list.data ?? []
  const shown = all ? items : items.slice(0, SHOWN)
  return (
    <section id="news" className="mb-8">
      <div className="hue-rose mb-3 flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-base font-semibold"><span className="tile size-7"><Newspaper size={16} /></span>Announcements{list.data && <span className="num rounded-sm border border-line bg-surface px-2 text-xs font-medium text-muted">{items.length}</span>}</h2>
        <select aria-label="Filter announcements by course" className="field !h-8 !w-auto text-xs" value={course} onChange={(e) => { setCourse(e.target.value); setAll(false) }}><option value="">All courses</option>{COURSES.map(([code]) => <option key={code} value={code}>{code}</option>)}</select>
      </div>
      {list.isLoading ? <Skeleton rows={2} /> : list.error ? <ErrorBox error={list.error} /> : !items.length
        ? <Empty title="No announcements" hint={course ? `Nothing for ${course} right now.` : 'Room changes, closures, club news: share it here.'} action={<button className="btn btn-secondary h-9" onClick={onPost}>Post an announcement</button>} />
        : <>
          <ol className="grid gap-3 stagger">{shown.map((a) => <Item key={a.id} a={a} onDelete={a.mine || me?.role === 'admin' ? () => confirm('Delete this announcement?') && del.mutate(a.id) : undefined} />)}</ol>
          {items.length > SHOWN && <button className="mt-3 text-xs font-medium text-accent hover:underline" onClick={() => setAll(!all)}>{all ? 'Show less' : `Show all ${items.length}`}</button>}
        </>}
    </section>
  )
}
