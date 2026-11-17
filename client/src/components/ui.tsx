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
          <div key={t.id} className={cn('rise pointer-events-auto border-[1.5px] border-ink px-4 py-2.5 text-sm font-semibold shadow-[4px_4px_0_var(--ink)]', t.tone === 'xp' ? 'bg-accent text-[#121210]' : t.tone === 'err' ? 'bg-rose-soft text-rose' : 'bg-raised text-ink')}>
            {t.tone === 'xp' && <span className="num mr-2">▲</span>}{t.text}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  )
}

// ---------- primitives ----------
const TINTS = ['#f3e11a', '#ff9d7a', '#9fd8b4', '#a9bdf5', '#f4b6cb', '#e5c9ff', '#ffd27a']
export function Avatar({ user, size = 36 }: { user: PublicUser | null; size?: number }) {
  const tint = TINTS[[...(user?.id ?? 'x')].reduce((s, c) => s + c.charCodeAt(0), 0) % TINTS.length]
  const initials = user ? user.name.split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase() : '?'
  return (
    <span aria-hidden className={cn('num inline-flex shrink-0 items-center justify-center font-bold text-[#121210]', user ? 'border-[1.5px] border-ink' : 'border-[1.5px] border-dashed border-ink')}
      style={{ width: size, height: size, background: user ? tint : 'transparent', color: user ? '#121210' : 'var(--ink)', fontSize: Math.max(9, size * 0.36), borderRadius: size > 40 ? 6 : 3 }}>
      {initials}
    </span>
  )
}

export function Chip({ children, tone, className }: { children: ReactNode; tone?: string; className?: string }) {
  return <span className={cn('chip', tone && `${tone} !border-transparent`, className)}>{children}</span>
}

export function PageHeader({ eyebrow, title, sub, action }: { eyebrow: string; title: ReactNode; sub?: string; action?: ReactNode }) {
  return (
    <header className="rise mb-10 border-b-[1.5px] border-ink pb-8">
      <p className="eyebrow mb-4 flex items-center gap-2"><span className="inline-block size-2 bg-accent outline outline-1 outline-ink" />{eyebrow}</p>
      <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-5">
        <h1 className="display max-w-3xl text-[clamp(2.6rem,6vw,4.75rem)]">{title}</h1>
        {action}
      </div>
      {sub && <p className="mt-5 max-w-xl text-[15px] leading-relaxed text-muted">{sub}</p>}
    </header>
  )
}

export function Empty({ title, hint, action }: { title: string; hint?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center border-[1.5px] border-dashed border-ink px-6 py-16 text-center">
      <p className="display text-3xl">{title}</p>
      {hint && <p className="mt-2 max-w-sm text-sm text-muted">{hint}</p>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  )
}

export function Skeleton({ rows = 4, className }: { rows?: number; className?: string }) {
  return (
    <div className="grid gap-3" aria-busy aria-label="Loading">
      {Array.from({ length: rows }).map((_, i) => <div key={i} className={cn('h-24 animate-pulse border-[1.5px] border-dashed border-ink/30', className)} style={{ animationDelay: `${i * 90}ms` }} />)}
    </div>
  )
}

export function Spinner() { return <span className="num inline-block animate-spin">✳</span> }

export function ErrorBox({ error }: { error: unknown }) {
  return <div role="alert" className="border-[1.5px] border-rose bg-rose-soft p-4 text-sm font-medium text-rose">{error instanceof Error ? error.message : 'Could not load this. Try again.'}</div>
}

export function VoteButton({ votes, voted, disabled, onVote, label = 'Upvote' }: { votes: number; voted: boolean; disabled?: boolean; onVote: () => void; label?: string }) {
  return (
    <button type="button" aria-label={label} aria-pressed={voted} disabled={voted || disabled} onClick={onVote}
      className={cn('flex w-12 shrink-0 flex-col items-center border-[1.5px] border-ink py-2 transition active:translate-y-px disabled:cursor-default', voted ? 'bg-accent text-[#121210]' : 'bg-raised hover:bg-ink hover:text-paper disabled:opacity-60 disabled:hover:bg-raised disabled:hover:text-ink')}>
      <span className="text-sm leading-none">▲</span>
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
    <div role="tablist" className="inline-flex border-[1.5px] border-ink bg-raised">
      {options.map((o) => (
        <button key={o.value} role="tab" aria-selected={value === o.value} onClick={() => onChange(o.value)}
          className={cn('h-9 border-r-[1.5px] border-ink px-4 font-mono text-xs font-semibold uppercase tracking-wider transition last:border-r-0', value === o.value ? 'bg-ink text-paper' : 'hover:bg-accent hover:text-[#121210]')}>
          {o.label}
        </button>
      ))}
    </div>
  )
}
