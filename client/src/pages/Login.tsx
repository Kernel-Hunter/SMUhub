import { useState, type FormEvent } from 'react'
import { BadgeCheck, ThumbsUp, Download, FileText } from 'lucide-react'
import { useAuth } from '@/auth/AuthContext'
import { Logo } from '@/components/Shell'
import { Spinner } from '@/components/ui'
import { errMsg } from '@/lib/utils'

function Preview() {
  return (
    <div className="relative mx-auto h-[26rem] w-full max-w-md" aria-hidden>
      <div className="card absolute left-0 top-4 w-[88%] -rotate-3 p-4 shadow-2xl backdrop-blur" style={{ background: 'var(--raised)' }}>
        <div className="flex items-start gap-3"><span className="grid size-10 place-items-center rounded-lg bg-rose-soft text-rose"><FileText size={18} /></span><div className="flex-1"><p className="text-xs text-muted"><span className="num font-semibold text-ink">CS224</span> · Past exam</p><p className="mt-0.5 text-sm font-semibold">Databases final 2025, solved</p><p className="mt-2 flex gap-3 text-xs text-muted"><span className="flex items-center gap-1"><ThumbsUp size={11} />24</span><span className="flex items-center gap-1"><Download size={11} />188</span></p></div><span className="flex items-center gap-1 text-xs font-medium text-accent"><BadgeCheck size={13} />Verified</span></div>
      </div>
      <div className="card absolute right-0 top-32 w-[84%] rotate-2 p-4 shadow-2xl" style={{ background: 'var(--raised)' }}>
        <p className="text-xs text-muted">Campus Voice · anonymous</p><p className="mt-1 text-sm font-semibold">The library closes at 6pm during exam weeks</p><p className="mt-1.5 text-xs text-muted">58 votes · 12 replies</p>
      </div>
      <div className="card absolute bottom-2 left-6 flex w-[80%] items-center gap-3 p-4 shadow-2xl" style={{ background: 'var(--raised)' }}>
        <span className="grid size-9 place-items-center rounded-full bg-accent-soft text-sm font-semibold text-accent">IG</span><div className="flex-1"><p className="text-sm font-semibold">Ines Gharbi</p><p className="text-xs text-muted">Rank #1 this week</p></div><span className="num text-sm font-medium">236 XP</span>
      </div>
    </div>
  )
}

export default function Login() {
  const { login } = useAuth()
  const [u, setU] = useState(''); const [p, setP] = useState('')
  const [busy, setBusy] = useState(false); const [err, setErr] = useState('')
  async function submit(e: FormEvent) {
    e.preventDefault(); setBusy(true); setErr('')
    try { await login(u, p) } catch (x) { setErr(errMsg(x)); setBusy(false) }
  }
  return (
    <div className="relative grid min-h-dvh overflow-hidden lg:grid-cols-[1fr_1.1fr]">
      <div className="hero-glow pointer-events-none absolute inset-0" aria-hidden /><div className="grid-bg pointer-events-none absolute inset-0 opacity-70" aria-hidden />
      <section className="relative flex flex-col justify-between px-6 py-8 sm:px-14">
        <Logo />
        <form onSubmit={submit} className="rise mx-auto w-full max-w-sm py-12">
          <h1 className="display gradient-text text-4xl">Welcome back</h1>
          <p className="mt-2 text-sm text-muted">Sign in with your Moodle account.</p>
          <div className="mt-8 grid gap-4">
            <label><span className="label">Username</span><input className="field !h-11" autoComplete="username" autoFocus value={u} onChange={(e) => setU(e.target.value)} placeholder="firstname.lastname" required /></label>
            <label><span className="label">Password</span><input className="field !h-11" type="password" autoComplete="current-password" value={p} onChange={(e) => setP(e.target.value)} required /></label>
            {err && <p role="alert" className="rounded-lg bg-rose-soft px-3 py-2 text-sm text-rose">{err}</p>}
            <button className="btn btn-accent mt-1 !h-11 text-sm" disabled={busy || !u || !p}>{busy ? <Spinner /> : 'Continue'}</button>
          </div>
          <p className="mt-6 text-xs leading-relaxed text-muted">Only SMU students can sign in. Your password goes directly to Moodle and is never stored by SMUhub.</p>
          <p className="num mt-3 rounded-lg border border-line px-3 py-2 text-xs text-faint">Demo build: any username and a 4+ character password.</p>
        </form>
        <p className="text-xs text-faint">© SMUhub · Made by students, for students</p>
      </section>
      <section className="relative hidden flex-col justify-center gap-10 border-l border-line px-14 lg:flex">
        <div className="mx-auto max-w-md text-center"><h2 className="display gradient-text text-4xl">Everything your courses never gave you.</h2><p className="mt-3 text-sm text-muted">Notes, past exams and honest answers from the students who just took the course.</p></div>
        <Preview />
      </section>
    </div>
  )
}
