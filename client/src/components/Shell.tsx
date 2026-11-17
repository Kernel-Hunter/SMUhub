import { useEffect, useState, type ReactNode } from 'react'
import { NavLink, Link, useLocation } from 'react-router-dom'
import { LogOut, Menu, Search, Settings, X } from 'lucide-react'
import { useAuth } from '@/auth/AuthContext'
import { Avatar } from './ui'
import Palette from './Palette'
import { cn } from '@/lib/utils'

const NAV = [
  { to: '/resources', label: 'Library' },
  { to: '/qa', label: 'Q&A' },
  { to: '/voice', label: 'Voice' },
  { to: '/events', label: 'Events' },
  { to: '/rentals', label: 'Rentals' },
  { to: '/leaderboard', label: 'Leaderboard' },
]

export function Logo({ className }: { className?: string }) {
  return (
    <Link to="/" aria-label="SMUhub home" className={cn('flex items-center gap-2.5', className)}>
      <svg viewBox="0 0 28 28" className="size-6" aria-hidden><defs><linearGradient id="lg" x1="0" y1="0" x2="1" y2="1"><stop stopColor="var(--accent)" /><stop offset="1" stopColor="#ff4d6d" /></linearGradient></defs><rect width="28" height="28" rx="8" fill="url(#lg)" /><path d="M8 19.5c.6 1.3 2.1 2 3.9 2 2.2 0 3.6-1 3.6-2.6 0-3.6-7.3-1.6-7.3-6 0-2 1.7-3.4 4.1-3.4 1.9 0 3.3.7 4 1.9" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" /></svg>
      <span className="text-[15px] font-semibold tracking-[-0.02em]">SMUhub</span>
    </Link>
  )
}

export default function Shell({ children }: { children: ReactNode }) {
  const { me, logout } = useAuth()
  const [menu, setMenu] = useState(false); const [search, setSearch] = useState(false)
  const { pathname } = useLocation()
  useEffect(() => setMenu(false), [pathname])
  useEffect(() => { document.body.style.overflow = menu ? 'hidden' : '' }, [menu])
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setSearch((v) => !v) } }
    window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k)
  }, [])
  if (!me) return null
  return (
    <div className="min-h-dvh">
      <div className="hero-glow pointer-events-none fixed inset-x-0 top-0 -z-10 h-[42rem]" aria-hidden /><div className="grid-bg pointer-events-none fixed inset-x-0 top-0 -z-10 h-[34rem] opacity-60" aria-hidden />
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[100] focus:rounded-lg focus:bg-ink focus:px-3 focus:py-2 focus:text-paper">Skip to content</a>
      <header className="glass sticky top-0 z-40 border-b border-line">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-7 px-4 sm:px-6">
          <Logo />
          <nav className="hidden flex-1 items-center gap-1 lg:flex" aria-label="Main">
            {NAV.map((n) => (
              <NavLink key={n.to} to={n.to} className={({ isActive }) => cn('rounded-full px-3 py-1.5 text-[13px] transition', isActive ? 'bg-line-strong font-medium text-ink' : 'text-muted hover:text-ink')}>{n.label}</NavLink>
            ))}
          </nav>
          <div className="ml-auto hidden items-center gap-2 lg:flex">
            <button onClick={() => setSearch(true)} className="flex h-8 w-56 items-center gap-2 rounded-full border border-line-strong bg-[var(--hi)] px-3 text-[13px] text-faint transition hover:border-faint"><Search size={14} />Search<span className="kbd ml-auto">⌘K</span></button>
            <Link to="/leaderboard" className="num rounded-full bg-accent-soft px-2.5 py-1 text-xs font-medium text-accent">{me.xp.toLocaleString()} XP</Link>
            <Link to="/settings" aria-label="Settings" className="grid size-8 place-items-center rounded-full text-muted hover:bg-line hover:text-ink"><Settings size={15} /></Link>
            <button aria-label="Sign out" onClick={() => logout()} className="grid size-8 place-items-center rounded-full text-muted hover:bg-line hover:text-ink"><LogOut size={15} /></button>
            <Link to={`/u/${me.id}`} aria-label="Your profile"><Avatar user={me} size={28} /></Link>
          </div>
          <div className="ml-auto flex items-center gap-1 lg:hidden">
            <button className="grid size-9 place-items-center rounded-full hover:bg-line" aria-label="Search" onClick={() => setSearch(true)}><Search size={18} /></button>
            <button className="grid size-9 place-items-center rounded-full hover:bg-line" aria-label="Open menu" aria-expanded={menu} onClick={() => setMenu(true)}><Menu size={19} /></button>
          </div>
        </div>
      </header>
      {menu && (
        <div className="fixed inset-0 z-50 flex flex-col bg-paper lg:hidden" role="dialog" aria-modal aria-label="Menu">
          <div className="flex h-14 items-center justify-between border-b border-line px-4"><Logo /><button className="grid size-9 place-items-center rounded-full hover:bg-line" aria-label="Close menu" onClick={() => setMenu(false)}><X size={19} /></button></div>
          <nav className="stagger flex flex-1 flex-col overflow-auto p-4">
            {[{ to: '/', label: 'Home' }, ...NAV, { to: `/u/${me.id}`, label: 'Profile' }, { to: '/settings', label: 'Settings' }].map((n) => (
              <NavLink key={n.to} to={n.to} end={n.to === '/'} className={({ isActive }) => cn('display border-b border-line py-4 text-3xl', isActive ? 'text-accent' : 'text-ink')}>{n.label}</NavLink>
            ))}
            <button className="display py-4 text-left text-3xl text-muted" onClick={() => logout()}>Sign out</button>
          </nav>
        </div>
      )}
      <Palette open={search} onClose={() => setSearch(false)} />
      <main id="main" key={pathname} className="mx-auto w-full max-w-6xl px-4 pb-28 pt-10 sm:px-6 sm:pt-14">{children}</main>
    </div>
  )
}
