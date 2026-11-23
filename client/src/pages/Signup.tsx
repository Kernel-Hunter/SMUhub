import { useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { ALLOWED_DOMAINS, authApi, checkNewPassword, checkSmuEmail, rememberPendingPassword } from '@/api/auth'
import { AuthLayout, PasswordInput, authLink } from '@/components/AuthLayout'
import { Spinner } from '@/components/ui'
import { errMsg } from '@/lib/utils'

export default function Signup() {
  const navigate = useNavigate()
  // Coming back from the code screen ("Wrong email?"): start from the address typed before.
  const prefill = (useLocation().state as { email?: string } | null)?.email ?? ''
  const [firstName, setFirstName] = useState(''); const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState(prefill); const [password, setPassword] = useState('')
  const [major, setMajor] = useState(''); const [year, setYear] = useState('1')
  const [busy, setBusy] = useState(false); const [err, setErr] = useState('')
  const edit = (set: (v: string) => void) => (v: string) => { set(v); setErr('') }

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (busy) return
    if (!firstName.trim() || !lastName.trim()) { setErr('Enter your first and last name.'); return }
    const invalid = checkSmuEmail(email) ?? checkNewPassword(password)
    if (invalid) { setErr(invalid); return }
    setBusy(true); setErr('')
    try {
      await authApi.register({ email, password, firstName: firstName.trim(), lastName: lastName.trim(), major: major.trim(), year: Number(year) })
      rememberPendingPassword(password)
      navigate('/verify', { state: { email: email.trim().toLowerCase() } })
    } catch (x) { setErr(errMsg(x)); setBusy(false) }
  }

  return (
    <AuthLayout>
      <form onSubmit={submit} noValidate>
        <h1 className="text-2xl font-semibold">Create your account</h1>
        <p className="mt-2 text-sm text-muted">Join with your SMU email. We'll send you a code to confirm it's yours.</p>
        <fieldset disabled={busy} className="mt-8 grid min-w-0 grid-cols-1 gap-4">
          <div className="grid grid-cols-2 gap-3">
            <label><span className="label">First name</span><input className="field !h-10" autoComplete="given-name" autoFocus maxLength={50} value={firstName} onChange={(e) => edit(setFirstName)(e.target.value)} required /></label>
            <label><span className="label">Last name</span><input className="field !h-10" autoComplete="family-name" maxLength={50} value={lastName} onChange={(e) => edit(setLastName)(e.target.value)} required /></label>
          </div>
          <label><span className="label">SMU email</span><input className="field !h-10" type="email" inputMode="email" autoComplete="email" value={email} onChange={(e) => edit(setEmail)(e.target.value)} placeholder={`firstname.lastname@${ALLOWED_DOMAINS[0] ?? 'smu.tn'}`} required /></label>
          <div>
            <label htmlFor="signup-password" className="label">Password</label>
            <PasswordInput id="signup-password" autoComplete="new-password" value={password} onChange={edit(setPassword)} />
            <p className="mt-1 text-xs text-muted">At least 10 characters, not only digits.</p>
          </div>
          <div className="grid grid-cols-[1fr_6rem] gap-3">
            <label><span className="label">Major <span className="font-normal text-muted">(optional)</span></span><input className="field !h-10" maxLength={60} value={major} onChange={(e) => edit(setMajor)(e.target.value)} placeholder="Computer Science" /></label>
            <label><span className="label">Year</span>
              <select className="field !h-10" value={year} onChange={(e) => edit(setYear)(e.target.value)}>
                {[1, 2, 3, 4, 5, 6].map((y) => <option key={y} value={y}>{y}</option>)}
              </select>
            </label>
          </div>
          {err && <p role="alert" className="rounded-md bg-danger-soft px-3 py-2 text-sm text-danger">{err}</p>}
          <button className="btn btn-accent mt-1 !h-10 text-sm" disabled={busy || !email || !password} aria-busy={busy}>{busy ? <Spinner /> : 'Create account'}</button>
        </fieldset>
        <p className="mt-6 text-sm text-muted">Already have an account? <Link to="/login" className={authLink}>Sign in</Link></p>
        <p className="mt-3 text-xs leading-relaxed text-muted">Only SMU students can join: {ALLOWED_DOMAINS.map((d) => '@' + d).join(', ')}.</p>
      </form>
    </AuthLayout>
  )
}
