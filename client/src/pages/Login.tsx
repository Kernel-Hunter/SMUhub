import { useState, type FormEvent } from 'react'
import { BadgeCheck, ThumbsUp, Download, FileText, Eye, EyeOff } from 'lucide-react'
import { useAuth } from '@/auth/AuthContext'
import { Logo } from '@/components/Shell'
import { Spinner } from '@/components/ui'
import { errMsg } from '@/lib/utils'

function Preview() {
  return (
    // Same composition as before the redesign: three overlapping, slightly rotated cards.
    // Depth comes from a neutral popover shadow only; no gradient, glow or coloured shadow.
    <div className="relative mx-auto h-[26rem] w-full max-w-md" aria-hidden>
      <div className="card absolute left-0 top-4 w-[88%] -rotate-3 p-4 shadow-popover">
        <div className="flex items-start gap-3"><span className="grid size-10 place-items-center rounded-md bg-subtle text-muted"><FileText size={18} /></span><div className="flex-1"><p className="text-xs text-muted"><span className="mono font-medium text-ink">CS224</span> · Past exam</p><p className="mt-1 text-sm font-semibold">Databases final 2025, solved</p><p className="mt-2 flex gap-3 text-xs text-muted"><span className="flex items-center gap-1"><ThumbsUp size={11} />24</span><span className="flex items-center gap-1"><Download size={11} />188</span></p></div><span className="flex items-center gap-1 text-xs font-medium text-success"><BadgeCheck size={13} />Verified</span></div>
      </div>
      <div className="card absolute right-0 top-32 w-[84%] rotate-2 p-4 shadow-popover">
        <p className="text-xs text-muted">Campus Voice · anonymous</p><p className="mt-1 text-sm font-semibold">The library closes at 6pm during exam weeks</p><p className="mt-2 text-xs text-muted">58 votes · 12 replies</p>
      </div>
      <div className="card absolute bottom-2 left-6 flex w-[80%] items-center gap-3 p-4 shadow-popover">
        <span className="grid size-9 place-items-center rounded-full bg-accent-soft text-sm font-semibold text-accent">IG</span><div className="flex-1"><p className="text-sm font-semibold">Ines Gharbi</p><p className="text-xs text-muted">Rank #1 this week</p></div><span className="num text-sm font-medium">236 XP</span>
      </div>
    </div>
  )
}

export default function Login() {
  const { login } = useAuth()
  const [u, setU] = useState(''); const [p, setP] = useState('')
  const [busy, setBusy] = useState(false); const [err, setErr] = useState('')
  const [showPw, setShowPw] = useState(false)
  async function submit(e: FormEvent) {
    e.preventDefault(); setBusy(true); setErr(''); setShowPw(false)
    try { await login(u, p) } catch (x) { setErr(errMsg(x)); setBusy(false) }
  }
  return (
    <div className="grid min-h-dvh bg-bg lg:grid-cols-[1fr_1.1fr]">
      <section className="flex flex-col justify-between px-6 py-8 sm:px-12">
        <Logo />
        <form onSubmit={submit} className="rise mx-auto w-full max-w-sm py-12">
          <h1 className="text-2xl font-semibold">Welcome back</h1>
          <p className="mt-2 text-sm text-muted">Sign in with your Moodle account.</p>
          <div className="mt-8 grid grid-cols-1 gap-4">
            <label><span className="label">Username</span><input className="field !h-10" autoComplete="username" autoFocus value={u} onChange={(e) => setU(e.target.value)} placeholder="firstname.lastname" required /></label>
            <div>
              <label htmlFor="login-password" className="label">Password</label>
              <div className="relative">
                <input id="login-password" className="field !h-10 !pr-10" type={showPw ? 'text' : 'password'} autoComplete="current-password" value={p} onChange={(e) => setP(e.target.value)} required />
                {/* Native button: reachable with Tab, toggled with Enter or Space. type="button" so it never submits the form. */}
                <button type="button" onClick={() => setShowPw((v) => !v)} aria-label={showPw ? 'Masquer le mot de passe' : 'Afficher le mot de passe'} aria-pressed={showPw} aria-controls="login-password" title={showPw ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                  className="absolute right-1 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-sm text-muted transition-colors hover:bg-hover hover:text-ink">
                  {showPw ? <EyeOff size={16} aria-hidden /> : <Eye size={16} aria-hidden />}
                </button>
              </div>
            </div>
            {err && <p role="alert" className="rounded-md bg-danger-soft px-3 py-2 text-sm text-danger">{err}</p>}
            <button className="btn btn-accent mt-1 !h-10 text-sm" disabled={busy || !u || !p}>{busy ? <Spinner /> : 'Continue'}</button>
          </div>
          <p className="mt-6 text-xs leading-relaxed text-muted">Only SMU students can sign in. Your password goes directly to Moodle and is never stored by SMUhub.</p>
          <p className="mt-3 rounded-md border border-line bg-surface px-3 py-2 text-xs text-faint">Demo build: any username and a 4+ character password.</p>
        </form>
        <p className="text-xs text-faint">© SMUhub · Made by students, for students</p>
      </section>
      <section className="hidden flex-col justify-center gap-10 border-l border-line bg-[color-mix(in_srgb,var(--accent-soft)_50%,var(--bg))] px-12 lg:flex">
        <div className="mx-auto max-w-md text-center"><h2 className="text-lg font-semibold">Everything your courses never gave you.</h2><p className="mt-3 text-sm text-muted">Notes, past exams and honest answers from the students who just took the course.</p></div>
        <Preview />
      </section>
    </div>
  )
}
