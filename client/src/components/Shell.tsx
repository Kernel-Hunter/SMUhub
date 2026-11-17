import { useEffect, useState, type ReactNode } from 'react'
import { NavLink, Link, useLocation } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/auth/AuthContext'
import { api } from '@/api/mock'
import { Avatar } from './ui'
import { cn, daysUntil } from '@/lib/utils'

const NAV = [
  { to: '/resources', label: 'Library' },
  { to: '/qa', label: 'Q&A' },
  { to: '/voice', label: 'Voice' },
  { to: '/events', label: 'Events' },
  { to: '/rentals', label: 'Rentals' },
  { to: '/leaderboard', label: 'Ranks' },
]

export function Logo({ className }: { className?: string }) {
  return (
    <Link to="/" aria-label="SMUhub home" className={cn('display flex items-baseline text-[1.9rem] leading-none', className)}>
      <span>SMU</span><span className="hl ml-0.5 px-1">hub</span>
    </Link>
  )
}

function Ticker() {
  const { data } = useQuery({ queryKey: ['events'], queryFn: api.events.list })
  const items = (data ?? []).slice(0, 8).map((e) => `${daysUntil(e.startsAt).toUpperCase()} — ${e.title}`)
  if (!items.length) return <div className="h-8 bg-ink" />
  const row = [...items, ...items]
  return (
    <div className="ticker overflow-hidden bg-ink py-2 text-paper" aria-label="Upcoming events">
      <div className="ticker-track num text-[11px] uppercase tracking-[.14em]">
        {[0, 1].map((k) => <div key={k} className="flex shrink-0">{row.map((t, i) => <span key={i} className="px-6">{t}<span className="ml-12 text-accent">■</span></span>)}</div>)}
      </div>
    </div>
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
    <div className="grain min-h-dvh">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[100] focus:bg-accent focus:px-3 focus:py-2 focus:text-[#121210]">Skip to content</a>
      <Ticker />
      <header className="sticky top-0 z-40 border-b-[1.5px] border-ink bg-paper">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-8 px-4 sm:px-8">
          <Logo />
          <nav className="hidden flex-1 items-center gap-1 lg:flex" aria-label="Main">
            {NAV.map((n) => (
              <NavLink key={n.to} to={n.to} className={({ isActive }) => cn('px-3 py-2 font-mono text-[12px] font-semibold uppercase tracking-[.1em] transition', isActive ? 'bg-ink text-paper' : 'hover:bg-accent hover:text-[#121210]')}>{n.label}</NavLink>
            ))}
          </nav>
          <div className="ml-auto hidden items-center gap-3 lg:flex">
            <Link to="/leaderboard" className="num border-[1.5px] border-ink bg-accent px-2.5 py-1.5 text-xs font-bold text-[#121210] transition hover:-translate-y-px">{me.xp.toLocaleString()} XP{me.rank ? ` · #${me.rank}` : ''}</Link>
            <Link to={`/u/${me.id}`} aria-label="Your profile"><Avatar user={me} size={34} /></Link>
            <Link to="/settings" className="font-mono text-[11px] uppercase tracking-widest text-muted hover:text-ink">Settings</Link>
            <button onClick={() => logout()} className="font-mono text-[11px] uppercase tracking-widest text-muted hover:text-ink">Out</button>
          </div>
          <button className="btn btn-ghost btn-sm ml-auto lg:hidden" aria-expanded={open} onClick={() => setOpen(true)}>Menu</button>
        </div>
      </header>
      {open && (
        <div className="fixed inset-0 z-50 flex flex-col bg-paper lg:hidden" role="dialog" aria-modal aria-label="Menu">
          <div className="flex h-16 items-center justify-between border-b-[1.5px] border-ink px-4"><Logo /><button className="btn btn-ghost btn-sm" onClick={() => setOpen(false)}>Close</button></div>
          <nav className="stagger flex flex-1 flex-col overflow-auto px-4 py-4">
            {[{ to: '/', label: 'Front page' }, ...NAV, { to: `/u/${me.id}`, label: 'Profile' }, { to: '/settings', label: 'Settings' }].map((n) => (
              <NavLink key={n.to} to={n.to} end={n.to === '/'} className={({ isActive }) => cn('display border-b border-line py-3.5 text-[2.6rem]', isActive && 'hl')}>{n.label}</NavLink>
            ))}
            <button className="display py-3.5 text-left text-[2.6rem] text-muted" onClick={() => logout()}>Sign out</button>
          </nav>
          <div className="num border-t-[1.5px] border-ink bg-accent px-4 py-3 text-sm font-bold text-[#121210]">{me.xp.toLocaleString()} XP{me.rank ? ` · RANK #${me.rank}` : ''}</div>
        </div>
      )}
      <main id="main" key={pathname} className="mx-auto w-full max-w-6xl px-4 pb-24 pt-10 sm:px-8 sm:pt-14">{children}</main>
      <footer className="border-t-[1.5px] border-ink">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-6 font-mono text-[11px] uppercase tracking-widest text-muted sm:px-8">
          <span>SMUhub · built by students, for students</span><span>Private · SMU members only</span>
        </div>
      </footer>
    </div>
  )
}
