import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Check, Plus } from 'lucide-react'
import { api } from '@/api/client'
import { useAuth } from '@/auth/AuthContext'
import { Spinner, useToast } from './ui'
import { cn, errMsg } from '@/lib/utils'

/** Same cap as PATCH /api/me (server/src/routes/me.ts). */
export const MAX_COURSES = 12

/** Adds a course to the student's own courses (me.courses) or takes it off, through PATCH /api/me. */
export function useFollow() {
  const { me } = useAuth(); const qc = useQueryClient(); const toast = useToast()
  const mine = me?.courses ?? []
  const m = useMutation({
    mutationFn: (code: string) => api.me.update({ courses: mine.includes(code) ? mine.filter((c) => c !== code) : [...mine, code] }),
    onSuccess: (next, code) => {
      qc.setQueryData(['me'], next); qc.invalidateQueries({ queryKey: ['courses'] })
      toast(next.courses.includes(code) ? `${code} is in your courses now.` : `${code} was taken off your courses.`)
    },
    onError: (e) => toast(errMsg(e), 'err'),
  })
  return { mine, toggle: m.mutate, pending: m.isPending ? m.variables : undefined, full: mine.length >= MAX_COURSES }
}

/** "Add to my courses" / "In my courses" button. `compact` is the small square version used on course cards. */
export function FollowButton({ code, compact, className }: { code: string; compact?: boolean; className?: string }) {
  const { mine, toggle, pending, full } = useFollow()
  const on = mine.includes(code), busy = pending === code
  const label = on ? `Remove ${code} from my courses` : full ? `You can keep up to ${MAX_COURSES} courses` : `Add ${code} to my courses`
  const icon = busy ? <Spinner /> : on ? <Check size={compact ? 14 : 15} /> : <Plus size={compact ? 14 : 15} />
  if (compact) {
    return (
      <button type="button" onClick={() => toggle(code)} disabled={busy || (!on && full)} aria-pressed={on} aria-label={label} title={label}
        className={cn('grid size-7 place-items-center rounded-sm border transition-colors disabled:opacity-50', on ? 'border-transparent bg-hue-soft text-hue' : 'border-line bg-surface text-muted hover:border-line-strong hover:text-ink', className)}>{icon}</button>
    )
  }
  return (
    <button type="button" onClick={() => toggle(code)} disabled={busy || (!on && full)} aria-pressed={on} title={label} className={cn('btn btn-secondary h-9', className)}>
      {icon}{on ? 'In my courses' : 'Add to my courses'}
    </button>
  )
}
