import { useState, type FormEvent } from 'react'
import { BookOpen, Megaphone, Trophy } from 'lucide-react'
import { useAuth } from '@/auth/AuthContext'
import { Logo } from '@/components/Shell'
import { Spinner } from '@/components/ui'
import { errMsg } from '@/lib/utils'

const POINTS = [
  [BookOpen, 'Course resources', 'Notes, past exams and summaries from students who just took the course.'],
  [Megaphone, 'Campus Voice', 'Honest feedback on courses and campus life. Post anonymously when you need to.'],
  [Trophy, 'Earn your rank', 'Points come from classmates who find your uploads and answers useful.'],
] as const

export default function Login() {
  const { login } = useAuth()
  const [u, setU] = useState(''); const [p, setP] = useState('')
  const [busy, setBusy] = useState(false); const [err, setErr] = useState('')
  async function submit(e: FormEvent) {
    e.preventDefault(); setBusy(true); setErr('')
    try { await login(u, p) } catch (x) { setErr(errMsg(x)); setBusy(false) }
  }
  return (
    <div className="grid min-h-dvh lg:grid-cols-2">
      <section className="flex flex-col justify-between px-6 py-8 sm:px-14">
        <Logo />
        <form onSubmit={submit} className="rise mx-auto w-full max-w-sm py-12">
          <h1 className="display text-3xl">Sign in to SMUhub</h1>
          <p className="mt-2 text-sm text-muted">Use your Moodle username and password.</p>
          <div className="mt-8 grid gap-4">
            <label><span className="label">Moodle username</span><input className="field" autoComplete="username" autoFocus value={u} onChange={(e) => setU(e.target.value)} placeholder="firstname.lastname" required /></label>
            <label><span className="label">Password</span><input className="field" type="password" autoComplete="current-password" value={p} onChange={(e) => setP(e.target.value)} required /></label>
            {err && <p role="alert" className="rounded-lg bg-rose-soft px-3 py-2 text-sm text-rose">{err}</p>}
            <button className="btn btn-accent mt-1 h-11" disabled={busy || !u || !p}>{busy ? <Spinner /> : 'Continue'}</button>
          </div>
          <p className="mt-6 text-xs leading-relaxed text-muted">Only SMU students can sign in. Your password goes directly to Moodle and is never stored by SMUhub.</p>
          <p className="num mt-3 rounded-lg bg-paper px-3 py-2 text-xs text-faint">Demo build: any username and a 4+ character password.</p>
        </form>
        <p className="text-xs text-faint">© SMUhub · Made by students</p>
      </section>
      <section className="hidden flex-col justify-center border-l border-line bg-surface px-16 lg:flex">
        <div className="max-w-md">
          <h2 className="display text-4xl">Everything your courses never gave you in one place.</h2>
          <ul className="mt-10 grid gap-7">
            {POINTS.map(([Icon, t, d]) => (
              <li key={t} className="flex gap-4"><span className="grid size-10 shrink-0 place-items-center rounded-lg bg-accent-soft text-accent"><Icon size={19} strokeWidth={1.75} /></span><span><span className="block font-semibold">{t}</span><span className="text-sm text-muted">{d}</span></span></li>
            ))}
          </ul>
        </div>
      </section>
    </div>
  )
}
