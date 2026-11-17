import { useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, CheckCircle2, EyeOff } from 'lucide-react'
import { api } from '@/api/mock'
import { Avatar, Chip, ErrorBox, Skeleton, Spinner, VoteButton, useToast } from '@/components/ui'
import { VOICE_LABEL, VOICE_TONE, errMsg, timeAgo } from '@/lib/utils'

export default function ThreadDetail() {
  const { id = '' } = useParams(); const qc = useQueryClient(); const toast = useToast()
  const { data, error, isLoading } = useQuery({ queryKey: ['thread', id], queryFn: () => api.threads.get(id) })
  const [body, setBody] = useState(''); const [anon, setAnon] = useState(false)
  const refresh = () => { qc.invalidateQueries({ queryKey: ['thread', id] }); qc.invalidateQueries({ queryKey: ['threads'] }) }
  const onError = (e: unknown) => toast(errMsg(e), 'err')
  const vote = useMutation({ mutationFn: () => api.threads.vote(id), onSuccess: refresh, onError })
  const voteReply = useMutation({ mutationFn: (rid: string) => api.threads.voteReply(rid), onSuccess: refresh, onError })
  const accept = useMutation({ mutationFn: (rid: string) => api.threads.accept(rid), onSuccess: () => { toast('Marked as the accepted answer.'); refresh() }, onError })
  const reply = useMutation({ mutationFn: () => api.threads.reply(id, body, anon), onSuccess: () => { setBody(''); refresh() }, onError })
  if (isLoading) return <Skeleton rows={3} />
  if (error || !data) return <ErrorBox error={error} />
  const { thread: t, replies } = data; const qa = t.kind === 'question'
  const submit = (e: FormEvent) => { e.preventDefault(); reply.mutate() }
  return (
    <div className="rise mx-auto max-w-3xl">
      <Link to={qa ? '/qa' : '/voice'} className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink"><ArrowLeft size={15} />{qa ? 'Q&A' : 'Campus Voice'}</Link>
      <div className="flex gap-4">
        <VoteButton votes={t.votes} voted={t.iVoted || t.mine} disabled={t.mine} onVote={() => vote.mutate()} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap gap-1.5">{t.courseCode && <Chip className="num">{t.courseCode}</Chip>}{t.category && <Chip tone={VOICE_TONE[t.category]}>{VOICE_LABEL[t.category]}</Chip>}{t.solved && <Chip tone="bg-moss-soft text-moss"><CheckCircle2 size={13} />Solved</Chip>}</div>
          <h1 className="display mt-3 text-3xl font-medium leading-tight sm:text-4xl">{t.title}</h1>
          <p className="mt-4 whitespace-pre-line text-[15px] leading-relaxed">{t.body}</p>
          <p className="mt-4 flex items-center gap-2 text-xs text-muted"><Avatar user={t.author} size={22} />{t.author ? <Link className="font-medium hover:text-accent" to={`/u/${t.author.id}`}>{t.author.name}</Link> : 'Anonymous student'}{t.mine && !t.author?.id ? '' : ''}{t.mine && t.author === null ? ' (you)' : ''} · {timeAgo(t.createdAt)}</p>
        </div>
      </div>
      <h2 className="display mb-4 mt-12 text-2xl">{replies.length} {qa ? (replies.length === 1 ? 'answer' : 'answers') : (replies.length === 1 ? 'comment' : 'comments')}</h2>
      <div className="grid gap-3">
        {replies.map((r) => (
          <div key={r.id} className={`card flex gap-4 p-4 ${r.accepted ? 'border-moss' : ''}`}>
            <VoteButton votes={r.votes} voted={r.iVoted || r.mine} disabled={r.mine} onVote={() => voteReply.mutate(r.id)} />
            <div className="min-w-0 flex-1">
              {r.accepted && <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-moss"><CheckCircle2 size={14} />Accepted answer</p>}
              <p className="whitespace-pre-line text-[15px] leading-relaxed">{r.body}</p>
              <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-muted"><Avatar user={r.author} size={20} />{r.author ? <Link className="font-medium hover:text-accent" to={`/u/${r.author.id}`}>{r.author.name}</Link> : 'Anonymous student'}<span>{timeAgo(r.createdAt)}</span>
                {qa && t.mine && !t.solved && <button className="btn btn-ghost btn-sm ml-auto" onClick={() => accept.mutate(r.id)}>Accept answer</button>}</div>
            </div>
          </div>
        ))}
      </div>
      <form onSubmit={submit} className="card mt-6 grid gap-3 p-4">
        <textarea className="field min-h-28" maxLength={3000} placeholder={qa ? 'Write a clear answer. Explain the why, not only the what.' : 'Add to the conversation'} value={body} onChange={(e) => setBody(e.target.value)} aria-label="Your reply" />
        <div className="flex flex-wrap items-center justify-between gap-3">
          {!qa ? <label className="flex items-center gap-2 text-sm text-muted"><input type="checkbox" className="size-4 accent-[var(--accent)]" checked={anon} onChange={(e) => setAnon(e.target.checked)} /><EyeOff size={14} />Comment anonymously</label> : <span />}
          <button className="btn btn-primary" disabled={reply.isPending || body.trim().length < 2}>{reply.isPending ? <Spinner /> : qa ? 'Post answer' : 'Comment'}</button>
        </div>
      </form>
    </div>
  )
}
