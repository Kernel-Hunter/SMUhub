import { useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, CheckCircle2, EyeOff, MessageSquare, ThumbsUp } from 'lucide-react'
import { api } from '@/api/client'
import { Avatar, ErrorBox, Skeleton, Spinner, VoteButton, useToast } from '@/components/ui'
import { VOICE_LABEL, VOICE_TONE, cn, errMsg, timeAgo } from '@/lib/utils'
import type { ThreadKind } from '@/api/types'

export default function ThreadDetail({ kind }: { kind: ThreadKind }) {
  const { id = '' } = useParams(); const qc = useQueryClient(); const toast = useToast()
  const { data, error, isLoading } = useQuery({ queryKey: ['thread', id], queryFn: () => api.threads.get(id, kind) })
  const [body, setBody] = useState(''); const [anon, setAnon] = useState(false)
  const refresh = () => { qc.invalidateQueries({ queryKey: ['thread', id] }); qc.invalidateQueries({ queryKey: ['threads'] }) }
  const onError = (e: unknown) => toast(errMsg(e), 'err')
  const vote = useMutation({ mutationFn: () => api.threads.vote(id, kind), onSuccess: refresh, onError })
  const voteReply = useMutation({ mutationFn: (rid: string) => api.threads.voteReply(rid, kind), onSuccess: refresh, onError })
  const accept = useMutation({ mutationFn: (rid: string) => api.threads.accept(rid), onSuccess: () => { toast('Marked as the accepted answer.'); refresh() }, onError })
  const reply = useMutation({ mutationFn: () => api.threads.reply(id, body, anon, kind), onSuccess: () => { setBody(''); refresh() }, onError })
  if (isLoading) return <Skeleton rows={3} />
  if (error || !data) return <ErrorBox error={error} />
  const { thread: t, replies } = data; const qa = t.kind === 'question'
  const submit = (e: FormEvent) => { e.preventDefault(); reply.mutate() }
  return (
    <div>
      <Link to={qa ? '/qa' : '/voice'} className="mb-5 inline-flex items-center gap-2 text-sm font-medium text-muted hover:text-ink"><ArrowLeft size={14} />{qa ? 'Questions' : 'Campus Voice'}</Link>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
        <div className="grid min-w-0 content-start gap-6">
          <article className="card overflow-hidden">
            <div className="flex gap-5 p-6">
              <VoteButton votes={t.votes} voted={t.iVoted || t.mine} disabled={t.mine} onVote={() => vote.mutate()} />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap gap-2">{t.courseCode && <Link to={`/courses/${t.courseCode}`} className="chip num hover:text-ink" title="Open the course forum">{t.courseCode}</Link>}{t.category && <span className={cn('chip', VOICE_TONE[t.category])}>{VOICE_LABEL[t.category]}</span>}{t.solved && <span className="chip bg-success-soft text-success"><CheckCircle2 size={12} />Solved</span>}</div>
                <h1 className="mt-3 text-2xl font-semibold">{t.title}</h1>
                <p className="mt-3 whitespace-pre-line text-sm leading-relaxed">{t.body}</p>
              </div>
            </div>
          </article>

          <section>
            <h2 className="mb-3 flex items-center gap-2 px-1 text-base font-semibold"><MessageSquare size={15} className="text-muted" />{replies.length} {qa ? (replies.length === 1 ? 'answer' : 'answers') : (replies.length === 1 ? 'reply' : 'replies')}</h2>
            {replies.length > 0 && (
              <div className="rows">
                {replies.map((r) => (
                  <div key={r.id} className={cn('relative flex gap-4 px-5 py-4', r.accepted && 'bg-success-soft')}>
                    {r.accepted && <span className="absolute inset-y-0 left-0 w-1 bg-success" />}
                    <VoteButton votes={r.votes} voted={r.iVoted || r.mine} disabled={r.mine} onVote={() => voteReply.mutate(r.id)} />
                    <div className="min-w-0 flex-1">
                      {r.accepted && <p className="mb-2 flex items-center gap-2 text-xs font-semibold text-success"><CheckCircle2 size={13} />Accepted answer</p>}
                      <p className="whitespace-pre-line text-sm leading-relaxed">{r.body}</p>
                      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted"><Avatar user={r.author} size={20} />{r.author ? <Link className="font-medium text-ink hover:text-accent" to={`/u/${r.author.id}`}>{r.author.name}</Link> : 'Anonymous'}<span className="text-faint">·</span>{timeAgo(r.createdAt)}
                        {qa && t.mine && !t.solved && <button className="btn btn-ghost btn-sm ml-auto" onClick={() => accept.mutate(r.id)}><CheckCircle2 size={13} />Accept</button>}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <form onSubmit={submit} className="card mt-4 grid gap-3 p-4">
              <textarea className="field min-h-28" maxLength={3000} placeholder={qa ? 'Write an answer. Explain why it works, not only what to do.' : 'Add your reply'} value={body} onChange={(e) => setBody(e.target.value)} aria-label="Your reply" />
              <div className="flex flex-wrap items-center justify-between gap-3">
                {!qa ? <label className="flex items-center gap-2 text-sm text-muted"><input type="checkbox" className="size-4 accent-[var(--orange)]" checked={anon} onChange={(e) => setAnon(e.target.checked)} /><EyeOff size={14} />Reply without my name</label> : <span />}
                <button className="btn btn-primary" disabled={reply.isPending || body.trim().length < 2}>{reply.isPending ? <Spinner /> : qa ? 'Post answer' : 'Reply'}</button>
              </div>
            </form>
          </section>
        </div>

        <aside className="grid h-fit gap-4 lg:sticky lg:top-16">
          <div className="card p-5">
            <p className="text-xs font-semibold uppercase tracking-wider text-faint">Posted by</p>
            {t.author ? (
              <Link to={`/u/${t.author.id}`} className="mt-3 flex items-center gap-3"><Avatar user={t.author} size={38} /><span className="leading-tight"><span className="block text-sm font-semibold">{t.author.name}</span><span className="text-xs text-muted">{t.author.major}, year {t.author.year}</span></span></Link>
            ) : <p className="mt-3 flex items-center gap-3"><span className="grid size-10 place-items-center rounded-full bg-hover text-muted"><EyeOff size={16} /></span><span className="text-sm font-semibold">Anonymous student{t.mine && ' (you)'}</span></p>}
            <div className="mt-5 grid grid-cols-2 gap-2 text-center">
              <div className="rounded-md bg-hover py-3"><p className="num flex items-center justify-center gap-1 text-base font-semibold text-heading"><ThumbsUp size={13} />{t.votes}</p><p className="text-xs text-muted">votes</p></div>
              <div className="rounded-md bg-hover py-3"><p className="num text-base font-semibold text-heading">{replies.length}</p><p className="text-xs text-muted">{qa ? 'answers' : 'replies'}</p></div>
            </div>
            <p className="mt-4 text-xs text-muted">Posted {timeAgo(t.createdAt)}</p>
          </div>
          <div className="card p-5 text-xs leading-relaxed text-muted">
            <p className="mb-2 text-sm font-semibold text-ink">{qa ? 'Good answers' : 'House rules'}</p>
            {qa ? 'Explain the reasoning, link the slide or chapter if you can, and keep it about the course.' : 'Criticise decisions, not people. Be specific about what happened and what would fix it. Moderators can see who posted if a post breaks the rules.'}
          </div>
        </aside>
      </div>
    </div>
  )
}
