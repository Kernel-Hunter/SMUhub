import { Link } from 'react-router-dom'
import { BadgeCheck, Download, MessageSquare, ThumbsUp, FileText, FileSpreadsheet, FileImage, Presentation, CheckCircle2 } from 'lucide-react'
import type { Resource, Thread } from '@/api/types'
import { Avatar, Chip } from './ui'
import { KIND_LABEL, KIND_TONE, VOICE_LABEL, VOICE_TONE, formatSize, timeAgo } from '@/lib/utils'

const ICON: Record<string, typeof FileText> = { pdf: FileText, docx: FileText, pptx: Presentation, xlsx: FileSpreadsheet, png: FileImage, jpg: FileImage }

export function ResourceCard({ r }: { r: Resource }) {
  const Icon = ICON[r.ext] ?? FileText
  return (
    <Link to={`/resources/${r.id}`} className="card card-hover group flex gap-4 p-4">
      <span className="grid size-14 shrink-0 place-items-center rounded-2xl bg-paper text-ink"><Icon size={24} strokeWidth={1.5} /></span>
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-1.5">
          <Chip tone={KIND_TONE[r.kind]}>{KIND_LABEL[r.kind]}</Chip>
          <Chip className="num">{r.courseCode}</Chip>
          {r.verified && <Chip tone="bg-moss-soft text-moss"><BadgeCheck size={13} />Verified</Chip>}
        </span>
        <span className="display mt-2 block truncate text-lg font-medium leading-snug group-hover:text-accent">{r.title}</span>
        <span className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
          <span className="flex items-center gap-1.5"><Avatar user={r.uploader} size={18} />{r.uploader.name}</span>
          <span className="flex items-center gap-1"><ThumbsUp size={12} />{r.helpful}</span>
          <span className="flex items-center gap-1"><Download size={12} />{r.downloads}</span>
          <span>{r.ext.toUpperCase()} · {formatSize(r.fileSize)}</span><span>{timeAgo(r.createdAt)}</span>
        </span>
      </span>
    </Link>
  )
}

export function ThreadCard({ t }: { t: Thread }) {
  const base = t.kind === 'question' ? '/qa' : '/voice'
  return (
    <Link to={`${base}/${t.id}`} className="card card-hover flex gap-4 p-4 sm:p-5">
      <span className="flex w-10 shrink-0 flex-col items-center rounded-xl bg-paper py-2"><span className="num text-base font-semibold">{t.votes}</span><span className="text-[10px] uppercase tracking-wider text-faint">votes</span></span>
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-1.5">
          {t.courseCode && <Chip className="num">{t.courseCode}</Chip>}
          {t.category && <Chip tone={VOICE_TONE[t.category]}>{VOICE_LABEL[t.category]}</Chip>}
          {t.solved && <Chip tone="bg-moss-soft text-moss"><CheckCircle2 size={13} />Solved</Chip>}
        </span>
        <span className="display mt-2 block text-lg font-medium leading-snug">{t.title}</span>
        <span className="mt-1 line-clamp-2 text-sm text-muted">{t.body}</span>
        <span className="mt-3 flex items-center gap-3 text-xs text-muted">
          <span className="flex items-center gap-1.5"><Avatar user={t.author} size={18} />{t.author ? t.author.name : 'Anonymous student'}</span>
          <span className="flex items-center gap-1"><MessageSquare size={12} />{t.replyCount}</span><span>{timeAgo(t.createdAt)}</span>
        </span>
      </span>
    </Link>
  )
}
