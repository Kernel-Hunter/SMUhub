import { Link, useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, BadgeCheck, Download, Info, ThumbsUp, Trash2 } from 'lucide-react'
import { api } from '@/api/mock'
import { RULES } from '@/api/rules'
import { FileBadge, ResourceCard } from '@/components/Cards'
import { Avatar, ErrorBox, Skeleton, Spinner, useToast } from '@/components/ui'
import { KIND_LABEL, KIND_TONE, cn, deptOf, errMsg, formatSize, saveBlob, timeAgo } from '@/lib/utils'

export default function ResourceDetail() {
  const { id = '' } = useParams(); const nav = useNavigate(); const qc = useQueryClient(); const toast = useToast()
  const { data: r, error, isLoading } = useQuery({ queryKey: ['resource', id], queryFn: () => api.resources.get(id) })
  const courses = useQuery({ queryKey: ['courses'], queryFn: api.courses.list })
  const more = useQuery({ queryKey: ['resources', 'course', r?.courseCode], queryFn: () => api.resources.list({ course: r!.courseCode, sort: 'top' }), enabled: !!r })
  const refresh = () => { qc.invalidateQueries({ queryKey: ['resource', id] }); qc.invalidateQueries({ queryKey: ['resources'] }) }
  const dl = useMutation({ mutationFn: () => api.resources.download(id), onSuccess: (f) => { saveBlob(f.blob, f.fileName); refresh() }, onError: (e) => toast(errMsg(e), 'err') })
  const rate = useMutation({ mutationFn: () => api.resources.rate(id), onSuccess: () => { toast('Thanks. The uploader gets points for this.'); refresh() }, onError: (e) => toast(errMsg(e), 'err') })
  const del = useMutation({ mutationFn: () => api.resources.remove(id), onSuccess: () => { qc.invalidateQueries({ queryKey: ['resources'] }); toast('File deleted.'); nav('/resources') }, onError: (e) => toast(errMsg(e), 'err') })
  if (isLoading) return <Skeleton rows={3} />
  if (error || !r) return <ErrorBox error={error} />
  const course = courses.data?.find((c) => c.code === r.courseCode)
  const d = deptOf(course?.dept ?? '')
  return (
    <div>
      <Link to="/resources" className="mb-5 inline-flex items-center gap-2 text-sm font-medium text-muted hover:text-ink"><ArrowLeft size={14} />Library</Link>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
        <article className="card overflow-hidden">
          <div className="relative h-28" style={{ background: `linear-gradient(135deg, ${d.from}, ${d.to})` }}><div className="dots-light absolute inset-0 opacity-70" />
            <div className="absolute -bottom-7 left-6 rounded-lg bg-surface p-2 shadow-[var(--lift)]"><FileBadge ext={r.ext} size="lg" /></div>
            <span className="absolute right-5 top-4 rounded-full bg-white/20 px-3 py-1 text-xs font-medium text-white ring-1 ring-white/25">{course?.name ?? r.courseCode}</span>
          </div>
          <div className="px-6 pb-6 pt-11">
            <div className="flex flex-wrap items-center gap-2">
              <span className="chip num" style={{ background: d.soft, color: d.ink }}>{r.courseCode}</span><span className={cn('chip', KIND_TONE[r.kind])}>{KIND_LABEL[r.kind]}</span><span className="chip">{r.semester} · {r.academicYear}</span>
              {r.verified && <span className="chip bg-accent-soft text-accent"><BadgeCheck size={12} />Verified by classmates</span>}
            </div>
            <h1 className="display mt-3 text-2xl">{r.title}</h1>
            {r.description && <p className="mt-3 max-w-2xl whitespace-pre-line text-sm leading-relaxed text-muted">{r.description}</p>}
            <Link to={`/u/${r.uploader.id}`} className="mt-6 flex w-fit items-center gap-3 rounded-lg bg-hover py-2 pl-2 pr-4 transition hover:bg-accent-soft">
              <Avatar user={r.uploader} size={34} /><span className="leading-tight"><span className="block text-sm font-semibold">{r.uploader.name}</span><span className="text-xs text-muted">{r.uploader.major} · shared {timeAgo(r.createdAt)}</span></span>
            </Link>
          </div>
        </article>

        <aside className="grid h-fit gap-4 lg:sticky lg:top-16">
          <div className="card p-5">
            <button className="btn btn-primary h-11 w-full text-sm" onClick={() => dl.mutate()} disabled={dl.isPending}>{dl.isPending ? <Spinner /> : <Download size={16} />}Download {r.ext.toUpperCase()}</button>
            {!r.mine && <button className={cn('btn mt-2 h-11 w-full text-sm', r.iVoted ? 'bg-accent-soft text-accent' : 'btn-ghost')} disabled={r.iVoted || !r.iDownloaded || rate.isPending} onClick={() => rate.mutate()}><ThumbsUp size={15} />{r.iVoted ? 'You rated this' : 'This helped me'}</button>}
            {r.mine && <button className="btn btn-ghost mt-2 h-11 w-full text-rose" onClick={() => confirm('Delete this file? Points it earned are removed too.') && del.mutate()}><Trash2 size={15} />Delete</button>}
            <div className="mt-5 grid grid-cols-3 gap-2 text-center">
              {[[r.downloads, 'downloads', 'text-accent'], [r.helpful, 'helpful', 'text-moss'], [formatSize(r.fileSize), 'size', 'text-violet']].map(([v, l, c]) => (
                <div key={l as string} className="rounded-md bg-hover px-2 py-3"><p className={cn('num text-base font-semibold', c as string)}>{v}</p><p className="text-xs text-muted">{l}</p></div>))}
            </div>
            <p className="mt-4 flex gap-2 text-xs leading-relaxed text-muted"><Info size={14} className="mt-1 shrink-0" />{r.mine ? `You get ${RULES.points.helpful} XP each time a classmate rates it, and ${RULES.points.verified} XP once ${RULES.verifyThreshold} of them do.` : !r.iDownloaded ? 'Download it first. After that you can tell others if it helped. Ratings can\'t be undone.' : 'Ratings only count from students who downloaded the file.'}</p>
          </div>
        </aside>
      </div>
      {more.data && more.data.length > 1 && (
        <section className="mt-8"><h2 className="mb-3 px-1 text-base font-semibold">More from {r.courseCode}</h2><div className="rows">{more.data.filter((x) => x.id !== r.id).slice(0, 4).map((x) => <ResourceCard key={x.id} r={x} />)}</div></section>
      )}
    </div>
  )
}
