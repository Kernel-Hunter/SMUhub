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
          <div key={t.id} className={cn('rise pointer-events-auto rounded-full px-5 py-3 text-sm font-semibold shadow-xl', t.tone === 'xp' ? 'bg-accent text-white' : t.tone === 'err' ? 'bg-rose-soft text-rose' : 'bg-ink text-paper')}>
            {t.tone === 'xp' && <span className="num mr-2">▲</span>}{t.text}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  )
}

// ---------- primitives ----------
const TINTS = [['#dbe3f8', '#1f46c4'], ['#f6d9c9', '#a8381a'], ['#d5e8da', '#2f6b4a'], ['#f4e2b8', '#8f5d00'], ['#f4d3dc', '#a3224a'], ['#e3dbf5', '#5a3fb0']]
export function Avatar({ user, size = 36 }: { user: PublicUser | null; size?: number }) {
  const [bg, fg] = TINTS[[...(user?.id ?? 'x')].reduce((s, c) => s + c.charCodeAt(0), 0) % TINTS.length]
  const initials = user ? user.name.split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase() : '?'
  return (
    <span aria-hidden className="inline-flex shrink-0 items-center justify-center rounded-full font-semibold"
      style={{ width: size, height: size, background: user ? bg : 'var(--paper)', color: user ? fg : 'var(--faint)', fontSize: Math.max(9, size * 0.36), boxShadow: user ? 'none' : 'inset 0 0 0 1.5px var(--line)' }}>
      {initials}
    </span>
  )
}

export function Chip({ children, tone, className }: { children: ReactNode; tone?: string; className?: string }) {
  return <span className={cn('chip', tone, className)}>{children}</span>
}

export function PageHeader({ eyebrow, title, sub, action }: { eyebrow: string; title: ReactNode; sub?: string; action?: ReactNode }) {
  return (
    <header className="rise zellige relative mb-10 overflow-hidden rounded-[30px] bg-cobalt-soft px-6 py-9 sm:px-10 sm:py-12">
      <div className="pointer-events-none absolute -right-10 -top-16 hidden h-72 w-52 arch bg-paper/70 sm:block" aria-hidden />
      <p className="eyebrow relative mb-3 !text-cobalt">{eyebrow}</p>
      <div className="relative flex flex-wrap items-end justify-between gap-x-8 gap-y-5">
        <h1 className="display max-w-2xl text-[clamp(2.4rem,5.5vw,4.2rem)]">{title}</h1>
        {action}
      </div>
      {sub && <p className="relative mt-4 max-w-xl text-[15px] leading-relaxed text-muted">{sub}</p>}
    </header>
  )
}

export function Empty({ title, hint, action }: { title: string; hint?: string; action?: ReactNode }) {
  return (
    <div className="zellige flex flex-col items-center rounded-3xl bg-surface px-6 py-16 text-center">
      <p className="display text-3xl">{title}</p>
      {hint && <p className="mt-2 max-w-sm text-sm text-muted">{hint}</p>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  )
}

export function Skeleton({ rows = 4, className }: { rows?: number; className?: string }) {
  return (
    <div className="grid gap-4" aria-busy aria-label="Loading">
      {Array.from({ length: rows }).map((_, i) => <div key={i} className={cn('h-28 animate-pulse rounded-3xl bg-surface', className)} style={{ animationDelay: `${i * 90}ms` }} />)}
    </div>
  )
}

export function Spinner() { return <span className="inline-block size-4 animate-spin rounded-full border-2 border-current border-t-transparent" /> }

export function ErrorBox({ error }: { error: unknown }) {
  return <div role="alert" className="rounded-2xl bg-rose-soft p-4 text-sm font-medium text-rose">{error instanceof Error ? error.message : 'Could not load this. Try again.'}</div>
}

export function VoteButton({ votes, voted, disabled, onVote, label = 'Upvote' }: { votes: number; voted: boolean; disabled?: boolean; onVote: () => void; label?: string }) {
  return (
    <button type="button" aria-label={label} aria-pressed={voted} disabled={voted || disabled} onClick={onVote}
      className={cn('flex w-12 shrink-0 flex-col items-center rounded-full py-2.5 transition active:scale-95 disabled:cursor-default', voted ? 'bg-accent text-white' : 'bg-paper text-ink hover:bg-cobalt hover:text-white disabled:opacity-60 disabled:hover:bg-paper disabled:hover:text-ink')}>
      <span className="text-[10px] leading-none">▲</span>
      <span className="num mt-1 text-sm font-bold leading-none">{votes}</span>
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
    <div role="tablist" className="inline-flex rounded-full bg-surface p-1 shadow-[inset_0_0_0_1px_var(--line)]">
      {options.map((o) => (
        <button key={o.value} role="tab" aria-selected={value === o.value} onClick={() => onChange(o.value)}
          className={cn('h-9 rounded-full px-4 text-sm font-semibold transition', value === o.value ? 'bg-ink text-paper' : 'text-muted hover:text-ink')}>
          {o.label}
        </button>
      ))}
    </div>
  )
}
