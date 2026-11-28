import { Link } from 'react-router-dom'
import { BadgeCheck, ChevronRight, Download, MessageSquare, ThumbsUp } from 'lucide-react'
import type { Resource, Thread } from '@/api/types'
import { Avatar } from './ui'
import { KIND_LABEL, VOICE_LABEL, VOICE_TONE, timeAgo, cn } from '@/lib/utils'


const EXT_HUE: Record<string, string> = { pdf: 'rose', docx: 'blue', pptx: 'orange', xlsx: 'green', png: 'violet', jpg: 'violet' }

export function FileBadge({ ext, size = 'md' }: { ext: string; size?: 'md' | 'lg' }) {
  return (
    <span className={cn(`hue-${EXT_HUE[ext] ?? 'blue'}`, 'tile font-mono font-semibold uppercase', size === 'lg' ? 'h-14 w-12 text-xs' : 'h-10 w-10 text-xs')} aria-hidden>{ext}</span>
  )
}

export function ResourceCard({ r }: { r: Resource }) {
  return (
    <Link to={`/resources/${r.id}`} className="group flex items-center gap-4 bg-surface px-4 py-3 transition-colors hover:bg-bg">
      <FileBadge ext={r.ext} />
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2"><span className="truncate text-sm font-medium">{r.title}</span>{r.verified && <BadgeCheck size={14} className="shrink-0 text-accent" aria-label="Verified" />}</span>
        <span className="mt-1 flex min-w-0 items-center gap-x-3 text-xs text-muted"><span className="mono font-medium text-ink">{r.courseCode}</span><span className="shrink-0">{KIND_LABEL[r.kind]}</span><span className="min-w-0 truncate">{r.uploader.name}</span><span className="shrink-0 text-faint">{timeAgo(r.createdAt)}</span></span>
      </span>
      <span className="num hidden items-center gap-4 text-xs text-muted sm:flex">
        <span className="flex w-10 items-center gap-1" title="Found helpful"><ThumbsUp size={14} aria-hidden /><span className="sr-only">Found helpful:</span>{r.helpful}</span>
        <span className="flex w-12 items-center gap-1" title="Downloads"><Download size={14} aria-hidden /><span className="sr-only">Downloads:</span>{r.downloads}</span>
      </span>
      <ChevronRight size={16} className="text-faint opacity-0 transition-opacity group-hover:opacity-100 [@media(hover:none)]:hidden" aria-hidden />
    </Link>
  )
}

export function ThreadCard({ t }: { t: Thread }) {
  const base = t.kind === 'question' ? '/qa' : '/voice'
  return (
    <Link to={`${base}/${t.id}`} className="group flex gap-4 bg-surface px-4 py-4 transition-colors hover:bg-bg">
      <span className="flex w-9 shrink-0 flex-col items-center pt-1 text-muted" aria-label={`${t.votes} votes`}><svg viewBox="0 0 12 12" className="size-2.5" fill="currentColor" aria-hidden><path d="M6 2l4.5 6h-9z" /></svg><span className="num text-sm font-semibold text-ink">{t.votes}</span></span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium leading-snug">{t.title}</span>
        <span className="mt-1 line-clamp-1 text-xs text-muted">{t.body}</span>
        <span className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
          {t.courseCode && <span className="chip num">{t.courseCode}</span>}
          {t.category && <span className={cn('chip', VOICE_TONE[t.category])}>{VOICE_LABEL[t.category]}</span>}
          {t.solved && <span className="chip bg-success-soft text-success">Solved</span>}
          <span className="flex items-center gap-2"><Avatar user={t.author} size={16} />{t.author ? t.author.name : 'Anonymous'}</span>
          <span className="flex items-center gap-1" title="Replies"><MessageSquare size={14} aria-hidden /><span className="sr-only">Replies:</span>{t.replyCount}</span>
          <span className="text-faint">{timeAgo(t.createdAt)}</span>
        </span>
      </span>
    </Link>
  )
}
