import { Link } from 'react-router-dom'
import { BadgeCheck, ChevronRight, Download, MessageSquare, ThumbsUp } from 'lucide-react'
import type { Resource, Thread } from '@/api/types'
import { Avatar } from './ui'
import { KIND_LABEL, VOICE_LABEL, VOICE_TONE, timeAgo, cn } from '@/lib/utils'

const EXT_TONE: Record<string, string> = { pdf: 'bg-rose-soft text-rose', docx: 'bg-sky-soft text-sky', pptx: 'bg-gold-soft text-gold', xlsx: 'bg-moss-soft text-moss', png: 'bg-hover text-muted', jpg: 'bg-hover text-muted' }

export function FileBadge({ ext, size = 'md' }: { ext: string; size?: 'md' | 'lg' }) {
  return (
    <span className={cn('relative grid shrink-0 place-items-center rounded-sm font-mono font-semibold uppercase', EXT_TONE[ext] ?? EXT_TONE.png, size === 'lg' ? 'h-14 w-11 text-xs' : 'h-10 w-8 text-xs')}>
      <span className="absolute right-0 top-0 size-2.5 rounded-bl-sm bg-paper/70" aria-hidden />{ext}
    </span>
  )
}

export function ResourceCard({ r }: { r: Resource }) {
  return (
    <Link to={`/resources/${r.id}`} className="group flex items-center gap-4 bg-surface px-4 py-3 transition-colors hover:bg-hover">
      <FileBadge ext={r.ext} />
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2"><span className="truncate text-sm font-medium">{r.title}</span>{r.verified && <BadgeCheck size={14} className="shrink-0 text-accent" aria-label="Verified" />}</span>
        <span className="mt-1 block truncate text-xs text-muted"><span className="font-medium text-ink/80">{r.courseCode}</span> · {KIND_LABEL[r.kind]} · {r.uploader.name} · {timeAgo(r.createdAt)}</span>
      </span>
      <span className="num hidden items-center gap-4 text-xs text-muted sm:flex">
        <span className="flex w-10 items-center gap-1" title="Found helpful"><ThumbsUp size={13} />{r.helpful}</span>
        <span className="flex w-12 items-center gap-1" title="Downloads"><Download size={13} />{r.downloads}</span>
      </span>
      <ChevronRight size={15} className="text-faint opacity-0 transition group-hover:translate-x-0.5 group-hover:opacity-100" />
    </Link>
  )
}

export function ThreadCard({ t }: { t: Thread }) {
  const base = t.kind === 'question' ? '/qa' : '/voice'
  return (
    <Link to={`${base}/${t.id}`} className="group flex gap-4 bg-surface px-4 py-4 transition-colors hover:bg-hover">
      <span className="flex w-9 shrink-0 flex-col items-center pt-1 text-muted"><svg viewBox="0 0 12 12" className="size-2.5" fill="currentColor" aria-hidden><path d="M6 2l4.5 6h-9z" /></svg><span className="num text-sm font-semibold text-ink">{t.votes}</span></span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium leading-snug">{t.title}</span>
        <span className="mt-1 line-clamp-1 text-xs text-muted">{t.body}</span>
        <span className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
          {t.courseCode && <span className="chip num">{t.courseCode}</span>}
          {t.category && <span className={cn('chip', VOICE_TONE[t.category])}>{VOICE_LABEL[t.category]}</span>}
          {t.solved && <span className="chip bg-moss-soft text-moss">Solved</span>}
          <span className="flex items-center gap-2"><Avatar user={t.author} size={16} />{t.author ? t.author.name : 'Anonymous'}</span>
          <span className="text-faint">·</span><span className="flex items-center gap-1"><MessageSquare size={12} />{t.replyCount}</span>
          <span className="text-faint">·</span><span>{timeAgo(t.createdAt)}</span>
        </span>
      </span>
    </Link>
  )
}
