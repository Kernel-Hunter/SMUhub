import { useEffect, useState, type ReactNode } from 'react'
import { NavLink, Link, useLocation } from 'react-router-dom'
import { BookOpen, CalendarDays, HelpCircle, LayoutGrid, LogOut, Megaphone, Menu, Moon, PackageOpen, Plus, Search, Settings, Sun, Trophy, UserRound, X } from 'lucide-react'
import { GraduationCap } from 'lucide-react'
import { useAuth } from '@/auth/AuthContext'
import { Avatar } from './ui'
import Palette from './Palette'
import Flow from './Flow'
import { cn } from '@/lib/utils'

const MAIN = [
  { to: '/', label: 'Home', icon: LayoutGrid, end: true, hue: 'blue' },
  { to: '/courses', label: 'Courses', icon: GraduationCap, hue: 'plum' },
  { to: '/resources', label: 'Library', icon: BookOpen, hue: 'blue' },
  { to: '/qa', label: 'Questions', icon: HelpCircle, hue: 'violet' },
  { to: '/voice', label: 'Campus Voice', icon: Megaphone, hue: 'orange' },
  { to: '/events', label: 'Calendar', icon: CalendarDays, hue: 'rose' },
  { to: '/rentals', label: 'Rentals', icon: PackageOpen, hue: 'green' },
  { to: '/leaderboard', label: 'Leaderboard', icon: Trophy, hue: 'gold' },
]
const TITLES: Record<string, string> = { '': 'Home', resources: 'Library', qa: 'Questions', voice: 'Campus Voice', events: 'Calendar', rentals: 'Rentals', leaderboard: 'Leaderboard', settings: 'Settings', u: 'Profile', courses: 'Courses' }

export function Logo({ className }: { className?: string }) {
  return (
    <Link to="/" aria-label="SMUhub home" className={cn('flex items-center gap-3', className)}>
      {/* Official SMU mark, kept intact. Its background is transparent and blue on dark is hard to read,
          so in dark mode it sits on a small white rounded tile. */}
      <span className="grid size-8 shrink-0 place-items-center rounded-sm dark:bg-white dark:p-0.5">
        <img src="/smu-mark.png" alt="Logo South Mediterranean University" width={32} height={32} className="size-full object-contain" />
      </span>
      <span className="text-base font-semibold text-heading">SMUhub</span>
    </Link>
  )
}

function Item({ to, label, icon: Icon, end, hue = 'blue' }: { to: string; label: string; icon: typeof Search; end?: boolean; hue?: string }) {
  return (
    <NavLink to={to} end={end} className={({ isActive }) => cn(`hue-${hue}`, 'group relative flex h-9 min-w-0 items-center gap-3 rounded-md px-3 text-sm font-medium transition-colors', isActive ? 'bg-hue-soft text-hue' : 'text-muted hover:bg-hover hover:text-ink')}>
      {({ isActive }) => <>
        {isActive && <span className="absolute -left-3 top-1.5 bottom-1.5 w-[3px] rounded-r-full" style={{ background: 'var(--hue)', animation: 'fade .2s' }} aria-hidden />}
        <span className={cn('grid size-6 shrink-0 place-items-center rounded-[6px] transition-colors', isActive ? 'bg-hue' : 'group-hover:text-hue')}><Icon size={15} strokeWidth={isActive ? 2 : 1.75} /></span>
        <span className="truncate">{label}</span></>}
    </NavLink>
  )
}

function Sidebar({ onNav }: { onNav?: () => void }) {
  const { me, logout } = useAuth()
  if (!me) return null
  const level = Math.floor(Math.sqrt(me.xp / 20)), lo = level * level * 20, hi = (level + 1) ** 2 * 20
  const pct = Math.max(4, ((me.xp - lo) / (hi - lo)) * 100)
  // Layout: every block spans the same box (12px from the sidebar edges) and pads its content by 12px (px-3),
  // so logo, nav labels, section title, XP card and user row all line up on the same left and right edges.
  // Stacks are flex columns, not CSS grids: an implicit grid column grows to its widest child's min-content,
  // and nowrap (truncated) text made that wider than the sidebar.
  return (
    <div className="flex h-full min-w-0 flex-col px-3 py-4" onClick={onNav}>
      <div className="flex items-center justify-between gap-2 px-3"><Logo /><span className="shrink-0 rounded-sm bg-accent-soft px-2 text-xs font-medium text-accent">Beta</span></div>
      <nav className="mt-6 flex flex-col gap-0.5" aria-label="Main">{MAIN.map((n) => <Item key={n.to} {...n} />)}</nav>
      <p className="mt-8 px-3 pb-2 text-xs font-medium text-faint">You</p>
      <nav className="flex flex-col gap-1" aria-label="Account"><Item to={`/u/${me.id}`} label="Profile" icon={UserRound} /><Item to="/settings" label="Settings" icon={Settings} /></nav>
      <div className="mt-auto flex flex-col gap-2 pt-4">
        <Link to="/leaderboard" className="night relative block overflow-hidden rounded-[10px] px-3 py-3 transition-transform hover:-translate-y-0.5">
          <Flow className="w-full text-[#3fb0d0] opacity-40" />
          <div className="relative flex items-baseline justify-between gap-2"><span className="text-xs font-semibold">Level {level}</span><span className="num truncate text-xs text-white/70">{me.xp} / {hi} XP</span></div>
          <div className="relative mt-2 h-1.5 overflow-hidden rounded-full bg-white/15" aria-hidden><span className="block h-full rounded-full bg-[#3fb0d0] transition-[width] duration-700" style={{ width: `${pct}%` }} /></div>
          <p className="relative mt-2 text-xs text-white/70">{me.rank ? `#${me.rank} on campus this term` : 'Share something to get ranked'}</p>
        </Link>
        <div className="flex items-center gap-3 rounded-md px-3 py-2 transition-colors hover:bg-hover">
          <Avatar user={me} size={28} />
          <span className="min-w-0 flex-1 leading-tight"><span className="block truncate text-sm font-medium" title={me.name}>{me.name}</span><span className="block truncate text-xs text-muted" title={me.major ? `${me.major}, year ${me.year}` : `Year ${me.year}`}>{me.major ? `${me.major}, year ${me.year}` : `Year ${me.year}`}</span></span>
          <button type="button" aria-label="Sign out" title="Sign out" onClick={(e) => { e.stopPropagation(); logout() }} className="-mr-1 grid size-7 shrink-0 place-items-center rounded-sm text-faint hover:bg-surface hover:text-ink"><LogOut size={14} /></button>
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
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 border-r border-line bg-side lg:block"><Sidebar /></aside>
      <div className="lg:pl-60">
        <header className="sticky top-0 z-20 border-b border-line bg-bg">
          <div className="mx-auto flex h-12 max-w-[1120px] items-center gap-3 px-4 sm:px-8">
            <button className="-ml-1 grid size-8 place-items-center rounded-sm hover:bg-hover lg:hidden" aria-label="Open menu" onClick={() => setMenu(true)}><Menu size={18} /></button>
            <span className="flex items-center gap-2 text-sm"><span className="text-faint">SMUhub</span><span className="text-faint">/</span><span className="font-medium">{section}</span></span>
            <div className="ml-auto flex items-center gap-2">
              <button onClick={() => setSearch(true)} className="hidden h-8 w-60 items-center gap-2 rounded-sm border border-line bg-surface px-3 text-sm text-faint transition-colors hover:border-line-strong hover:text-muted md:flex"><Search size={14} />Search SMUhub<span className="kbd ml-auto">⌘K</span></button>
              <button onClick={() => setSearch(true)} aria-label="Search" className="grid size-8 place-items-center rounded-sm text-muted hover:bg-hover md:hidden"><Search size={16} /></button>
              <button onClick={toggle} aria-label={dark ? 'Use light theme' : 'Use dark theme'} title={dark ? 'Light theme' : 'Dark theme'} className="grid size-8 place-items-center rounded-sm text-muted transition hover:bg-hover hover:text-ink">{dark ? <Sun size={16} /> : <Moon size={16} />}</button>
              <div className="relative">
                <button onClick={() => setAdd(!add)} className="btn btn-primary btn-sm" aria-expanded={add} aria-haspopup="menu"><Plus size={14} />New</button>
                {add && (<>
                  <div className="fixed inset-0 z-10" onClick={() => setAdd(false)} />
                  <div role="menu" className="popover absolute right-0 top-10 z-20 w-60 p-1" style={{ animation: 'rise .16s ease-out' }}>
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
          <div className="absolute inset-0 bg-[var(--overlay)]" style={{ animation: 'fade .15s' }} onClick={() => setMenu(false)} />
          <div className="absolute inset-y-0 left-0 w-[272px] border-r border-line bg-side shadow-popover" style={{ animation: 'rise .2s ease-out' }}><button aria-label="Close menu" className="absolute right-3 top-4 grid size-7 place-items-center rounded-md hover:bg-hover" onClick={() => setMenu(false)}><X size={16} /></button><Sidebar onNav={() => setMenu(false)} /></div>
        </div>
      )}
      <Palette open={search} onClose={() => setSearch(false)} />
    </div>
  )
}
