import { useEffect, useState, type ReactNode } from 'react'
import { NavLink, Link, useLocation } from 'react-router-dom'
import { BookOpen, CalendarDays, ChevronDown, GraduationCap, HelpCircle, LayoutGrid, Megaphone, Menu, Moon, PackageOpen, Plus, Search, Settings, Sun, Trophy, UserCircle, X, LogOut } from 'lucide-react'
import { useAuth } from '@/auth/AuthContext'
import { Avatar } from './ui'
import Palette from './Palette'
import { cn } from '@/lib/utils'

const MAIN = [
  { to: '/', label: 'Dashboard', icon: LayoutGrid, end: true },
  { to: '/resources', label: 'Library', icon: BookOpen },
  { to: '/qa', label: 'Q&A', icon: HelpCircle },
  { to: '/voice', label: 'Campus Voice', icon: Megaphone },
  { to: '/events', label: 'Events', icon: CalendarDays },
  { to: '/rentals', label: 'Rentals', icon: PackageOpen },
  { to: '/leaderboard', label: 'Leaderboard', icon: Trophy },
]

export function Logo({ className }: { className?: string }) {
  return (
    <Link to="/" aria-label="SMUhub home" className={cn('flex items-center gap-2.5', className)}>
      <span className="grid size-9 place-items-center rounded-[10px] bg-accent text-[var(--accent-ink)] shadow-[0_2px_8px_-2px_var(--accent)]"><GraduationCap size={19} /></span>
      <span className="leading-none"><span className="block text-[17px] font-bold tracking-[-0.02em]">SMUhub</span><span className="mt-0.5 block text-[10.5px] font-medium text-faint">Student community</span></span>
    </Link>
  )
}

function NavItem({ to, label, icon: Icon, end }: { to: string; label: string; icon: typeof Search; end?: boolean }) {
  return (
    <NavLink to={to} end={end} className={({ isActive }) => cn('flex items-center gap-3 rounded-[10px] px-3 py-2 text-[13.5px] font-medium transition', isActive ? 'bg-accent-soft text-accent' : 'text-muted hover:bg-paper hover:text-ink')}>
      <Icon size={17} strokeWidth={1.9} />{label}
    </NavLink>
  )
}

function Sidebar({ onNav }: { onNav?: () => void }) {
  const { me, logout } = useAuth()
  if (!me) return null
  const level = Math.floor(Math.sqrt(me.xp / 20)), lo = level * level * 20, hi = (level + 1) ** 2 * 20
  const pct = Math.max(4, ((me.xp - lo) / (hi - lo)) * 100)
  return (
    <div className="flex h-full flex-col gap-6 p-4" onClick={onNav}>
      <Logo className="px-1.5 pt-1" />
      <nav className="grid gap-0.5" aria-label="Main">
        <p className="px-3 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-faint">Main</p>
        {MAIN.map((n) => <NavItem key={n.to} {...n} />)}
        <p className="px-3 pb-1.5 pt-5 text-[11px] font-semibold uppercase tracking-wider text-faint">Account</p>
        <NavItem to={`/u/${me.id}`} label="Profile" icon={UserCircle} /><NavItem to="/settings" label="Settings" icon={Settings} />
      </nav>
      <div className="mt-auto grid gap-3">
        <Link to="/leaderboard" className="rounded-xl border border-line bg-paper p-3.5 transition hover:border-line-strong">
          <div className="flex items-center justify-between text-xs"><span className="font-semibold">Level {level}</span><span className="num text-muted">{me.xp} / {hi} XP</span></div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-line-strong"><div className="h-full rounded-full bg-accent transition-all duration-700" style={{ width: `${pct}%` }} /></div>
          <p className="mt-2 text-xs text-muted">{me.rank ? `Rank #${me.rank} on campus` : 'Upload to get ranked'}</p>
        </Link>
        <div className="flex items-center gap-2.5 border-t border-line pt-4">
          <Avatar user={me} size={34} />
          <span className="min-w-0 flex-1 leading-tight"><span className="block truncate text-[13px] font-semibold">{me.name}</span><span className="block truncate text-xs text-muted">{me.major} · Y{me.year}</span></span>
          <button aria-label="Sign out" onClick={(e) => { e.stopPropagation(); logout() }} className="grid size-8 place-items-center rounded-lg text-muted hover:bg-paper hover:text-ink"><LogOut size={15} /></button>
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
  return (
    <div className="min-h-dvh">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[100] focus:rounded-lg focus:bg-ink focus:px-3 focus:py-2 focus:text-paper">Skip to content</a>
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[264px] border-r border-line bg-surface lg:block"><Sidebar /></aside>
      <div className="lg:pl-[264px]">
        <header className="glass sticky top-0 z-20 border-b border-line">
          <div className="flex h-16 items-center gap-3 px-4 sm:px-8">
            <button className="grid size-9 place-items-center rounded-lg hover:bg-line lg:hidden" aria-label="Open menu" onClick={() => setMenu(true)}><Menu size={19} /></button>
            <button onClick={() => setSearch(true)} className="flex h-10 w-full max-w-md items-center gap-2.5 rounded-xl border border-line-strong bg-surface px-3.5 text-[13.5px] text-faint shadow-[var(--shadow-xs)] transition hover:border-faint"><Search size={15} /><span className="truncate">Search resources, questions, events…</span><span className="kbd ml-auto hidden sm:block">⌘K</span></button>
            <div className="ml-auto flex items-center gap-1.5">
              <button onClick={toggle} aria-label="Toggle theme" className="grid size-9 place-items-center rounded-lg text-muted hover:bg-line hover:text-ink">{dark ? <Sun size={17} /> : <Moon size={17} />}</button>
              <div className="relative">
                <button onClick={() => setAdd(!add)} className="btn btn-accent btn-sm !h-10 !px-3.5" aria-expanded={add}><Plus size={15} /><span className="hidden sm:inline">New</span><ChevronDown size={13} /></button>
                {add && (<>
                  <div className="fixed inset-0 z-10" onClick={() => setAdd(false)} />
                  <div className="card rise absolute right-0 top-12 z-20 w-56 overflow-hidden p-1.5 shadow-[var(--shadow-md)]">
                    {[['/resources/new', 'Upload resource'], ['/qa/new', 'Ask a question'], ['/voice/new', 'Post to Campus Voice'], ['/rentals', 'List a rental']].map(([to, t]) => <Link key={to} to={to} className="block rounded-lg px-3 py-2 text-[13px] font-medium hover:bg-paper">{t}</Link>)}
                  </div></>)}
              </div>
            </div>
          </div>
        </header>
        <main id="main" key={pathname} className="mx-auto w-full max-w-6xl px-4 pb-24 pt-8 sm:px-8">{children}</main>
      </div>
      {menu && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal aria-label="Menu">
          <div className="absolute inset-0 bg-black/40" style={{ animation: 'fade .15s' }} onClick={() => setMenu(false)} />
          <div className="rise absolute inset-y-0 left-0 w-72 bg-surface shadow-2xl"><button aria-label="Close menu" className="absolute right-3 top-4 grid size-8 place-items-center rounded-lg hover:bg-line" onClick={() => setMenu(false)}><X size={17} /></button><Sidebar onNav={() => setMenu(false)} /></div>
        </div>
      )}
      <Palette open={search} onClose={() => setSearch(false)} />
    </div>
  )
}
