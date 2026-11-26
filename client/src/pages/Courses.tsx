import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { GraduationCap, Search } from 'lucide-react'
import { api } from '@/api/client'
import type { Course } from '@/api/types'
import { useAuth } from '@/auth/AuthContext'
import Banner from '@/components/Banner'
import { FollowButton, MAX_COURSES } from '@/components/CourseFollow'
import { Empty, ErrorBox, Skeleton } from '@/components/ui'
import { deptOf } from '@/lib/utils'

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

/** One course: code, name and counts. The whole card opens the course forum; the small button adds it to my courses. */
export function CourseCard({ c }: { c: Course }) {
  const dot = deptOf(c.dept).dot
  return (
    <div className="card card-hover group relative overflow-hidden p-4" style={{ boxShadow: `inset 0 3px 0 ${dot}, var(--shadow-card)` }}>
      <span className="flex items-center gap-2">
        <span className="mono rounded-[5px] px-1.5 py-0.5 text-xs font-semibold" style={{ color: dot, background: `color-mix(in srgb, ${dot} 12%, var(--surface))` }}>{c.code}</span>
        <span className="min-w-0 truncate text-xs text-faint">{c.dept}</span>
        <FollowButton code={c.code} compact className="relative z-10 ml-auto shrink-0" />
      </span>
      <Link to={`/courses/${c.code}`} className="mt-2 block truncate text-sm font-medium text-ink after:absolute after:inset-0 after:content-['']">{c.name}</Link>
      <span className="mt-1 block text-xs text-muted">{plural(c.questions, 'post', 'posts')} · {c.open} open · {plural(c.resources, 'file', 'files')}</span>
    </div>
  )
}

export default function Courses() {
  const { me } = useAuth()
  const courses = useQuery({ queryKey: ['courses'], queryFn: api.courses.list })
  const [q, setQ] = useState('')
  if (!me) return null
  const all = courses.data ?? []
  const term = q.trim().toLowerCase()
  const match = (c: Course) => !term || `${c.code} ${c.name} ${c.dept}`.toLowerCase().includes(term)
  const mine = all.filter((c) => me.courses.includes(c.code) && match(c))
  const rest = all.filter((c) => !me.courses.includes(c.code) && match(c))
  const depts = [...new Set(rest.map((c) => c.dept))]
  return (
    <div>
      <Banner tone="plum" icon={<GraduationCap size={13} />} label="Courses" title="A forum for every course"
        sub="Open a course to see its discussion, files and dates. Add the ones you take so they show first, here and on your home page."
        stats={[['Courses', all.length], ['Yours', me.courses.length], ['Posts', all.reduce((s, c) => s + c.questions, 0)]]} />

      <label className="relative mb-8 block max-w-sm"><Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-faint" /><input className="field !pl-9" placeholder="Find a course by code or name" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Find a course" /></label>

      {courses.isLoading ? <Skeleton rows={4} /> : courses.error ? <ErrorBox error={courses.error} /> : (
        <div className="grid grid-cols-1 gap-8">
          <section className="hue-plum">
            <h2 className="mb-3 flex items-center gap-2 text-base font-semibold"><span className="tile size-7"><GraduationCap size={16} /></span>Your courses<span className="num rounded-sm border border-line bg-surface px-2 text-xs font-medium text-muted">{me.courses.length}</span>
              {me.courses.length >= MAX_COURSES && <span className="text-xs font-normal text-muted">You can keep up to {MAX_COURSES}.</span>}</h2>
            {mine.length ? <div className="stagger grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">{mine.map((c) => <CourseCard key={c.code} c={c} />)}</div>
              : <Empty title={term ? 'None of your courses match' : 'No courses yet'} hint={term ? 'Try another code or name.' : 'Use the plus button on a course to add it here. Your courses also show on your home page.'} />}
          </section>
          {depts.map((d) => (
            <section key={d}>
              <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-muted"><span className="size-2 rounded-full" style={{ background: deptOf(d).dot }} aria-hidden />{d}</h2>
              <div className="stagger grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">{rest.filter((c) => c.dept === d).map((c) => <CourseCard key={c.code} c={c} />)}</div>
            </section>
          ))}
          {term && !mine.length && !rest.length && <p className="text-sm text-muted">No course matches "{q.trim()}".</p>}
        </div>
      )}
    </div>
  )
}
