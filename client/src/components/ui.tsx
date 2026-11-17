import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'
import { ArrowBigUp, Check, Inbox, Loader2 } from 'lucide-react'
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
      <div className="pointer-events-none fixed inset-x-0 bottom-20 z-[80] flex flex-col items-center gap-2 px-4 lg:bottom-6" aria-live="polite">
        {items.map((t) => (
          <div key={t.id} className={cn('rise pointer-events-auto flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium shadow-lg', t.tone === 'xp' ? 'border-accent bg-accent text-white' : t.tone === 'err' ? 'border-rose bg-rose-soft text-rose' : 'border-line bg-ink text-paper')}>
            {t.tone === 'ok' && <Check size={15} />}{t.text}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  )
}

// ---------- primitives ----------
const HUES = ['#e8460d', '#1f6b4f', '#2a4fd6', '#b7791f', '#b4234f', '#6d3fc4', '#0e7490']
export function Avatar({ user, size = 36 }: { user: PublicUser | null; size?: number }) {
  const name = user?.name ?? '?'
  const hue = HUES[[...(user?.id ?? 'x')].reduce((s, c) => s + c.charCodeAt(0), 0) % HUES.length]
  const initials = user ? name.split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase() : '?'
  return (
    <span aria-hidden className="inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white" style={{ width: size, height: size, background: user ? hue : 'var(--faint)', fontSize: size * 0.38 }}>
      {initials}
    </span>
  )
}

export function Chip({ children, tone, className }: { children: ReactNode; tone?: string; className?: string }) {
  return <span className={cn('chip', tone && `${tone} border-transparent`, className)}>{children}</span>
}

export function PageHeader({ eyebrow, title, sub, action }: { eyebrow: string; title: ReactNode; sub?: string; action?: ReactNode }) {
  return (
    <header className="rise mb-8 flex flex-wrap items-end justify-between gap-4">
      <div className="max-w-2xl">
        <p className="eyebrow mb-2">{eyebrow}</p>
        <h1 className="display text-4xl font-medium leading-[1.05] sm:text-5xl">{title}</h1>
        {sub && <p className="mt-3 text-[15px] leading-relaxed text-muted">{sub}</p>}
      </div>
      {action}
    </header>
  )
}

export function Empty({ title, hint, action }: { title: string; hint?: string; action?: ReactNode }) {
  return (
    <div className="card flex flex-col items-center px-6 py-14 text-center">
      <span className="mb-4 grid size-12 place-items-center rounded-full bg-paper text-faint"><Inbox size={22} /></span>
      <p className="display text-xl">{title}</p>
      {hint && <p className="mt-1 max-w-sm text-sm text-muted">{hint}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}

export function Skeleton({ rows = 4, className }: { rows?: number; className?: string }) {
  return (
    <div className="grid gap-3" aria-busy>
      {Array.from({ length: rows }).map((_, i) => <div key={i} className={cn('card h-24 animate-pulse', className)} style={{ opacity: 1 - i * 0.18 }} />)}
    </div>
  )
}

export function Spinner() { return <Loader2 className="animate-spin" size={16} /> }

export function ErrorBox({ error }: { error: unknown }) {
  return <div role="alert" className="card border-rose p-4 text-sm text-rose">{error instanceof Error ? error.message : 'Could not load this. Try again.'}</div>
}

export function VoteButton({ votes, voted, disabled, onVote, label = 'Upvote' }: { votes: number; voted: boolean; disabled?: boolean; onVote: () => void; label?: string }) {
  return (
    <button type="button" aria-label={label} aria-pressed={voted} disabled={voted || disabled} onClick={onVote}
      className={cn('group flex min-w-11 flex-col items-center rounded-xl border px-2 py-1.5 transition active:scale-95 disabled:cursor-default', voted ? 'border-accent bg-accent-soft text-accent' : 'border-line bg-raised text-muted hover:border-ink hover:text-ink disabled:opacity-60')}>
      <ArrowBigUp size={20} className={cn(voted && 'fill-current')} />
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
    <div role="tablist" className="inline-flex rounded-full border border-line bg-surface p-1">
      {options.map((o) => (
        <button key={o.value} role="tab" aria-selected={value === o.value} onClick={() => onChange(o.value)}
          className={cn('h-8 rounded-full px-4 text-sm font-medium transition', value === o.value ? 'bg-ink text-paper' : 'text-muted hover:text-ink')}>
          {o.label}
        </button>
      ))}
    </div>
  )
}
