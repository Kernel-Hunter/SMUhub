import { useEffect, useState, type ReactNode } from 'react'
import { NavLink, Link, useLocation } from 'react-router-dom'
import { BookOpen, CalendarDays, HelpCircle, LayoutGrid, LogOut, Megaphone, Menu, Moon, PackageOpen, Plus, Search, Settings, Sun, Trophy, UserRound, X } from 'lucide-react'
import { useAuth } from '@/auth/AuthContext'
import { Avatar } from './ui'
import Palette from './Palette'
import { cn } from '@/lib/utils'

const MAIN = [
  { to: '/', label: 'Home', icon: LayoutGrid, end: true },
  { to: '/resources', label: 'Library', icon: BookOpen },
  { to: '/qa', label: 'Questions', icon: HelpCircle },
  { to: '/voice', label: 'Campus Voice', icon: Megaphone },
  { to: '/events', label: 'Calendar', icon: CalendarDays },
  { to: '/rentals', label: 'Rentals', icon: PackageOpen },
  { to: '/leaderboard', label: 'Leaderboard', icon: Trophy },
]
const TITLES: Record<string, string> = { '': 'Home', resources: 'Library', qa: 'Questions', voice: 'Campus Voice', events: 'Calendar', rentals: 'Rentals', leaderboard: 'Leaderboard', settings: 'Settings', u: 'Profile' }

export function Logo({ className }: { className?: string }) {
  return (
    <Link to="/" aria-label="SMUhub home" className={cn('flex items-center gap-3', className)}>
      <span className="hero-bg grid size-7 place-items-center rounded-md text-white shadow-[0_4px_12px_-4px_#3b5bff,inset_0_1px_0_rgb(255_255_255/.25)]">
        <svg viewBox="0 0 16 16" className="size-[15px]" aria-hidden><path d="M3 5.2 8 3l5 2.2L8 7.4z" fill="currentColor" /><path d="M5 6.6v2.6c0 .9 1.4 1.8 3 1.8s3-.9 3-1.8V6.6" fill="none" stroke="currentColor" strokeWidth="1.3" /><path d="M13 5.4v3.4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" /></svg>
      </span>
      <span className="text-sm font-semibold">SMUhub</span>
    </Link>
  )
}

function Item({ to, label, icon: Icon, end }: { to: string; label: string; icon: typeof Search; end?: boolean }) {
  return (
    <NavLink to={to} end={end} className={({ isActive }) => cn('flex h-8 min-w-0 items-center gap-3 rounded-sm px-3 text-sm font-medium transition-colors', isActive ? 'bg-accent-soft text-accent' : 'text-muted hover:bg-hover hover:text-ink')}>
      {({ isActive }) => <><Icon size={16} strokeWidth={1.75} className={cn('shrink-0', isActive && 'text-accent')} /><span className="truncate">{label}</span></>}
    </NavLink>
  )
}

function Sidebar({ onNav }: { onNav?: () => void }) {
  const { me, logout } = useAuth()
  if (!me) return null
  const level = Math.floor(Math.sqrt(me.xp / 20)), lo = level * level * 20, hi = (level + 1) ** 2 * 20
  const pct = Math.max(4, ((me.xp - lo) / (hi - lo)) * 100)
  // Layout: every block spans the same box (12px from the sidebar edges) and pads its content by 10px (px-2.5),
  // so logo, nav labels, section title, XP card and user row all line up on the same left and right edges.
  // Stacks are flex columns, not CSS grids: an implicit grid column grows to its widest child's min-content,
  // and nowrap (truncated) text made that wider than the sidebar.
  return (
    <div className="flex h-full min-w-0 flex-col px-3 py-4" onClick={onNav}>
      <div className="flex items-center justify-between gap-2 px-3"><Logo /><span className="shrink-0 rounded-full bg-accent-soft px-2 py-1 text-xs font-semibold text-accent">Beta</span></div>
      <nav className="mt-6 flex flex-col gap-1" aria-label="Main">{MAIN.map((n) => <Item key={n.to} {...n} />)}</nav>
      <p className="mt-7 px-3 pb-2 text-xs font-medium text-faint">You</p>
      <nav className="flex flex-col gap-1" aria-label="Account"><Item to={`/u/${me.id}`} label="Profile" icon={UserRound} /><Item to="/settings" label="Settings" icon={Settings} /></nav>
      <div className="mt-auto flex flex-col gap-2 pt-4">
        <Link to="/leaderboard" className="group block rounded-lg bg-hover px-3 py-3 transition hover:bg-accent-soft">
          <div className="flex items-baseline justify-between gap-2"><span className="text-xs font-semibold">Level {level}</span><span className="num truncate text-xs text-muted">{me.xp} / {hi} XP</span></div>
          <div className="mt-2 flex gap-[3px]">{Array.from({ length: 10 }).map((_, i) => <span key={i} className={cn('h-1 flex-1 rounded-full', i < Math.round(pct / 10) ? 'bg-accent' : 'bg-line-strong')} />)}</div>
          <p className="mt-2 text-xs text-muted">{me.rank ? `#${me.rank} on campus this term` : 'Share something to get ranked'}</p>
        </Link>
        <div className="flex items-center gap-3 rounded-md px-3 py-2 transition hover:bg-hover">
          <Avatar user={me} size={28} />
          <span className="min-w-0 flex-1 leading-tight"><span className="block truncate text-sm font-medium" title={me.name}>{me.name}</span><span className="block truncate text-xs text-muted" title={`${me.major}, year ${me.year}`}>{me.major}, year {me.year}</span></span>
          <button type="button" aria-label="Sign out" title="Sign out" onClick={(e) => { e.stopPropagation(); logout() }} className="-mr-1 grid size-7 shrink-0 place-items-center rounded-md text-faint hover:bg-surface hover:text-ink"><LogOut size={14} /></button>
        </div>
      </div>
    </div>
  )
}

export default function Shell({ children }: { children: ReactNode }) {
  const { me } = useAuth()
  const [menu, setMenu] = useState(false); const [search, setSearch] = useState(false); const [add, setAdd] = useState(false)
  const [dark, setDark] = useState(() => document.documentElement.classList.contains('dark'))
  const { pathname } = useLocation()
  useEffect(() => { setMenu(false); setAdd(false) }, [pathname])
  useEffect(() => { document.body.style.overflow = menu ? 'hidden' : '' }, [menu])
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setSearch((v) => !v) } }
    window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k)
  }, [])
  const toggle = () => {
    const next = !dark; setDark(next)
    document.documentElement.classList.toggle('dark', next)
    try { localStorage.setItem('smuhub.theme', next ? 'dark' : 'light') } catch { /* ignore */ }
  }
  if (!me) return null
  const section = TITLES[pathname.split('/')[1] ?? ''] ?? 'SMUhub'
  return (
    <div className="min-h-dvh">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[100] focus:rounded-lg focus:bg-ink focus:px-3 focus:py-2 focus:text-paper">Skip to content</a>
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[244px] border-r border-line bg-side lg:block"><Sidebar /></aside>
      <div className="lg:pl-[244px]">
        <header className="glass sticky top-0 z-20 border-b border-line">
          <div className="mx-auto flex h-12 max-w-[1120px] items-center gap-3 px-4 sm:px-8">
            <button className="-ml-1 grid size-8 place-items-center rounded-md hover:bg-hover lg:hidden" aria-label="Open menu" onClick={() => setMenu(true)}><Menu size={18} /></button>
            <span className="flex items-center gap-2 text-sm"><span className="text-faint">SMUhub</span><span className="text-faint">/</span><span className="font-medium">{section}</span></span>
            <div className="ml-auto flex items-center gap-2">
              <button onClick={() => setSearch(true)} className="hidden h-8 w-60 items-center gap-2 rounded-md bg-hover px-3 text-sm text-faint transition hover:text-muted md:flex"><Search size={14} />Search SMUhub<span className="kbd ml-auto">⌘K</span></button>
              <button onClick={() => setSearch(true)} aria-label="Search" className="grid size-8 place-items-center rounded-md text-muted hover:bg-hover md:hidden"><Search size={16} /></button>
              <button onClick={toggle} aria-label={dark ? 'Use light theme' : 'Use dark theme'} title={dark ? 'Light theme' : 'Dark theme'} className="grid size-8 place-items-center rounded-md text-muted transition hover:bg-hover hover:text-ink">{dark ? <Sun size={16} /> : <Moon size={16} />}</button>
              <div className="relative">
                <button onClick={() => setAdd(!add)} className="btn btn-primary btn-sm" aria-expanded={add} aria-haspopup="menu"><Plus size={14} />New</button>
                {add && (<>
                  <div className="fixed inset-0 z-10" onClick={() => setAdd(false)} />
                  <div role="menu" className="absolute right-0 top-10 z-20 w-60 rounded-md bg-raised p-1 shadow-[var(--lift)]" style={{ animation: 'rise .16s ease-out' }}>
                    {[['/resources/new', BookOpen, 'Upload a resource', 'U'], ['/qa/new', HelpCircle, 'Ask a question', 'Q'], ['/voice/new', Megaphone, 'Post to Campus Voice', 'V'], ['/events', CalendarDays, 'Add an event', 'E'], ['/rentals', PackageOpen, 'Lend something', 'R']].map(([to, I, t, k]) => { const Icon = I as typeof Search; return (
                      <Link role="menuitem" key={to as string} to={to as string} className="flex items-center gap-3 rounded-sm px-3 py-2 text-sm hover:bg-hover"><Icon size={15} className="text-muted" />{t as string}<span className="kbd ml-auto">{k as string}</span></Link>) })}
                  </div></>)}
              </div>
            </div>
          </div>
        </header>
        <main id="main" key={pathname} className="mx-auto w-full max-w-[1120px] px-4 pb-24 pt-8 sm:px-8 sm:pt-10" style={{ animation: 'fade .25s ease-out' }}>{children}</main>
      </div>
      {menu && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal aria-label="Menu">
          <div className="absolute inset-0 bg-black/30" style={{ animation: 'fade .15s' }} onClick={() => setMenu(false)} />
          <div className="absolute inset-y-0 left-0 w-[270px] bg-side shadow-2xl" style={{ animation: 'rise .2s ease-out' }}><button aria-label="Close menu" className="absolute right-3 top-4 grid size-7 place-items-center rounded-md hover:bg-hover" onClick={() => setMenu(false)}><X size={16} /></button><Sidebar onNav={() => setMenu(false)} /></div>
        </div>
      )}
      <Palette open={search} onClose={() => setSearch(false)} />
    </div>
  )
}
