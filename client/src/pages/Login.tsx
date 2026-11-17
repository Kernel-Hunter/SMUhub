import { useState, type FormEvent } from 'react'
import { useAuth } from '@/auth/AuthContext'
import { Logo } from '@/components/Shell'
import { Spinner } from '@/components/ui'
import { errMsg } from '@/lib/utils'

function Stack() {
  return (
    <div className="relative mx-auto mt-14 h-[26rem] w-full max-w-lg" aria-hidden>
      <div className="card absolute left-0 top-10 w-[78%] -rotate-[5deg] bg-raised shadow-[6px_6px_0_var(--ink)]">
        <div className="flex border-b-[1.5px] border-ink"><span className="num bg-ink px-3 py-2 text-sm font-bold text-accent">CS224</span><span className="eyebrow flex flex-1 items-center px-3">Past exam · S1</span></div>
        <div className="ruled px-4 pb-6 pt-3"><p className="display text-3xl">Databases final 2025, solved</p></div>
        <div className="num flex justify-between border-t-[1.5px] border-ink px-3 py-2 text-xs text-muted"><span>▲ 24</span><span>↓ 188</span></div>
      </div>
      <div className="card absolute right-0 top-0 w-[62%] rotate-[4deg] bg-accent shadow-[6px_6px_0_var(--ink)]">
        <div className="p-4 text-[#121210]"><p className="eyebrow !text-[#121210]">Campus voice · anonymous</p><p className="display mt-2 text-2xl">The library closes at 6pm in exam week.</p><p className="num mt-3 text-xs font-bold">▲ 58 · 12 replies</p></div>
      </div>
      <div className="card absolute bottom-0 right-6 w-[70%] rotate-[-1.5deg] bg-raised shadow-[6px_6px_0_var(--ink)]">
        <div className="p-4"><p className="eyebrow">Q&amp;A · CS324 · solved ✓</p><p className="display mt-2 text-2xl">Why does useEffect run twice in dev?</p></div>
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
    <div className="grain min-h-dvh">
      <div className="mx-auto grid min-h-dvh max-w-6xl gap-x-16 px-4 py-8 sm:px-8 lg:grid-cols-[1.15fr_1fr]">
        <section className="flex flex-col">
          <Logo className="text-4xl" />
          <h1 className="display mt-14 text-[clamp(3.2rem,8.2vw,7.2rem)]">What the syllabus <em className="hl">never</em> told you.</h1>
          <p className="mt-7 max-w-md text-lg leading-snug text-muted">Notes, past exams and straight answers from the students who just took the course. For SMU students only.</p>
          <Stack />
        </section>
        <section className="flex items-center py-10 lg:py-0">
          <form onSubmit={submit} className="card rise w-full p-7 shadow-[8px_8px_0_var(--ink)] sm:p-9">
            <p className="eyebrow">Members entrance</p>
            <h2 className="display mt-2 text-4xl">Sign in with Moodle</h2>
            <p className="mt-3 text-sm text-muted">Same username and password as your Moodle account.</p>
            <div className="mt-7 grid gap-4">
              <label><span className="label">Username</span><input className="field" autoComplete="username" autoFocus value={u} onChange={(e) => setU(e.target.value)} placeholder="firstname.lastname" required /></label>
              <label><span className="label">Password</span><input className="field" type="password" autoComplete="current-password" value={p} onChange={(e) => setP(e.target.value)} required /></label>
              {err && <p role="alert" className="border-[1.5px] border-rose bg-rose-soft px-3 py-2 text-sm font-medium text-rose">{err}</p>}
              <button className="btn btn-accent h-12" disabled={busy || !u || !p}>{busy ? <Spinner /> : 'Enter the hub →'}</button>
            </div>
            <ul className="mt-7 grid gap-2 border-t-[1.5px] border-ink pt-5 text-xs leading-relaxed text-muted">
              <li><strong className="text-ink">Verified.</strong> Only people with a Moodle account get in.</li>
              <li><strong className="text-ink">Private.</strong> Your password goes straight to Moodle. SMUhub never stores it.</li>
              <li className="num">Demo build: any username and a 4+ character password works.</li>
            </ul>
          </form>
        </section>
      </div>
    </div>
  )
}
