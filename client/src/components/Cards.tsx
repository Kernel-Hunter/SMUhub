import { Link } from 'react-router-dom'
import type { Resource, Thread } from '@/api/types'
import { Avatar, Chip } from './ui'
import { KIND_LABEL, VOICE_LABEL, VOICE_TONE, formatSize, timeAgo, cn } from '@/lib/utils'

/** A resource shown as a library index card. */
export function ResourceCard({ r, lead }: { r: Resource; lead?: boolean }) {
  return (
    <Link to={`/resources/${r.id}`} className="card card-hover group flex flex-col overflow-hidden">
      <div className="flex items-stretch border-b-[1.5px] border-ink">
        <span className="num bg-ink px-3 py-2 text-sm font-bold tracking-wider text-accent">{r.courseCode}</span>
        <span className="eyebrow flex flex-1 items-center justify-between px-3"><span>{KIND_LABEL[r.kind]} · {r.semester}</span><span>{r.ext} · {formatSize(r.fileSize)}</span></span>
      </div>
      <div className={cn('ruled relative flex-1 px-4 pb-4 pt-3', lead && 'min-h-44')}>
        <h3 className={cn('display group-hover:underline decoration-[3px] underline-offset-4', lead ? 'text-4xl' : 'text-[1.6rem]')} style={{ textDecorationColor: 'var(--accent)' }}>{r.title}</h3>
        {lead && <p className="mt-4 line-clamp-3 max-w-lg text-sm leading-[26px] text-muted">{r.description}</p>}
        {r.verified && <span className="num absolute right-3 top-3 -rotate-6 border-[1.5px] border-moss px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-widest text-moss">Verified</span>}
      </div>
      <div className="flex items-center gap-2.5 border-t-[1.5px] border-ink px-3 py-2.5 text-xs">
        <Avatar user={r.uploader} size={22} /><span className="min-w-0 flex-1 truncate font-medium">{r.uploader.name}</span>
        <span className="num text-muted">▲ {r.helpful}</span><span className="num text-muted">↓ {r.downloads}</span>
      </div>
    </Link>
  )
}

/** A thread shown as a newspaper item. */
export function ThreadCard({ t }: { t: Thread }) {
  const base = t.kind === 'question' ? '/qa' : '/voice'
  return (
    <Link to={`${base}/${t.id}`} className="group grid grid-cols-[3.25rem_1fr] gap-5 border-t-[1.5px] border-ink py-5 transition last:border-b-[1.5px] hover:bg-surface sm:grid-cols-[4.5rem_1fr]">
      <span className="num text-center"><span className="block text-3xl font-bold leading-none sm:text-4xl">{t.votes}</span><span className="eyebrow !text-[.6rem]">votes</span></span>
      <span className="min-w-0">
        <span className="flex flex-wrap items-center gap-2">
          {t.courseCode && <Chip>{t.courseCode}</Chip>}
          {t.category && <Chip tone={VOICE_TONE[t.category]}>{VOICE_LABEL[t.category]}</Chip>}
          {t.solved && <Chip tone="bg-moss-soft text-moss">✓ Solved</Chip>}
        </span>
        <span className="display mt-2.5 block text-2xl underline-offset-4 group-hover:underline sm:text-[1.9rem]" style={{ textDecorationColor: 'var(--accent)', textDecorationThickness: 3 }}>{t.title}</span>
        <span className="mt-2 line-clamp-2 max-w-2xl text-sm leading-relaxed text-muted">{t.body}</span>
        <span className="mt-3 flex items-center gap-2.5 text-xs text-muted">
          <Avatar user={t.author} size={20} /><span className="font-medium text-ink">{t.author ? t.author.name : 'Anonymous student'}</span>
          <span>·</span><span className="num">{t.replyCount} replies</span><span>·</span><span>{timeAgo(t.createdAt)}</span>
        </span>
      </span>
    </Link>
  )
}
