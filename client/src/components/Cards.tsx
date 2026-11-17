import { Link } from 'react-router-dom'
import { BadgeCheck, CheckCircle2, Download, FileImage, FileSpreadsheet, FileText, MessageSquare, Presentation, ThumbsUp } from 'lucide-react'
import type { Resource, Thread } from '@/api/types'
import { Avatar, Chip } from './ui'
import { KIND_LABEL, VOICE_LABEL, VOICE_TONE, formatSize, timeAgo } from '@/lib/utils'

const FILE: Record<string, [typeof FileText, string]> = {
  pdf: [FileText, 'bg-rose-soft text-rose'], docx: [FileText, 'bg-sky-soft text-sky'], pptx: [Presentation, 'bg-gold-soft text-gold'],
  xlsx: [FileSpreadsheet, 'bg-moss-soft text-moss'], png: [FileImage, 'bg-paper text-muted'], jpg: [FileImage, 'bg-paper text-muted'],
}

export function ResourceCard({ r }: { r: Resource }) {
  const [Icon, tone] = FILE[r.ext] ?? FILE.pdf
  return (
    <Link to={`/resources/${r.id}`} className="card card-hover group flex items-start gap-4 p-4">
      <span className={`grid size-11 shrink-0 place-items-center rounded-lg ${tone}`}><Icon size={20} strokeWidth={1.75} /></span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2 text-xs text-muted">
          <span className="num font-semibold text-ink">{r.courseCode}</span><span>·</span><span>{KIND_LABEL[r.kind]}</span><span>·</span><span>{r.semester} {r.academicYear}</span>
          {r.verified && <span className="ml-auto flex items-center gap-1 font-medium text-accent"><BadgeCheck size={14} />Verified</span>}
        </span>
        <span className="mt-1 block text-[15px] font-semibold leading-snug group-hover:text-accent">{r.title}</span>
        <span className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
          <span className="flex items-center gap-1.5"><Avatar user={r.uploader} size={18} />{r.uploader.name}</span>
          <span className="flex items-center gap-1"><ThumbsUp size={12} />{r.helpful}</span><span className="flex items-center gap-1"><Download size={12} />{r.downloads}</span>
          <span>{r.ext.toUpperCase()} · {formatSize(r.fileSize)}</span><span>{timeAgo(r.createdAt)}</span>
        </span>
      </span>
    </Link>
  )
}

export function ThreadCard({ t }: { t: Thread }) {
  const base = t.kind === 'question' ? '/qa' : '/voice'
  return (
    <Link to={`${base}/${t.id}`} className="card card-hover group flex gap-4 p-4">
      <span className="flex w-11 shrink-0 flex-col items-center self-start rounded-lg bg-paper py-1.5"><svg viewBox="0 0 16 16" className="size-3.5 text-faint" fill="currentColor" aria-hidden><path d="M8 3l5 7H3z" /></svg><span className="num text-xs font-semibold">{t.votes}</span></span>
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-1.5">
          {t.courseCode && <Chip className="num">{t.courseCode}</Chip>}
          {t.category && <Chip tone={VOICE_TONE[t.category]}>{VOICE_LABEL[t.category]}</Chip>}
          {t.solved && <Chip tone="bg-moss-soft text-moss"><CheckCircle2 size={12} />Solved</Chip>}
        </span>
        <span className="mt-1.5 block text-[15px] font-semibold leading-snug group-hover:text-accent">{t.title}</span>
        <span className="mt-1 line-clamp-2 text-sm text-muted">{t.body}</span>
        <span className="mt-2.5 flex items-center gap-2 text-xs text-muted">
          <Avatar user={t.author} size={18} />{t.author ? t.author.name : 'Anonymous student'}<span>·</span>
          <span className="flex items-center gap-1"><MessageSquare size={12} />{t.replyCount}</span><span>·</span><span>{timeAgo(t.createdAt)}</span>
        </span>
      </span>
    </Link>
  )
}
