import { cloneElement, createContext, isValidElement, useCallback, useContext, useEffect, useId, useRef, useState, type ReactElement, type ReactNode } from 'react'
import { cn } from '@/lib/utils'
import type { PublicUser } from '@/api/types'

// ---------- toasts ----------
type Toast = { id: number; text: string; tone: 'ok' | 'err' | 'xp'; leaving?: boolean }
const ToastCtx = createContext<(text: string, tone?: Toast['tone']) => void>(() => {})
export const useToast = () => useContext(ToastCtx)
export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Toast[]>([])
  // Fade out first, then remove. Errors stay until the student closes them.
  const dismiss = useCallback((id: number) => {
    setItems((s) => s.map((t) => (t.id === id ? { ...t, leaving: true } : t)))
    setTimeout(() => setItems((s) => s.filter((t) => t.id !== id)), 150)
  }, [])
  const push = useCallback((text: string, tone: Toast['tone'] = 'ok') => {
    const id = Date.now() + Math.random()
    setItems((s) => [...s.slice(-3), { id, text, tone }])
    if (tone !== 'err') setTimeout(() => dismiss(id), 4200)
  }, [dismiss])
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-5 z-[80] flex flex-col items-center gap-2 px-4" role="status" aria-live="polite">
        {items.map((t) => (
          <div key={t.id} className={cn('toast pointer-events-auto flex items-center gap-3 rounded-md border py-3 pl-4 text-sm font-medium shadow-popover', t.tone === 'err' ? 'pr-2' : 'pr-4', t.leaving && 'toast-leave', t.tone === 'xp' ? 'border-transparent bg-ink text-paper' : t.tone === 'err' ? 'border-danger/30 bg-danger-soft text-danger' : 'border-line bg-surface text-ink')}>
            {t.tone === 'xp' && <span aria-hidden>↑</span>}<span>{t.text}</span>
            {t.tone === 'err' && <button type="button" onClick={() => dismiss(t.id)} aria-label="Close message" className="icon-btn size-7 text-danger hover:bg-danger/10 hover:text-danger">×</button>}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  )
}

// ---------- primitives ----------
// Neutral initials: colour is reserved for the accent and for states.
export function Avatar({ user, size = 36 }: { user: PublicUser | null; size?: number }) {
  const initials = user ? user.name.split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase() : '?'
  return (
    <span aria-hidden className="inline-flex shrink-0 items-center justify-center rounded-full font-semibold"
      style={{ width: size, height: size, background: user ? 'var(--subtle)' : 'var(--bg)', color: user ? 'var(--muted)' : 'var(--faint)', fontSize: Math.max(9, size * 0.38), boxShadow: user ? 'none' : 'inset 0 0 0 1px var(--line-strong)' }}>
      {initials}
    </span>
  )
}

export function Chip({ children, tone, className }: { children: ReactNode; tone?: string; className?: string }) {
  return <span className={cn('chip', tone && `${tone} !border-transparent`, className)}>{children}</span>
}

export function PageHeader({ eyebrow, title, sub, action }: { eyebrow?: string; title: ReactNode; sub?: string; action?: ReactNode }) {
  return (
    <header className="rise mb-10 flex flex-wrap items-end justify-between gap-4 border-b border-line pb-8">
      <div className="max-w-2xl">
        {eyebrow && <p className="eyebrow mb-3">{eyebrow}</p>}
        <h1 className="text-[34px] leading-[40px] sm:text-[40px] sm:leading-[46px]">{title}</h1>
        {sub && <p className="mt-3 max-w-xl text-[15px] leading-6 text-muted">{sub}</p>}
      </div>
      {action}
    </header>
  )
}

export function Empty({ title, hint, action }: { title: string; hint?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center rounded-lg border border-dashed border-line-strong bg-surface px-6 py-12 text-center">
      <p className="text-base font-medium text-heading">{title}</p>
      {hint && <p className="mt-1 max-w-sm text-sm text-muted">{hint}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}

export function Skeleton({ rows = 4, className }: { rows?: number; className?: string }) {
  return (
    <div className="grid gap-3" role="status" aria-busy>
      <span className="sr-only">Loading</span>
      {Array.from({ length: rows }).map((_, i) => <div key={i} aria-hidden className={cn('h-16 animate-pulse rounded-md bg-hover', className)} />)}
    </div>
  )
}

export function Spinner() { return <span role="status" className="inline-block size-4 animate-spin rounded-full border-2 border-current border-t-transparent"><span className="sr-only">Working</span></span> }

export function ErrorBox({ error }: { error: unknown }) {
  return <div role="alert" className="rounded-md border border-danger/30 bg-danger-soft p-4 text-sm font-medium text-danger">{error instanceof Error ? error.message : 'Could not load this. Try again.'}</div>
}

export function VoteButton({ votes, voted, disabled, onVote, label = 'Upvote' }: { votes: number; voted: boolean; disabled?: boolean; onVote: () => void; label?: string }) {
  return (
    <button type="button" aria-label={label} aria-pressed={voted} disabled={voted || disabled} onClick={onVote}
      className={cn('flex w-10 shrink-0 flex-col items-center self-start rounded-sm border py-1 transition-colors disabled:cursor-default', voted ? 'border-transparent bg-accent-soft text-accent' : 'border-line-strong bg-surface hover:bg-hover disabled:opacity-60 disabled:hover:border-line-strong')}>
      <svg viewBox="0 0 16 16" className="size-3.5" fill="currentColor" aria-hidden><path d="M8 3l5 7H3z" /></svg>
      <span className="num text-xs font-semibold">{votes}</span>
    </button>
  )
}

/** Label + control + optional hint. The hint is linked to the control so screen readers read it with the field. */
export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  const hintId = useId()
  const control = hint && isValidElement(children) ? cloneElement(children as ReactElement<{ 'aria-describedby'?: string }>, { 'aria-describedby': hintId }) : children
  return (
    <label className="block">
      <span className="label">{label}</span>
      {control}
      {hint && <span id={hintId} className="mt-2 block text-xs text-faint">{hint}</span>}
    </label>
  )
}

export function Segmented<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: { value: T; label: string }[] }) {
  return (
    <div role="group" className="inline-flex rounded-sm border border-line bg-subtle p-1">
      {options.map((o) => (
        <button key={o.value} type="button" aria-pressed={value === o.value} onClick={() => onChange(o.value)}
          className={cn('h-7 rounded-sm px-3 text-xs font-medium transition-colors', value === o.value ? 'bg-surface text-ink ring-1 ring-line' : 'text-muted hover:text-ink')}>
          {o.label}
        </button>
      ))}
    </div>
  )
}

/** A number that tweens when its value changes (not on every visit: it starts at the value). */
export function CountUp({ value, className }: { value: number; className?: string }) {
  const [n, setN] = useState(value); const from = useRef(value)
  useEffect(() => {
    if (from.current === value) return
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) { setN(value); from.current = value; return }
    const start = performance.now(), a = from.current, d = 500
    let raf = 0
    const tick = (t: number) => { const p = Math.min(1, (t - start) / d), e = 1 - Math.pow(1 - p, 3); setN(Math.round(a + (value - a) * e)); if (p < 1) raf = requestAnimationFrame(tick); else from.current = value }
    raf = requestAnimationFrame(tick); return () => cancelAnimationFrame(raf)
  }, [value])
  return <span className={cn('num', className)}>{n.toLocaleString()}</span>
}
