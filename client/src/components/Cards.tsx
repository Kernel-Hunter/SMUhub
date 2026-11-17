import { Link } from 'react-router-dom'
import type { Resource, Thread } from '@/api/types'
import { Avatar, Chip } from './ui'
import { KIND_LABEL, KIND_TONE, VOICE_LABEL, VOICE_TONE, formatSize, timeAgo, cn } from '@/lib/utils'

/** Resource card: an arched course "window" beside the details. */
export function ResourceCard({ r, lead }: { r: Resource; lead?: boolean }) {
  return (
    <Link to={`/resources/${r.id}`} className={cn('card card-hover group flex gap-5 p-4', lead && 'sm:p-6')}>
      <span className={cn('zellige arch flex shrink-0 flex-col items-center justify-end bg-cobalt-soft pb-3 text-center text-cobalt', lead ? 'h-44 w-32' : 'h-28 w-20')}>
        <span className={cn('num font-bold leading-none', lead ? 'text-xl' : 'text-sm')}>{r.courseCode}</span>
        <span className="mt-1 text-[10px] font-bold uppercase tracking-widest opacity-70">{r.ext}</span>
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="flex flex-wrap items-center gap-1.5"><Chip tone={KIND_TONE[r.kind]}>{KIND_LABEL[r.kind]}</Chip>{r.verified && <Chip tone="bg-moss-soft text-moss">✓ Verified</Chip>}</span>
        <h3 className={cn('display mt-2.5 group-hover:text-cobalt', lead ? 'text-[2rem]' : 'text-xl')}>{r.title}</h3>
        {lead && <p className="mt-3 line-clamp-2 max-w-lg text-sm leading-relaxed text-muted">{r.description}</p>}
        <span className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1 pt-3 text-xs text-muted">
          <Avatar user={r.uploader} size={20} /><span className="font-medium text-ink">{r.uploader.name}</span>
          <span className="num">▲ {r.helpful}</span><span className="num">↓ {r.downloads}</span><span>{formatSize(r.fileSize)}</span><span>{timeAgo(r.createdAt)}</span>
        </span>
      </span>
    </Link>
  )
}

export function ThreadCard({ t }: { t: Thread }) {
  const base = t.kind === 'question' ? '/qa' : '/voice'
  return (
    <Link to={`${base}/${t.id}`} className="card card-hover group flex gap-4 p-4 sm:p-5">
      <span className="flex w-12 shrink-0 flex-col items-center self-start rounded-full bg-paper py-2.5"><span className="text-[10px] leading-none text-faint">▲</span><span className="num mt-1 text-sm font-bold leading-none">{t.votes}</span></span>
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-1.5">
          {t.courseCode && <Chip className="num">{t.courseCode}</Chip>}
          {t.category && <Chip tone={VOICE_TONE[t.category]}>{VOICE_LABEL[t.category]}</Chip>}
          {t.solved && <Chip tone="bg-moss-soft text-moss">✓ Solved</Chip>}
        </span>
        <span className="display mt-2 block text-xl leading-snug group-hover:text-cobalt sm:text-2xl">{t.title}</span>
        <span className="mt-1.5 line-clamp-2 text-sm leading-relaxed text-muted">{t.body}</span>
        <span className="mt-3 flex items-center gap-2 text-xs text-muted">
          <Avatar user={t.author} size={20} /><span className="font-medium text-ink">{t.author ? t.author.name : 'Anonymous student'}</span>
          <span>·</span><span>{t.replyCount} replies</span><span>·</span><span>{timeAgo(t.createdAt)}</span>
        </span>
      </span>
    </Link>
  )
}
