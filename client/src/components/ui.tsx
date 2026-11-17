import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'
import { cn } from '@/lib/utils'
import type { PublicUser } from '@/api/types'

// ---------- toasts ----------
type Toast = { id: number; text: string; tone: 'ok' | 'err' | 'xp' }
const ToastCtx = createContext<(text: string, tone?: Toast['tone']) => void>(() => {})
export const useToast = () => useContext(ToastCtx)
export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Toast[]>([])
  const push = useCallback((text: string, tone: Toast['tone'] = 'ok') => {
    const id = Date.now() + Math.random()
    setItems((s) => [...s.slice(-3), { id, text, tone }])
    setTimeout(() => setItems((s) => s.filter((t) => t.id !== id)), 4200)
  }, [])
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-5 z-[80] flex flex-col items-center gap-2 px-4" aria-live="polite">
        {items.map((t) => (
          <div key={t.id} className={cn('rise pointer-events-auto rounded-xl border border-line-strong px-4 py-2.5 text-sm font-medium shadow-lg', t.tone === 'xp' ? 'bg-accent text-[var(--accent-ink)] border-transparent' : t.tone === 'err' ? 'bg-rose-soft text-rose' : 'bg-surface text-ink')}>
            {t.tone === 'xp' && <span className="mr-2">↑</span>}{t.text}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  )
}

// ---------- primitives ----------
const TINTS = [['var(--accent-soft)', 'var(--accent)'], ['var(--moss-soft)', 'var(--moss)'], ['var(--sky-soft)', 'var(--sky)'], ['var(--gold-soft)', 'var(--gold)'], ['var(--rose-soft)', 'var(--rose)']]
export function Avatar({ user, size = 36 }: { user: PublicUser | null; size?: number }) {
  const [bg, fg] = TINTS[[...(user?.id ?? 'x')].reduce((s, c) => s + c.charCodeAt(0), 0) % TINTS.length]
  const initials = user ? user.name.split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase() : '?'
  return (
    <span aria-hidden className="inline-flex shrink-0 items-center justify-center rounded-full font-semibold"
      style={{ width: size, height: size, background: user ? bg : 'var(--paper)', color: user ? fg : 'var(--faint)', fontSize: Math.max(9, size * 0.38), boxShadow: user ? 'none' : 'inset 0 0 0 1px var(--line-strong)' }}>
      {initials}
    </span>
  )
}

export function Chip({ children, tone, className }: { children: ReactNode; tone?: string; className?: string }) {
  return <span className={cn('chip', tone && `${tone} !border-transparent`, className)}>{children}</span>
}

export function PageHeader({ eyebrow, title, sub, action }: { eyebrow?: string; title: ReactNode; sub?: string; action?: ReactNode }) {
  return (
    <header className="rise mb-8 flex flex-wrap items-end justify-between gap-4">
      <div className="max-w-2xl">
        {eyebrow && <p className="eyebrow mb-1.5">{eyebrow}</p>}
        <h1 className="display text-[1.75rem] sm:text-[2rem]">{title}</h1>
        {sub && <p className="mt-2 text-[15px] leading-relaxed text-muted">{sub}</p>}
      </div>
      {action}
    </header>
  )
}

export function Empty({ title, hint, action }: { title: string; hint?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center rounded-xl border border-dashed border-line-strong px-6 py-14 text-center">
      <p className="text-base font-semibold">{title}</p>
      {hint && <p className="mt-1 max-w-sm text-sm text-muted">{hint}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}

export function Skeleton({ rows = 4, className }: { rows?: number; className?: string }) {
  return (
    <div className="grid gap-3" aria-busy aria-label="Loading">
      {Array.from({ length: rows }).map((_, i) => <div key={i} className={cn('h-20 animate-pulse rounded-xl bg-line', className)} style={{ animationDelay: `${i * 80}ms` }} />)}
    </div>
  )
}

export function Spinner() { return <span className="inline-block size-4 animate-spin rounded-full border-2 border-current border-t-transparent" /> }

export function ErrorBox({ error }: { error: unknown }) {
  return <div role="alert" className="rounded-xl border border-rose/30 bg-rose-soft p-4 text-sm font-medium text-rose">{error instanceof Error ? error.message : 'Could not load this. Try again.'}</div>
}

export function VoteButton({ votes, voted, disabled, onVote, label = 'Upvote' }: { votes: number; voted: boolean; disabled?: boolean; onVote: () => void; label?: string }) {
  return (
    <button type="button" aria-label={label} aria-pressed={voted} disabled={voted || disabled} onClick={onVote}
      className={cn('flex w-11 shrink-0 flex-col items-center rounded-lg border py-1.5 transition active:scale-95 disabled:cursor-default', voted ? 'border-accent/50 bg-accent-soft text-accent' : 'border-line-strong bg-surface hover:border-faint disabled:opacity-60 disabled:hover:border-line-strong')}>
      <svg viewBox="0 0 16 16" className="size-3.5" fill="currentColor" aria-hidden><path d="M8 3l5 7H3z" /></svg>
      <span className="num text-xs font-semibold">{votes}</span>
    </button>
  )
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      {children}
      {hint && <span className="mt-1.5 block text-xs text-faint">{hint}</span>}
    </label>
  )
}

export function Segmented<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: { value: T; label: string }[] }) {
  return (
    <div role="tablist" className="inline-flex rounded-full border border-line bg-surface p-0.5">
      {options.map((o) => (
        <button key={o.value} role="tab" aria-selected={value === o.value} onClick={() => onChange(o.value)}
          className={cn('h-8 rounded-full px-3.5 text-[13px] font-medium transition', value === o.value ? 'bg-line-strong text-ink' : 'text-muted hover:text-ink')}>
          {o.label}
        </button>
      ))}
    </div>
  )
}
