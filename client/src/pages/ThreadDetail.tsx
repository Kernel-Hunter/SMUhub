import { useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, CheckCircle2, EyeOff, MessageSquare, ThumbsUp } from 'lucide-react'
import { api } from '@/api/mock'
import { Avatar, ErrorBox, Skeleton, Spinner, VoteButton, useToast } from '@/components/ui'
import { VOICE_LABEL, VOICE_TONE, cn, errMsg, timeAgo } from '@/lib/utils'

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
  const tone = qa ? 'tone-violet' : 'tone-orange'
  const submit = (e: FormEvent) => { e.preventDefault(); reply.mutate() }
  return (
    <div>
      <Link to={qa ? '/qa' : '/voice'} className="mb-5 inline-flex items-center gap-1.5 text-[13px] font-medium text-muted hover:text-ink"><ArrowLeft size={14} />{qa ? 'Questions' : 'Campus Voice'}</Link>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
        <div className="grid min-w-0 content-start gap-6">
          <article className="card overflow-hidden">
            <div className={cn(tone, 'h-1.5')} />
            <div className="flex gap-5 p-6">
              <VoteButton votes={t.votes} voted={t.iVoted || t.mine} disabled={t.mine} onVote={() => vote.mutate()} />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap gap-1.5">{t.courseCode && <span className="chip num">{t.courseCode}</span>}{t.category && <span className={cn('chip', VOICE_TONE[t.category])}>{VOICE_LABEL[t.category]}</span>}{t.solved && <span className="chip bg-moss-soft text-moss"><CheckCircle2 size={12} />Solved</span>}</div>
                <h1 className="display mt-3 text-[1.55rem]">{t.title}</h1>
                <p className="mt-3 whitespace-pre-line text-[14.5px] leading-relaxed">{t.body}</p>
              </div>
            </div>
          </article>

          <section>
            <h2 className="mb-3 flex items-center gap-2 px-0.5 text-[15px] font-semibold"><MessageSquare size={15} className="text-muted" />{replies.length} {qa ? (replies.length === 1 ? 'answer' : 'answers') : (replies.length === 1 ? 'reply' : 'replies')}</h2>
            {replies.length > 0 && (
              <div className="rows">
                {replies.map((r) => (
                  <div key={r.id} className={cn('relative flex gap-4 px-5 py-4', r.accepted && 'bg-moss-soft')}>
                    {r.accepted && <span className="absolute inset-y-0 left-0 w-1 bg-moss" />}
                    <VoteButton votes={r.votes} voted={r.iVoted || r.mine} disabled={r.mine} onVote={() => voteReply.mutate(r.id)} />
                    <div className="min-w-0 flex-1">
                      {r.accepted && <p className="mb-1.5 flex items-center gap-1.5 text-[12px] font-semibold text-moss"><CheckCircle2 size={13} />Accepted answer</p>}
                      <p className="whitespace-pre-line text-[14px] leading-relaxed">{r.body}</p>
                      <div className="mt-3 flex flex-wrap items-center gap-2 text-[12px] text-muted"><Avatar user={r.author} size={20} />{r.author ? <Link className="font-medium text-ink hover:text-accent" to={`/u/${r.author.id}`}>{r.author.name}</Link> : 'Anonymous'}<span className="text-faint">·</span>{timeAgo(r.createdAt)}
                        {qa && t.mine && !t.solved && <button className="btn btn-ghost btn-sm ml-auto" onClick={() => accept.mutate(r.id)}><CheckCircle2 size={13} />Accept</button>}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <form onSubmit={submit} className="card mt-4 grid gap-3 p-4">
              <textarea className="field min-h-28" maxLength={3000} placeholder={qa ? 'Write an answer. Explain why it works, not only what to do.' : 'Add your reply'} value={body} onChange={(e) => setBody(e.target.value)} aria-label="Your reply" />
              <div className="flex flex-wrap items-center justify-between gap-3">
                {!qa ? <label className="flex items-center gap-2 text-[13px] text-muted"><input type="checkbox" className="size-4 accent-[var(--orange)]" checked={anon} onChange={(e) => setAnon(e.target.checked)} /><EyeOff size={14} />Reply without my name</label> : <span />}
                <button className="btn btn-primary" disabled={reply.isPending || body.trim().length < 2}>{reply.isPending ? <Spinner /> : qa ? 'Post answer' : 'Reply'}</button>
              </div>
            </form>
          </section>
        </div>

        <aside className="grid h-fit gap-4 lg:sticky lg:top-16">
          <div className="card p-5">
            <p className="text-[12px] font-semibold uppercase tracking-wider text-faint">Posted by</p>
            {t.author ? (
              <Link to={`/u/${t.author.id}`} className="mt-3 flex items-center gap-3"><Avatar user={t.author} size={38} /><span className="leading-tight"><span className="block text-[13.5px] font-semibold">{t.author.name}</span><span className="text-[12px] text-muted">{t.author.major}, year {t.author.year}</span></span></Link>
            ) : <p className="mt-3 flex items-center gap-3"><span className="grid size-[38px] place-items-center rounded-full bg-hover text-muted"><EyeOff size={16} /></span><span className="text-[13.5px] font-semibold">Anonymous student{t.mine && ' (you)'}</span></p>}
            <div className="mt-5 grid grid-cols-2 gap-2 text-center">
              <div className="rounded-[10px] bg-hover py-2.5"><p className="num flex items-center justify-center gap-1 text-[16px] font-semibold text-accent"><ThumbsUp size={13} />{t.votes}</p><p className="text-[11px] text-muted">votes</p></div>
              <div className="rounded-[10px] bg-hover py-2.5"><p className="num text-[16px] font-semibold text-violet">{replies.length}</p><p className="text-[11px] text-muted">{qa ? 'answers' : 'replies'}</p></div>
            </div>
            <p className="mt-4 text-[12px] text-muted">Posted {timeAgo(t.createdAt)}</p>
          </div>
          <div className="card p-5 text-[12.5px] leading-relaxed text-muted">
            <p className="mb-1.5 text-[13px] font-semibold text-ink">{qa ? 'Good answers' : 'House rules'}</p>
            {qa ? 'Explain the reasoning, link the slide or chapter if you can, and keep it about the course.' : 'Criticise decisions, not people. Be specific about what happened and what would fix it. Moderators can see who posted if a post breaks the rules.'}
          </div>
        </aside>
      </div>
    </div>
  )
}
