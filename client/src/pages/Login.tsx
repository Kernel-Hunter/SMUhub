import { useState, type FormEvent } from 'react'
import { ShieldCheck, Lock, ArrowRight, BookOpen, Trophy, Megaphone } from 'lucide-react'
import { useAuth } from '@/auth/AuthContext'
import { Logo } from '@/components/Shell'
import { Spinner } from '@/components/ui'
import { errMsg } from '@/lib/utils'

export default function Login() {
  const { login } = useAuth()
  const [u, setU] = useState(''); const [p, setP] = useState('')
  const [busy, setBusy] = useState(false); const [err, setErr] = useState('')
  async function submit(e: FormEvent) {
    e.preventDefault(); setBusy(true); setErr('')
    try { await login(u, p) } catch (x) { setErr(errMsg(x)); setBusy(false) }
  }
  return (
    <div className="grain grid min-h-dvh lg:grid-cols-[1.1fr_1fr]">
      <section className="relative hidden flex-col justify-between overflow-hidden bg-ink p-14 text-paper lg:flex">
        <div className="pointer-events-none absolute -right-24 -top-24 size-[28rem] rounded-full bg-accent opacity-20 blur-3xl" />
        <div className="relative [&_span]:!text-paper"><Logo /></div>
        <div className="relative max-w-xl">
          <p className="eyebrow !text-paper/60">The student-only campus network</p>
          <h1 className="display mt-4 text-6xl font-medium leading-[1.02]">What the syllabus <em className="text-accent">never</em> told you.</h1>
          <p className="mt-6 max-w-md text-lg text-paper/70">Notes, past exams and honest answers from the students who just took the course. Yours to use, yours to improve.</p>
          <ul className="mt-10 grid gap-4 text-paper/85">
            {[[BookOpen, 'Resources you will not find anywhere else'], [Megaphone, 'Say it like it is, anonymously if you want'], [Trophy, 'Earn rank for every file that helps someone']].map(([Icon, t], i) => {
              const I = Icon as typeof BookOpen
              return <li key={i} className="flex items-center gap-3"><span className="grid size-9 place-items-center rounded-full border border-paper/20"><I size={16} /></span>{t as string}</li>
            })}
          </ul>
        </div>
        <p className="relative text-sm text-paper/40">Private to SMU students · Verified through Moodle</p>
      </section>
      <section className="flex items-center justify-center p-6 sm:p-12">
        <form onSubmit={submit} className="rise w-full max-w-sm">
          <div className="mb-10 lg:hidden"><Logo /></div>
          <p className="eyebrow">Sign in</p>
          <h2 className="display mt-2 text-4xl font-medium">Welcome back.</h2>
          <p className="mt-3 text-sm text-muted">Use the same username and password as your Moodle account.</p>
          <div className="mt-8 grid gap-4">
            <label><span className="label">Moodle username</span><input className="field" autoComplete="username" autoFocus value={u} onChange={(e) => setU(e.target.value)} placeholder="firstname.lastname" required /></label>
            <label><span className="label">Password</span><input className="field" type="password" autoComplete="current-password" value={p} onChange={(e) => setP(e.target.value)} required /></label>
            {err && <p role="alert" className="rounded-xl bg-rose-soft px-3 py-2 text-sm text-rose">{err}</p>}
            <button className="btn btn-primary h-12" disabled={busy || !u || !p}>{busy ? <Spinner /> : <>Continue <ArrowRight size={16} /></>}</button>
          </div>
          <div className="mt-8 grid gap-2 text-xs text-muted">
            <p className="flex items-start gap-2"><ShieldCheck size={14} className="mt-0.5 shrink-0 text-moss" />Only SMU students can enter. Access is verified against Moodle.</p>
            <p className="flex items-start gap-2"><Lock size={14} className="mt-0.5 shrink-0 text-moss" />Your password is sent straight to Moodle and is never stored by SMUhub.</p>
            <p className="rounded-xl border border-dashed border-line p-3">Demo mode: any username and a 4+ character password works until the real backend is connected.</p>
          </div>
        </form>
      </section>
    </div>
  )
}
