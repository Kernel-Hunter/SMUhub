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
export const KIND_TONE: Record<ResourceKind, string> = {
  notes: 'bg-sky-soft text-sky', exam: 'bg-rose-soft text-rose', summary: 'bg-moss-soft text-moss', slides: 'bg-gold-soft text-gold', tutorial: 'bg-accent-soft text-ink',
}
export const VOICE_LABEL: Record<VoiceCategory, string> = { academics: 'Academics', facilities: 'Facilities', admin: 'Administration', 'campus-life': 'Campus life', praise: 'Praise', idea: 'Idea' }
export const VOICE_TONE: Record<VoiceCategory, string> = {
  academics: 'bg-sky-soft text-sky', facilities: 'bg-gold-soft text-gold', admin: 'bg-rose-soft text-rose', 'campus-life': 'bg-accent-soft text-ink', praise: 'bg-moss-soft text-moss', idea: 'bg-moss-soft text-moss',
}
export const RENTAL_LABEL: Record<RentalCategory, string> = { calculator: 'Calculators', lab: 'Lab gear', books: 'Books', tech: 'Tech', other: 'Other' }

export function errMsg(e: unknown) { return e instanceof Error ? e.message : 'Something went wrong. Try again.' }

export function saveBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob)
  const a = Object.assign(document.createElement('a'), { href: url, download: name })
  document.body.appendChild(a); a.click(); a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}
