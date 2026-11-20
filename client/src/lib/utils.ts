import type { ResourceKind, VoiceCategory, RentalCategory } from '@/api/types'

export const cn = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ')

export function timeAgo(t: number) {
  const s = Math.max(1, Math.round((Date.now() - t) / 1000))
  if (s < 60) return 'just now'
  const m = Math.round(s / 60); if (m < 60) return `${m}m ago`
  const h = Math.round(m / 60); if (h < 24) return `${h}h ago`
  const d = Math.round(h / 24); if (d < 30) return `${d}d ago`
  return new Date(t).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}
export const formatSize = (b: number) => (b >= 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`)
export const formatDay = (t: number) => new Date(t).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })
export const formatTime = (t: number) => new Date(t).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
export function daysUntil(t: number) {
  const d = Math.ceil((t - Date.now()) / 86400000)
  return d <= 0 ? 'Today' : d === 1 ? 'Tomorrow' : `In ${d} days`
}

export const KIND_LABEL: Record<ResourceKind, string> = { notes: 'Notes', exam: 'Past exam', summary: 'Summary', slides: 'Slides', tutorial: 'Tutorial' }
// Types and categories are told apart by their label, not by colour (colour is for the accent and states).
const NEUTRAL = 'bg-subtle text-muted'
export const KIND_TONE: Record<ResourceKind, string> = { notes: NEUTRAL, exam: NEUTRAL, summary: NEUTRAL, slides: NEUTRAL, tutorial: NEUTRAL }
export const VOICE_LABEL: Record<VoiceCategory, string> = { academics: 'Academics', facilities: 'Facilities', admin: 'Administration', 'campus-life': 'Campus life', praise: 'Praise', idea: 'Idea' }
export const VOICE_TONE: Record<VoiceCategory, string> = { academics: NEUTRAL, facilities: NEUTRAL, admin: NEUTRAL, 'campus-life': NEUTRAL, praise: NEUTRAL, idea: NEUTRAL }
export const RENTAL_LABEL: Record<RentalCategory, string> = { calculator: 'Calculators', lab: 'Lab gear', books: 'Books', tech: 'Tech', other: 'Other' }

export function errMsg(e: unknown) { return e instanceof Error ? e.message : 'Something went wrong. Try again.' }

export function saveBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob)
  const a = Object.assign(document.createElement('a'), { href: url, download: name })
  document.body.appendChild(a); a.click(); a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}

/** One muted colour per department, shown only as a small dot to tell courses apart.
 *  from/to/soft/ink are legacy fields kept until every page is migrated. */
export const DEPT: Record<string, { dot: string; from: string; to: string; soft: string; ink: string }> = {
  'Computer Science': { dot: '#4f86a6', from: '#3b5bff', to: '#7b93ff', soft: 'var(--accent-soft)', ink: 'var(--accent)' },
  Mathematics: { dot: '#7d72a8', from: '#7b5cf5', to: '#b49cff', soft: 'var(--violet-soft)', ink: 'var(--violet)' },
  Physics: { dot: '#4a9690', from: '#0b8f9e', to: '#4cc9d6', soft: 'var(--sky-soft)', ink: 'var(--sky)' },
  Engineering: { dot: '#b08350', from: '#f2711c', to: '#ffae6b', soft: 'var(--orange-soft)', ink: 'var(--orange)' },
  Languages: { dot: '#a86a78', from: '#d63d6b', to: '#ff8fae', soft: 'var(--rose-soft)', ink: 'var(--rose)' },
  Business: { dot: '#6b8f5e', from: '#13795b', to: '#4cc99a', soft: 'var(--moss-soft)', ink: 'var(--moss)' },
  Law: { dot: '#8f8257', from: '#b7791f', to: '#f0c05a', soft: 'var(--gold-soft)', ink: 'var(--gold)' },
}
export const deptOf = (d: string) => DEPT[d] ?? DEPT['Computer Science']
