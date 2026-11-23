import { Link, useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, BadgeCheck, Download, Info, ThumbsUp, Trash2 } from 'lucide-react'
import { api } from '@/api/client'
import { RULES } from '@/api/rules'
import type { Resource } from '@/api/types'
import { FileBadge, ResourceCard } from '@/components/Cards'
import { Avatar, ErrorBox, Skeleton, Spinner, useToast } from '@/components/ui'
import { KIND_LABEL, KIND_TONE, cn, deptOf, errMsg, formatSize, timeAgo } from '@/lib/utils'

export default function ResourceDetail() {
  const { id = '' } = useParams(); const nav = useNavigate(); const qc = useQueryClient(); const toast = useToast()
  const { data: r, error, isLoading } = useQuery({ queryKey: ['resource', id], queryFn: () => api.resources.get(id) })
  const courses = useQuery({ queryKey: ['courses'], queryFn: api.courses.list })
  const more = useQuery({ queryKey: ['resources', 'course', r?.courseCode], queryFn: () => api.resources.list({ course: r!.courseCode, sort: 'top' }), enabled: !!r })
  const refresh = () => { qc.invalidateQueries({ queryKey: ['resource', id] }); qc.invalidateQueries({ queryKey: ['resources'] }) }
  // The browser downloads the file itself; the server records it, so rating unlocks now and the counts catch up just after.
  const dl = useMutation({ mutationFn: () => api.resources.download(id), onSuccess: () => { qc.setQueryData<Resource>(['resource', id], (old) => old && { ...old, iDownloaded: true }); setTimeout(refresh, 1500) }, onError: (e) => toast(errMsg(e), 'err') })
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
          <div className="flex items-center gap-4 border-b border-line px-6 py-4">
            <FileBadge ext={r.ext} size="lg" />
            <span className="min-w-0 truncate text-sm text-muted">{course?.name ?? r.courseCode}</span>
          </div>
          <div className="px-6 pb-6 pt-6">
            <div className="flex flex-wrap items-center gap-2">
              <span className="chip mono"><span className="size-2 rounded-full" style={{ background: d.dot }} aria-hidden />{r.courseCode}</span><span className={cn('chip', KIND_TONE[r.kind])}>{KIND_LABEL[r.kind]}</span><span className="chip">{r.semester} · {r.academicYear}</span>
              {r.verified && <span className="chip bg-accent-soft text-accent"><BadgeCheck size={12} />Verified by classmates</span>}
            </div>
            <h1 className="mt-3 text-2xl font-semibold">{r.title}</h1>
            {r.description && <p className="mt-3 max-w-2xl whitespace-pre-line text-sm leading-relaxed text-muted">{r.description}</p>}
            <Link to={`/u/${r.uploader.id}`} className="mt-6 flex w-fit items-center gap-3 rounded-md border border-line py-2 pl-2 pr-4 transition-colors hover:bg-hover">
              <Avatar user={r.uploader} size={34} /><span className="leading-tight"><span className="block text-sm font-semibold">{r.uploader.name}</span><span className="text-xs text-muted">{r.uploader.major} · shared {timeAgo(r.createdAt)}</span></span>
            </Link>
          </div>
        </article>

        <aside className="grid h-fit gap-4 lg:sticky lg:top-16">
          <div className="card p-5">
            <button className="btn btn-primary h-11 w-full text-sm" onClick={() => dl.mutate()} disabled={dl.isPending}>{dl.isPending ? <Spinner /> : <Download size={16} />}Download {r.ext.toUpperCase()}</button>
            {!r.mine && <button className={cn('btn mt-2 h-11 w-full text-sm', r.iVoted ? 'bg-accent-soft text-accent' : 'btn-ghost')} disabled={r.iVoted || !r.iDownloaded || rate.isPending} onClick={() => rate.mutate()}><ThumbsUp size={15} />{r.iVoted ? 'You rated this' : 'This helped me'}</button>}
            {r.mine && <button className="btn btn-secondary mt-2 h-11 w-full text-danger" onClick={() => confirm('Delete this file? Points it earned are removed too.') && del.mutate()}><Trash2 size={15} />Delete</button>}
            <div className="mt-5 grid grid-cols-3 gap-2 text-center">
              {[[r.downloads, 'downloads', 'text-heading'], [r.helpful, 'helpful', 'text-heading'], [formatSize(r.fileSize), 'size', 'text-heading']].map(([v, l, c]) => (
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
