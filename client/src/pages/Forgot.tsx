import { useState, type FormEvent } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { useAuth } from '@/auth/AuthContext'
import { ALLOWED_DOMAINS, authApi, checkNewPassword, checkSmuEmail } from '@/api/auth'
import { AuthLayout, CodeInput, PasswordInput, authLink, useCooldown } from '@/components/AuthLayout'
import { Spinner } from '@/components/ui'
import { errMsg } from '@/lib/utils'

/** Forgot password: ask for the email, then the mailed code and a new password. */
export default function Forgot() {
  const prefill = (useLocation().state as { email?: string } | null)?.email ?? ''
  const [email, setEmail] = useState(prefill)
  const [sentTo, setSentTo] = useState('')
  return (
    <AuthLayout>
      {sentTo ? <ResetForm email={sentTo} onChangeEmail={() => setSentTo('')} /> : <EmailForm email={email} setEmail={setEmail} onSent={setSentTo} />}
      <Link to="/login" className="mt-6 inline-flex items-center gap-2 text-sm font-medium text-muted hover:text-ink"><ArrowLeft size={14} />Back to sign in</Link>
    </AuthLayout>
  )
}

function EmailForm({ email, setEmail, onSent }: { email: string; setEmail: (v: string) => void; onSent: (email: string) => void }) {
  const [busy, setBusy] = useState(false); const [err, setErr] = useState('')
  async function submit(e: FormEvent) {
    e.preventDefault()
    if (busy) return
    const invalid = checkSmuEmail(email)
    if (invalid) { setErr(invalid); return }
    setBusy(true); setErr('')
    try { await authApi.forgot(email); onSent(email.trim().toLowerCase()) } catch (x) { setErr(errMsg(x)); setBusy(false) }
  }
  return (
    <form onSubmit={submit} noValidate>
      <h1 className="text-2xl font-semibold">Reset your password</h1>
      <p className="mt-2 text-sm text-muted">Enter your SMU email. If you have an account, we'll send you a code to choose a new password.</p>
      <fieldset disabled={busy} className="mt-8 grid min-w-0 grid-cols-1 gap-4">
        <label><span className="label">SMU email</span><input className="field !h-10" type="email" inputMode="email" autoComplete="email" autoFocus value={email} onChange={(e) => { setEmail(e.target.value); setErr('') }} placeholder={`firstname.lastname@${ALLOWED_DOMAINS[0] ?? 'smu.tn'}`} aria-invalid={!!err} required /></label>
        {err && <p role="alert" className="rounded-md bg-danger-soft px-3 py-2 text-sm text-danger">{err}</p>}
        <button className="btn btn-accent mt-1 !h-10 text-sm" disabled={busy || !email} aria-busy={busy}>{busy ? <Spinner /> : 'Send me a code'}</button>
      </fieldset>
    </form>
  )
}

function ResetForm({ email, onChangeEmail }: { email: string; onChangeEmail: () => void }) {
  const { adopt } = useAuth()
  const [code, setCode] = useState(''); const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false); const [err, setErr] = useState(''); const [note, setNote] = useState('')
  const [cooldown, restartCooldown] = useCooldown()

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (busy) return
    if (code.length !== 6) { setErr('Enter the 6-digit code from the email.'); return }
    const weak = checkNewPassword(password)
    if (weak) { setErr(weak); return }
    setBusy(true); setErr(''); setNote('')
    // On success the app switches to the signed-in routes and lands on Home.
    try { adopt(await authApi.reset(email, code, password)) } catch (x) { setErr(errMsg(x)); setBusy(false) }
  }
  async function resend() {
    if (cooldown > 0) return
    restartCooldown(); setErr(''); setNote('')
    try { await authApi.forgot(email); setNote('If you have an account, a new code is on its way. It replaces the previous one.') } catch (x) { setErr(errMsg(x)) }
  }

  return (
    <form onSubmit={submit} noValidate>
      <h1 className="text-2xl font-semibold">Choose a new password</h1>
      <p className="mt-2 text-sm text-muted">If <span className="font-medium text-ink">{email}</span> has an account, we sent it a 6-digit code. It's valid for 15 minutes.</p>
      <fieldset disabled={busy} className="mt-8 grid min-w-0 grid-cols-1 gap-4">
        <div>
          <label htmlFor="reset-code" className="label">Code</label>
          <CodeInput id="reset-code" value={code} onChange={(v) => { setCode(v); setErr('') }} invalid={!!err} autoFocus />
        </div>
        <div>
          <label htmlFor="reset-password" className="label">New password</label>
          <PasswordInput id="reset-password" autoComplete="new-password" value={password} onChange={(v) => { setPassword(v); setErr('') }} invalid={!!err} />
          <p className="mt-1 text-xs text-muted">At least 10 characters, not only digits. You'll be signed out everywhere else.</p>
        </div>
        {err && <p role="alert" className="rounded-md bg-danger-soft px-3 py-2 text-sm text-danger">{err}</p>}
        {note && <p role="status" className="text-sm text-muted">{note}</p>}
        <button className="btn btn-accent mt-1 !h-10 text-sm" disabled={busy || code.length !== 6 || !password} aria-busy={busy}>{busy ? <Spinner /> : 'Save and sign in'}</button>
      </fieldset>
      <div className="mt-6 flex flex-wrap items-center justify-between gap-3 text-sm text-muted">
        <button type="button" onClick={resend} disabled={cooldown > 0} className={cooldown > 0 ? 'text-faint' : authLink}>
          {cooldown > 0 ? `Resend code in ${cooldown}s` : 'Resend code'}
        </button>
        <button type="button" onClick={onChangeEmail} className={authLink}>Wrong email?</button>
      </div>
    </form>
  )
}
