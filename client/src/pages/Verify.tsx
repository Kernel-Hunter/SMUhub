import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/auth/AuthContext'
import { authApi } from '@/api/auth'
import { AuthLayout, CodeInput, authLink, useCooldown } from '@/components/AuthLayout'
import { Spinner } from '@/components/ui'
import { errMsg } from '@/lib/utils'

/** Email and whether to mail a fresh code on arrival (true when coming from a refused login). Kept in history state, not the URL. */
type VerifyState = { email?: string; resend?: boolean } | null

export default function Verify() {
  const state = useLocation().state as VerifyState
  const email = state?.email ?? ''
  if (!email) return <Navigate to="/signup" replace />
  return <VerifyForm email={email} resendOnArrival={!!state?.resend} />
}

function VerifyForm({ email, resendOnArrival }: { email: string; resendOnArrival: boolean }) {
  const { adopt } = useAuth()
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false); const [err, setErr] = useState(''); const [note, setNote] = useState('')
  const [cooldown, restartCooldown] = useCooldown()
  const asked = useRef(false)

  // From the login page the last code may have expired: ask for a new one. The server ignores it if one went out less than a minute ago.
  useEffect(() => {
    if (!resendOnArrival || asked.current) return
    asked.current = true
    authApi.resend(email).catch((x) => setErr(errMsg(x)))
  }, [email, resendOnArrival])

  async function verify(value: string) {
    if (busy || value.length !== 6) return
    setBusy(true); setErr(''); setNote('')
    // On success the app switches to the signed-in routes and lands on Home.
    try { adopt(await authApi.verify(email, value)) } catch (x) { setErr(errMsg(x)); setCode(''); setBusy(false) }
  }
  function onCode(v: string) {
    setCode(v); setErr('')
    if (v.length === 6) void verify(v)
  }
  async function resend() {
    if (cooldown > 0) return
    restartCooldown(); setErr(''); setNote('')
    try { await authApi.resend(email); setNote('We sent you a new code. It replaces the previous one.') } catch (x) { setErr(errMsg(x)) }
  }

  return (
    <AuthLayout>
      <form onSubmit={(e: FormEvent) => { e.preventDefault(); void verify(code) }} noValidate>
        <h1 className="text-2xl font-semibold">Check your inbox</h1>
        <p className="mt-2 text-sm text-muted">We sent a 6-digit code to <span className="font-medium text-ink">{email}</span>. It's valid for 15 minutes.</p>
        <fieldset disabled={busy} className="mt-8 grid min-w-0 grid-cols-1 gap-4">
          <label htmlFor="verify-code" className="label !mb-0">Code</label>
          <CodeInput id="verify-code" value={code} onChange={onCode} invalid={!!err} autoFocus />
          {err && <p role="alert" className="rounded-md bg-danger-soft px-3 py-2 text-sm text-danger">{err}</p>}
          {note && <p role="status" className="text-sm text-muted">{note}</p>}
          <button className="btn btn-accent mt-1 !h-10 text-sm" disabled={busy || code.length !== 6} aria-busy={busy}>{busy ? <Spinner /> : 'Confirm'}</button>
        </fieldset>
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 text-sm text-muted">
          <button type="button" onClick={resend} disabled={cooldown > 0} className={cooldown > 0 ? 'text-faint' : authLink}>
            {cooldown > 0 ? `Resend code in ${cooldown}s` : 'Resend code'}
          </button>
          <Link to="/signup" state={{ email }} className={authLink}>Wrong email?</Link>
        </div>
        <p className="mt-6 text-xs leading-relaxed text-muted">Can't find it? Check your spam folder. Already confirmed? <Link to="/login" className={authLink}>Sign in</Link></p>
      </form>
    </AuthLayout>
  )
}
