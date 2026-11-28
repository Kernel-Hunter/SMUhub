import { Link, useParams, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, CalendarDays, GraduationCap, MapPin, Plus, Upload, Users } from 'lucide-react'
import { api } from '@/api/client'
import { COURSES } from '@/api/courses'
import type { CampusEvent } from '@/api/types'
import Banner, { bannerBtn } from '@/components/Banner'
import { ResourceCard, ThreadCard } from '@/components/Cards'
import { FollowButton } from '@/components/CourseFollow'
import { Empty, ErrorBox, Segmented, Skeleton } from '@/components/ui'
import { cn, daysUntil, formatDay, formatTime } from '@/lib/utils'

type Tab = 'discussion' | 'files' | 'events'
const TABS: Tab[] = ['discussion', 'files', 'events']
const back = <Link to="/courses" className="mb-5 inline-flex items-center gap-2 text-sm font-medium text-muted hover:text-ink"><ArrowLeft size={14} />Courses</Link>

/** One calendar entry for this course, in the style of the home page list. */
function EventRow({ e }: { e: CampusEvent }) {
  return (
    <Link to="/events" className="flex items-center gap-4 bg-surface px-4 py-3 transition-colors hover:bg-bg">
      <span className={cn('grid size-10 shrink-0 place-content-center rounded-sm text-center', e.kind === 'deadline' ? 'bg-danger-soft text-danger' : e.kind === 'event' ? 'bg-accent-soft text-accent' : 'bg-subtle text-muted')}>
        <span className="num text-sm font-semibold leading-none">{new Date(e.startsAt).getDate()}</span>
        <span className="text-xs">{new Date(e.startsAt).toLocaleDateString(undefined, { month: 'short' })}</span>
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">{e.title}</span>
        <span className="mt-1 flex flex-wrap items-center gap-x-2 text-xs text-muted">{formatDay(e.startsAt)}, {formatTime(e.startsAt)}<span className="text-faint">·</span><span className="flex items-center gap-1"><MapPin size={12} />{e.location}</span><span className="text-faint">·</span><span className="flex items-center gap-1"><Users size={12} />{e.going} going</span></span>
      </span>
      <span className="hidden text-xs font-semibold text-muted sm:block">{daysUntil(e.startsAt)}</span>
    </Link>
  )
}

/** A course's forum: its questions (the discussion), files and calendar, at /courses/:code. */
export default function Course() {
  const code = (useParams().code ?? '').toUpperCase()
  const known = COURSES.some((c) => c[0] === code)
  const [sp, setSp] = useSearchParams()
  const tab = (TABS.includes(sp.get('tab') as Tab) ? sp.get('tab') : 'discussion') as Tab
  const sort = sp.get('sort') === 'top' ? 'top' : 'new', unsolved = sp.get('open') === '1'
  const set = (k: string, v: string) => setSp((p) => { const n = new URLSearchParams(p); v ? n.set(k, v) : n.delete(k); return n }, { replace: true })

  const course = useQuery({ queryKey: ['courses', code], queryFn: () => api.courses.get(code), enabled: known })
  const threads = useQuery({ queryKey: ['threads', 'question', { q: '', course: code, category: '', sort, unsolved }], queryFn: () => api.threads.list('question', { course: code, sort, unsolved }), enabled: known })
  const files = useQuery({ queryKey: ['resources', 'forum', code], queryFn: () => api.resources.list({ course: code }), enabled: known && tab === 'files' })
  const events = useQuery({ queryKey: ['events'], queryFn: api.events.list, enabled: known })

  if (!known) return (
    <div>{back}
      <Empty title={`There is no course with the code ${code || 'you typed'}`} hint="Check the code in the address, or pick the course from the list." action={<Link to="/courses" className="btn btn-primary">See all courses</Link>} />
    </div>
  )
  if (course.isLoading) return <Skeleton rows={4} />
  if (course.error || !course.data) return <ErrorBox error={course.error} />
  const c = course.data
  const dated = (events.data ?? []).filter((e) => e.courseCode === code)
  const newPost = <Link to={`/qa/new?course=${code}`} className={bannerBtn}><Plus size={15} />New post</Link>

  return (
    <div>
      {back}
      <Banner tone="plum" icon={<GraduationCap size={13} />} label={`${c.code} · ${c.dept}`} title={c.name}
        sub={`The ${c.code} forum. Ask about lectures, labs and exams, answer classmates, and find the files and dates for this course.`}
        stats={[['Posts', c.questions], ['Unanswered', c.open], ['Files', c.resources], ['Students', c.students]]}
        action={<>{newPost}<FollowButton code={c.code} /></>} />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
        <section className="min-w-0">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <Segmented value={tab} onChange={(v) => set('tab', v === 'discussion' ? '' : v)} options={[{ value: 'discussion', label: `Discussion ${c.questions}` }, { value: 'files', label: `Files ${c.resources}` }, { value: 'events', label: `Calendar ${c.events}` }]} />
            {tab === 'discussion' && (
              <div className="flex flex-wrap items-center gap-2">
                <button onClick={() => set('open', unsolved ? '' : '1')} aria-pressed={unsolved} className={cn('chip h-8 cursor-pointer px-3 text-xs transition-colors', unsolved ? 'bg-accent-soft text-accent ring-1 ring-accent' : 'hover:text-ink')}>Unanswered only</button>
                <Segmented value={sort} onChange={(v) => set('sort', v === 'new' ? '' : v)} options={[{ value: 'new', label: 'Newest' }, { value: 'top', label: 'Top voted' }]} />
              </div>
            )}
            {tab === 'files' && <Link to={`/resources/new?course=${code}`} className="btn btn-secondary btn-sm"><Upload size={14} />Share a file</Link>}
            {tab === 'events' && <Link to="/events" className="btn btn-secondary btn-sm"><CalendarDays size={14} />Open calendar</Link>}
          </div>

          {tab === 'discussion' && (threads.isLoading ? <Skeleton rows={4} /> : threads.error ? <ErrorBox error={threads.error} />
            : !threads.data?.length ? <Empty title={unsolved ? 'Every post has an answer' : 'No posts yet'} hint={unsolved ? 'Nothing is waiting for an answer in this course.' : `Start the ${code} discussion. Ask about a lecture, a lab or an exam.`} action={unsolved ? undefined : <Link to={`/qa/new?course=${code}`} className="btn btn-primary"><Plus size={15} />New post</Link>} />
            : <div className="rows stagger">{threads.data.map((t) => <ThreadCard key={t.id} t={t} />)}</div>)}

          {tab === 'files' && (files.isLoading ? <Skeleton rows={4} /> : files.error ? <ErrorBox error={files.error} />
            : !files.data?.length ? <Empty title="No files yet" hint={`Share notes, past exams or slides for ${code} and classmates can find them here.`} action={<Link to={`/resources/new?course=${code}`} className="btn btn-primary"><Upload size={15} />Share a file</Link>} />
            : <div className="rows stagger">{files.data.map((r) => <ResourceCard key={r.id} r={r} />)}</div>)}

          {tab === 'events' && (events.isLoading ? <Skeleton rows={3} /> : events.error ? <ErrorBox error={events.error} />
            : !dated.length ? <Empty title="Nothing on the calendar" hint={`No exams, deadlines or meetups are listed for ${code} yet.`} action={<Link to="/events" className="btn btn-primary"><CalendarDays size={15} />Open calendar</Link>} />
            : <div className="rows stagger">{dated.map((e) => <EventRow key={e.id} e={e} />)}</div>)}
        </section>

        <aside className="grid h-fit gap-4 lg:sticky lg:top-16">
          <div className="card hue-rose p-5">
            <div className="mb-3 flex items-center justify-between"><h2 className="flex items-center gap-2 text-sm font-semibold"><span className="tile size-7"><CalendarDays size={15} /></span>Coming up</h2>{dated.length > 0 && <button onClick={() => set('tab', 'events')} className="text-xs font-medium text-accent hover:underline">See all</button>}</div>
            {dated.length ? (
              <ol className="grid grid-cols-1 gap-1">{dated.slice(0, 3).map((e) => (
                <li key={e.id} className="flex items-center gap-3 rounded-sm px-2 py-2">
                  <span className={cn('grid size-9 shrink-0 place-content-center rounded-sm text-center', e.kind === 'deadline' ? 'bg-danger-soft text-danger' : 'bg-accent-soft text-accent')}><span className="num text-sm font-semibold">{new Date(e.startsAt).getDate()}</span></span>
                  <span className="min-w-0"><span className="block truncate text-sm font-medium">{e.title}</span><span className="text-xs text-muted">{daysUntil(e.startsAt)}</span></span>
                </li>))}</ol>
            ) : <p className="text-xs text-muted">Nothing on the calendar for {code}.</p>}
          </div>
          <div className="card p-5 text-xs leading-relaxed text-muted">
            <p className="mb-2 text-sm font-semibold text-ink">How this forum works</p>
            Every post here belongs to {code}. Upvote what helps, answer what you can, and the person who asked marks the answer that worked. Answers earn XP when classmates upvote them or when they are accepted.
          </div>
        </aside>
      </div>
    </div>
  )
}
