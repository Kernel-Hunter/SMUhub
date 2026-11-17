import { Link, useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, BadgeCheck, Download, ThumbsUp, Trash2, Info } from 'lucide-react'
import { api } from '@/api/mock'
import { Avatar, Chip, ErrorBox, Skeleton, Spinner, useToast } from '@/components/ui'
import { KIND_LABEL, KIND_TONE, errMsg, formatSize, saveBlob, timeAgo } from '@/lib/utils'
import { RULES } from '@/api/rules'

export default function ResourceDetail() {
  const { id = '' } = useParams(); const nav = useNavigate(); const qc = useQueryClient(); const toast = useToast()
  const { data: r, error, isLoading } = useQuery({ queryKey: ['resource', id], queryFn: () => api.resources.get(id) })
  const refresh = () => { qc.invalidateQueries({ queryKey: ['resource', id] }); qc.invalidateQueries({ queryKey: ['resources'] }) }
  const dl = useMutation({ mutationFn: () => api.resources.download(id), onSuccess: (f) => { saveBlob(f.blob, f.fileName); refresh() }, onError: (e) => toast(errMsg(e), 'err') })
  const rate = useMutation({ mutationFn: () => api.resources.rate(id), onSuccess: () => { toast('Thanks. Your rating helps the uploader.'); refresh() }, onError: (e) => toast(errMsg(e), 'err') })
  const del = useMutation({ mutationFn: () => api.resources.remove(id), onSuccess: () => { qc.invalidateQueries({ queryKey: ['resources'] }); toast('Resource deleted.'); nav('/resources') }, onError: (e) => toast(errMsg(e), 'err') })
  if (isLoading) return <Skeleton rows={3} />
  if (error || !r) return <ErrorBox error={error} />
  return (
    <article className="rise mx-auto max-w-3xl">
      <Link to="/resources" className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink"><ArrowLeft size={15} />Library</Link>
      <div className="flex flex-wrap gap-1.5"><Chip tone={KIND_TONE[r.kind]}>{KIND_LABEL[r.kind]}</Chip><Chip className="num">{r.courseCode}</Chip><Chip>{r.semester} · {r.academicYear}</Chip>{r.verified && <Chip tone="bg-moss-soft text-moss"><BadgeCheck size={13} />Verified by classmates</Chip>}</div>
      <h1 className="display mt-4 text-4xl font-medium leading-tight sm:text-5xl">{r.title}</h1>
      <Link to={`/u/${r.uploader.id}`} className="mt-5 inline-flex items-center gap-2.5 text-sm"><Avatar user={r.uploader} size={32} /><span><span className="block font-semibold">{r.uploader.name}</span><span className="text-xs text-muted">{r.uploader.major} · uploaded {timeAgo(r.createdAt)}</span></span></Link>
      {r.description && <p className="mt-6 whitespace-pre-line text-[15px] leading-relaxed text-muted">{r.description}</p>}
      <div className="card mt-8 grid grid-cols-3 divide-x divide-line text-center">
        {[[r.downloads, 'downloads'], [r.helpful, 'found helpful'], [formatSize(r.fileSize), r.ext.toUpperCase()]].map(([v, l]) => <div key={l as string} className="p-4"><p className="display num text-2xl">{v}</p><p className="text-xs text-muted">{l}</p></div>)}
      </div>
      <div className="mt-6 flex flex-wrap gap-3">
        <button className="btn btn-accent h-12 px-6" onClick={() => dl.mutate()} disabled={dl.isPending}>{dl.isPending ? <Spinner /> : <Download size={17} />}Download</button>
        {!r.mine && <button className="btn btn-ghost h-12" disabled={r.iVoted || !r.iDownloaded || rate.isPending} onClick={() => rate.mutate()}><ThumbsUp size={16} />{r.iVoted ? 'You rated this' : 'This helped me'}</button>}
        {r.mine && <button className="btn btn-ghost h-12 text-rose" onClick={() => confirm('Delete this resource? XP it earned is removed too.') && del.mutate()}><Trash2 size={16} />Delete</button>}
      </div>
      <p className="mt-4 flex items-start gap-2 text-xs text-muted"><Info size={14} className="mt-0.5 shrink-0" />{r.mine ? `Earn ${RULES.points.helpful} XP per rating from a classmate and ${RULES.points.verified} XP when ${RULES.verifyThreshold} of them verify it.` : !r.iDownloaded ? 'Download the file first, then you can tell others if it helped. Ratings are final.' : 'Ratings are final and only count from students who downloaded the file.'}</p>
    </article>
  )
}
