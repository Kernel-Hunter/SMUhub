import { useEffect, useState, type ReactNode } from 'react'
import { NavLink, Link, useLocation } from 'react-router-dom'
import { LogOut, Menu, Settings, X } from 'lucide-react'
import { useAuth } from '@/auth/AuthContext'
import { Avatar } from './ui'
import { cn } from '@/lib/utils'

const NAV = [
  { to: '/resources', label: 'Library' },
  { to: '/qa', label: 'Q&A' },
  { to: '/voice', label: 'Campus Voice' },
  { to: '/events', label: 'Events' },
  { to: '/rentals', label: 'Rentals' },
  { to: '/leaderboard', label: 'Leaderboard' },
]

export function Logo({ className }: { className?: string }) {
  return (
    <Link to="/" aria-label="SMUhub home" className={cn('flex items-center gap-2', className)}>
      <span className="grid size-7 place-items-center rounded-lg bg-accent text-[13px] font-bold text-[var(--accent-ink)]">S</span>
      <span className="text-[17px] font-semibold tracking-tight">SMUhub</span>
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
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[100] focus:rounded-lg focus:bg-ink focus:px-3 focus:py-2 focus:text-paper">Skip to content</a>
      <header className="sticky top-0 z-40 border-b border-line bg-paper/85 backdrop-blur-lg">
        <div className="mx-auto flex h-14 max-w-5xl items-center gap-8 px-4 sm:px-6">
          <Logo />
          <nav className="hidden flex-1 items-center gap-0.5 lg:flex" aria-label="Main">
            {NAV.map((n) => (
              <NavLink key={n.to} to={n.to} className={({ isActive }) => cn('rounded-md px-3 py-1.5 text-sm font-medium transition', isActive ? 'bg-line text-ink' : 'text-muted hover:text-ink')}>{n.label}</NavLink>
            ))}
          </nav>
          <div className="ml-auto hidden items-center gap-1.5 lg:flex">
            <Link to="/leaderboard" className="num rounded-md bg-accent-soft px-2.5 py-1 text-xs font-semibold text-accent">{me.xp.toLocaleString()} XP</Link>
            <Link to="/settings" aria-label="Settings" className="grid size-8 place-items-center rounded-md text-muted hover:bg-line hover:text-ink"><Settings size={16} /></Link>
            <button aria-label="Sign out" onClick={() => logout()} className="grid size-8 place-items-center rounded-md text-muted hover:bg-line hover:text-ink"><LogOut size={16} /></button>
            <Link to={`/u/${me.id}`} aria-label="Your profile" className="ml-1"><Avatar user={me} size={30} /></Link>
          </div>
          <button className="ml-auto grid size-9 place-items-center rounded-md hover:bg-line lg:hidden" aria-label="Open menu" aria-expanded={open} onClick={() => setOpen(true)}><Menu size={20} /></button>
        </div>
      </header>
      {open && (
        <div className="fixed inset-0 z-50 flex flex-col bg-paper lg:hidden" role="dialog" aria-modal aria-label="Menu">
          <div className="flex h-14 items-center justify-between border-b border-line px-4"><Logo /><button className="grid size-9 place-items-center rounded-md hover:bg-line" aria-label="Close menu" onClick={() => setOpen(false)}><X size={20} /></button></div>
          <nav className="flex flex-1 flex-col gap-1 overflow-auto p-3">
            {[{ to: '/', label: 'Home' }, ...NAV, { to: `/u/${me.id}`, label: 'Profile' }, { to: '/settings', label: 'Settings' }].map((n) => (
              <NavLink key={n.to} to={n.to} end={n.to === '/'} className={({ isActive }) => cn('rounded-lg px-3 py-3 text-lg font-medium', isActive ? 'bg-line' : 'text-muted')}>{n.label}</NavLink>
            ))}
            <button className="rounded-lg px-3 py-3 text-left text-lg font-medium text-muted" onClick={() => logout()}>Sign out</button>
          </nav>
          <p className="num border-t border-line p-4 text-sm text-muted">{me.xp.toLocaleString()} XP{me.rank ? ` · Rank #${me.rank}` : ''}</p>
        </div>
      )}
      <main id="main" key={pathname} className="mx-auto w-full max-w-5xl px-4 pb-24 pt-8 sm:px-6 sm:pt-10">{children}</main>
    </div>
  )
}
