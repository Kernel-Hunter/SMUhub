import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Eye, EyeOff } from 'lucide-react'
import { useAuth } from '@/auth/AuthContext'
import { ALLOWED_DOMAINS, checkSmuEmail, rememberPendingPassword } from '@/api/auth'
import { ApiError } from '@/api/client'
import { AuthLayout, authLink } from '@/components/AuthLayout'
import { Spinner } from '@/components/ui'
import { errMsg } from '@/lib/utils'

export default function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState(''); const [p, setP] = useState('')
  const [busy, setBusy] = useState(false); const [err, setErr] = useState('')
  const [showPw, setShowPw] = useState(false)
  async function submit(e: FormEvent) {
    e.preventDefault()
    if (busy) return
    const invalid = checkSmuEmail(email)
    if (invalid) { setErr(invalid); return }
    if (!p) { setErr('Enter your password.'); return }
    setBusy(true); setErr(''); setShowPw(false)
    // On success the app re-renders on the signed-in routes and this page unmounts.
    try { await login(email, p) } catch (x) {
      // Right password, email not confirmed yet: send a fresh code and ask for it.
      if (x instanceof ApiError && x.code === 'email_not_verified') { rememberPendingPassword(p); navigate('/verify', { state: { email: email.trim().toLowerCase(), resend: true } }); return }
      setErr(errMsg(x)); setP(''); setBusy(false)
    }
  }
  return (
    <AuthLayout>
        <form onSubmit={submit} noValidate>
          <h1 className="text-2xl font-medium">Welcome back</h1>
          <p className="mt-2 text-sm text-muted">Sign in with your SMU email.</p>
          <fieldset disabled={busy} className="mt-8 grid min-w-0 grid-cols-1 gap-4">
            <label><span className="label">SMU email</span><input className="field !h-10" type="email" inputMode="email" autoComplete="email" autoFocus value={email} onChange={(e) => { setEmail(e.target.value); setErr('') }} placeholder={`firstname.lastname@${ALLOWED_DOMAINS[0] ?? 'smu.tn'}`} aria-invalid={!!err} required /></label>
            <div>
              <div className="flex items-baseline justify-between"><label htmlFor="login-password" className="label">Password</label><Link to="/forgot" state={{ email: email.trim() }} className={`text-xs ${authLink}`}>Forgot your password?</Link></div>
              <div className="relative">
                <input id="login-password" className="field !h-10 !pr-10" type={showPw ? 'text' : 'password'} autoComplete="current-password" value={p} onChange={(e) => { setP(e.target.value); setErr('') }} aria-invalid={!!err} required />
                {/* Native button: reachable with Tab, toggled with Enter or Space. type="button" so it never submits the form. */}
                <button type="button" onClick={() => setShowPw((v) => !v)} aria-label={showPw ? 'Hide password' : 'Show password'} aria-pressed={showPw} aria-controls="login-password" title={showPw ? 'Hide password' : 'Show password'}
                  className="absolute right-1 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-sm text-muted transition-colors hover:bg-hover hover:text-ink">
                  {showPw ? <EyeOff size={16} aria-hidden /> : <Eye size={16} aria-hidden />}
                </button>
              </div>
            </div>
            {err && <p role="alert" className="rounded-md bg-danger-soft px-3 py-2 text-sm text-danger">{err}</p>}
            <button className="btn btn-accent mt-1 !h-10 text-sm" disabled={busy || !email || !p} aria-busy={busy}>{busy ? <Spinner /> : 'Continue'}</button>
          </fieldset>
          <p className="mt-6 text-sm text-muted">New to SMUhub? <Link to="/signup" className={authLink}>Create an account</Link></p>
          <p className="mt-3 text-xs leading-relaxed text-muted">Only SMU students can sign in: {ALLOWED_DOMAINS.map((d) => '@' + d).join(', ')}.</p>
        </form>
    </AuthLayout>
  )
}