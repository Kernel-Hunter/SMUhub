import { useState, type FormEvent } from 'react'
import { useAuth } from '@/auth/AuthContext'
import { Logo } from '@/components/Shell'
import { Spinner } from '@/components/ui'
import { errMsg } from '@/lib/utils'

function Arches() {
  return (
    <div className="relative mt-12 flex h-[22rem] items-end justify-start gap-4 sm:h-[26rem]" aria-hidden>
      <div className="zellige arch flex h-[78%] w-[30%] flex-col justify-end bg-cobalt-soft p-4 text-cobalt"><p className="num text-xs font-bold">CS224</p><p className="display mt-1 text-xl leading-tight">Databases final, solved</p><p className="num mt-2 text-xs">▲ 24 · ↓ 188</p></div>
      <div className="arch flex h-full w-[34%] flex-col justify-end bg-accent p-4 text-white"><p className="text-xs font-bold uppercase tracking-widest opacity-80">Campus Voice</p><p className="display mt-1 text-2xl leading-tight">The library shuts at 6pm in exam week.</p><p className="num mt-2 text-xs font-bold">▲ 58 · anonymous</p></div>
      <div className="arch flex h-[62%] w-[30%] flex-col justify-end bg-moss-soft p-4 text-moss"><p className="text-xs font-bold uppercase tracking-widest opacity-80">Q&amp;A · solved ✓</p><p className="display mt-1 text-lg leading-tight">Why does useEffect run twice?</p></div>
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
    <div className="min-h-dvh">
      <div className="mx-auto grid min-h-dvh max-w-6xl gap-x-16 px-5 py-8 sm:px-8 lg:grid-cols-[1.15fr_1fr]">
        <section className="flex flex-col">
          <Logo />
          <h1 className="display mt-12 text-[clamp(3rem,7.6vw,6.4rem)]">What the syllabus <em>never</em> told you.</h1>
          <p className="mt-6 max-w-md text-lg leading-snug text-muted">Notes, past exams and straight answers from the students who just took the course. For SMU students only.</p>
          <Arches />
        </section>
        <section className="flex items-center py-10 lg:py-0">
          <form onSubmit={submit} className="card rise w-full p-7 sm:p-10">
            <p className="eyebrow !text-cobalt">Members entrance</p>
            <h2 className="display mt-2 text-4xl">Sign in with Moodle</h2>
            <p className="mt-3 text-sm text-muted">Use the same username and password as your Moodle account.</p>
            <div className="mt-7 grid gap-4">
              <label><span className="label">Username</span><input className="field" autoComplete="username" autoFocus value={u} onChange={(e) => setU(e.target.value)} placeholder="firstname.lastname" required /></label>
              <label><span className="label">Password</span><input className="field" type="password" autoComplete="current-password" value={p} onChange={(e) => setP(e.target.value)} required /></label>
              {err && <p role="alert" className="rounded-xl bg-rose-soft px-3 py-2 text-sm font-medium text-rose">{err}</p>}
              <button className="btn btn-accent h-12" disabled={busy || !u || !p}>{busy ? <Spinner /> : 'Enter the hub'}</button>
            </div>
            <ul className="mt-7 grid gap-2 border-t border-line pt-5 text-xs leading-relaxed text-muted">
              <li><strong className="text-ink">Verified.</strong> Only people with a Moodle account get in.</li>
              <li><strong className="text-ink">Private.</strong> Your password goes straight to Moodle and is never stored.</li>
              <li className="num">Demo build: any username and a 4+ character password works.</li>
            </ul>
          </form>
        </section>
      </div>
    </div>
  )
}
