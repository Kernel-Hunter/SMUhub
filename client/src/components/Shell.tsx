import { useEffect, useState, type ReactNode } from 'react'
import { NavLink, Link, useLocation } from 'react-router-dom'
import { useAuth } from '@/auth/AuthContext'
import { Avatar } from './ui'
import { cn } from '@/lib/utils'

const NAV = [
  { to: '/resources', label: 'Library' },
  { to: '/qa', label: 'Q&A' },
  { to: '/voice', label: 'Campus Voice' },
  { to: '/events', label: 'Events' },
  { to: '/rentals', label: 'Rentals' },
  { to: '/leaderboard', label: 'Ranks' },
]

export function Logo({ className }: { className?: string }) {
  return (
    <Link to="/" aria-label="SMUhub home" className={cn('flex items-center gap-2.5', className)}>
      <svg viewBox="0 0 40 40" className="size-9" aria-hidden><path d="M6 36V19a14 14 0 0 1 28 0v17z" fill="var(--cobalt)" /><path d="M13 36V20a7 7 0 0 1 14 0v16z" fill="var(--paper)" /><circle cx="20" cy="22" r="3" fill="var(--accent)" /></svg>
      <span className="display text-[1.6rem] leading-none">SMU<span className="text-cobalt">hub</span></span>
    </Link>
  )
}

export default function Shell({ children }: { children: ReactNode }) {
  const { me, logout } = useAuth()
  const [open, setOpen] = useState(false)
  const { pathname } = useLocation()
  useEffect(() => setOpen(false), [pathname])
  useEffect(() => { document.body.style.overflow = open ? 'hidden' : '' }, [open])
  if (!me) return null
  return (
    <div className="min-h-dvh">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[100] focus:rounded-full focus:bg-ink focus:px-4 focus:py-2 focus:text-paper">Skip to content</a>
      <header className="sticky top-0 z-40 px-3 pt-3 sm:px-6">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-6 rounded-full bg-raised/90 px-4 shadow-[inset_0_0_0_1px_var(--line),0_14px_30px_-20px_rgba(15,27,61,.5)] backdrop-blur-xl sm:px-6">
          <Logo />
          <nav className="hidden flex-1 items-center justify-center gap-1 lg:flex" aria-label="Main">
            {NAV.map((n) => (
              <NavLink key={n.to} to={n.to} className={({ isActive }) => cn('rounded-full px-4 py-2 text-sm font-semibold transition', isActive ? 'bg-ink text-paper' : 'text-muted hover:bg-paper hover:text-ink')}>{n.label}</NavLink>
            ))}
          </nav>
          <div className="ml-auto hidden items-center gap-2 lg:flex">
            <Link to="/leaderboard" className="num rounded-full bg-accent-soft px-3.5 py-2 text-xs font-bold text-accent transition hover:brightness-95">{me.xp.toLocaleString()} XP{me.rank ? ` · #${me.rank}` : ''}</Link>
            <Link to={`/u/${me.id}`} aria-label="Your profile" className="rounded-full transition hover:ring-2 hover:ring-cobalt"><Avatar user={me} size={36} /></Link>
            <Link to="/settings" className="rounded-full px-3 py-2 text-sm font-medium text-muted hover:text-ink">Settings</Link>
            <button onClick={() => logout()} className="rounded-full px-3 py-2 text-sm font-medium text-muted hover:text-ink">Sign out</button>
          </div>
          <button className="btn btn-ghost btn-sm ml-auto lg:hidden" aria-expanded={open} onClick={() => setOpen(true)}>Menu</button>
        </div>
      </header>
      {open && (
        <div className="zellige fixed inset-0 z-50 flex flex-col bg-cobalt-soft lg:hidden" role="dialog" aria-modal aria-label="Menu">
          <div className="flex h-20 items-center justify-between px-5"><Logo /><button className="btn btn-primary btn-sm" onClick={() => setOpen(false)}>Close</button></div>
          <nav className="stagger flex flex-1 flex-col overflow-auto px-5 py-2">
            {[{ to: '/', label: 'Home' }, ...NAV, { to: `/u/${me.id}`, label: 'Profile' }, { to: '/settings', label: 'Settings' }].map((n) => (
              <NavLink key={n.to} to={n.to} end={n.to === '/'} className={({ isActive }) => cn('display py-3 text-[2.4rem]', isActive ? 'text-accent' : 'text-ink')}>{n.label}</NavLink>
            ))}
            <button className="display py-3 text-left text-[2.4rem] text-muted" onClick={() => logout()}>Sign out</button>
          </nav>
          <div className="num m-4 rounded-full bg-accent px-5 py-3 text-center text-sm font-bold text-white">{me.xp.toLocaleString()} XP{me.rank ? ` · Rank #${me.rank}` : ''}</div>
        </div>
      )}
      <main id="main" key={pathname} className="mx-auto w-full max-w-6xl px-4 pb-24 pt-10 sm:px-8 sm:pt-12">{children}</main>
      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-7 text-xs text-muted sm:px-8"><span>SMUhub · built by students, for students</span><span>Private to SMU members</span></div>
      </footer>
    </div>
  )
}
