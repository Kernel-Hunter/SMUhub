import { useEffect, useState, type ReactNode } from 'react'
import { BadgeCheck, ThumbsUp, Download, FileText, Eye, EyeOff } from 'lucide-react'
import { Logo } from '@/components/Shell'

function Preview() {
  return (
    // Same composition as before the redesign: three overlapping, slightly rotated cards.
    // Depth comes from a neutral popover shadow only; no gradient, glow or coloured shadow.
    <div className="relative mx-auto h-80 w-full max-w-md" aria-hidden>
      <div className="card absolute left-0 top-4 w-[88%] -rotate-3 p-4 shadow-popover">
        <div className="flex items-start gap-3"><span className="grid size-10 place-items-center rounded-md bg-subtle text-muted"><FileText size={18} /></span><div className="flex-1"><p className="text-xs text-muted"><span className="mono font-medium text-ink">CS224</span> · Past exam</p><p className="mt-1 text-sm font-semibold">Databases final 2025, solved</p><p className="mt-2 flex gap-3 text-xs text-muted"><span className="flex items-center gap-1"><ThumbsUp size={11} />24</span><span className="flex items-center gap-1"><Download size={11} />188</span></p></div><span className="flex items-center gap-1 text-xs font-medium text-success"><BadgeCheck size={13} />Verified</span></div>
      </div>
      <div className="card absolute right-0 top-32 w-[84%] rotate-2 p-4 shadow-popover">
        <p className="text-xs text-muted">Campus Voice · anonymous</p><p className="mt-1 text-sm font-semibold">The library closes at 6pm during exam weeks</p><p className="mt-2 text-xs text-muted">58 votes · 12 replies</p>
      </div>
      <div className="card absolute left-6 top-52 flex w-[80%] -rotate-1 items-center gap-3 p-4 shadow-popover">
        <span className="grid size-9 place-items-center rounded-full bg-accent-soft text-sm font-semibold text-accent">IG</span><div className="flex-1"><p className="text-sm font-semibold">Ines Gharbi</p><p className="text-xs text-muted">Rank #1 this week</p></div><span className="num text-sm font-medium">236 XP</span>
      </div>
    </div>
  )
}

/** Shared frame of the signed-out pages (sign in, sign up, code, password reset): form on the left, preview on the right. */
export function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="grid min-h-dvh bg-bg lg:grid-cols-[1fr_1.1fr]">
      <section className="flex flex-col justify-between px-6 py-8 sm:px-12">
        <Logo />
        <div className="rise mx-auto w-full max-w-sm py-12">
          {/* Full SMU logo; on dark backgrounds it sits on a white rounded tile so the blue stays readable. */}
          <span className="mb-8 inline-block rounded-md dark:bg-white dark:px-3 dark:py-2">
            <img src="/smu-logo.png" alt="Logo South Mediterranean University" width={153} height={64} className="h-16 w-auto object-contain" />
          </span>
          {children}
        </div>
        <p className="text-xs text-faint">© SMUhub · Made by students, for students</p>
      </section>
      <section className="hidden flex-col justify-center gap-10 border-l border-line bg-[color-mix(in_srgb,var(--accent-soft)_50%,var(--bg))] px-12 lg:flex">
        <div className="mx-auto max-w-md text-center"><h2 className="text-lg font-semibold">Everything your courses never gave you.</h2><p className="mt-3 text-sm text-muted">Notes, past exams and honest answers from the students who just took the course.</p></div>
        <Preview />
      </section>
    </div>
  )
}

export const authLink = 'font-medium text-accent hover:underline'

/** Password input with a show/hide toggle, same look as the one on the sign-in page. */
export function PasswordInput({ id, value, onChange, autoComplete, invalid }: { id: string; value: string; onChange: (v: string) => void; autoComplete: 'new-password' | 'current-password'; invalid?: boolean }) {
  const [show, setShow] = useState(false)
  return (
    <div className="relative">
      <input id={id} className="field !h-10 !pr-10" type={show ? 'text' : 'password'} autoComplete={autoComplete} value={value} onChange={(e) => onChange(e.target.value)} aria-invalid={invalid} required />
      <button type="button" onClick={() => setShow((v) => !v)} aria-label={show ? 'Hide password' : 'Show password'} aria-pressed={show} aria-controls={id} title={show ? 'Hide password' : 'Show password'}
        className="absolute right-1 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-sm text-muted transition-colors hover:bg-hover hover:text-ink">
        {show ? <EyeOff size={16} aria-hidden /> : <Eye size={16} aria-hidden />}
      </button>
    </div>
  )
}

/** 6-digit code input: digits only, filled by the phone's one-time-code suggestion. */
export function CodeInput({ id, value, onChange, invalid, autoFocus }: { id: string; value: string; onChange: (v: string) => void; invalid?: boolean; autoFocus?: boolean }) {
  return (
    <input id={id} className="field mono !h-12 text-center !text-2xl tracking-[0.5em]" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} autoFocus={autoFocus}
      value={value} onChange={(e) => onChange(e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="000000" aria-invalid={invalid} required />
  )
}

/** Seconds left before another code can be requested. The server sends at most one mail per minute. */
export function useCooldown(initial = 60) {
  const [left, setLeft] = useState(initial)
  useEffect(() => {
    if (left <= 0) return
    const t = setTimeout(() => setLeft((s) => s - 1), 1000)
    return () => clearTimeout(t)
  }, [left])
  return [left, () => setLeft(60)] as const
}
