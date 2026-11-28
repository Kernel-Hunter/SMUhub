import { useEffect, useRef, useState, type ReactNode } from 'react'
import { NavLink, Link, useLocation, useNavigate } from 'react-router-dom'
import { BookOpen, CalendarDays, HelpCircle, LayoutGrid, LogOut, Megaphone, Menu, Moon, Newspaper, PackageOpen, Plus, Search, Settings, Sun, Trophy, UserRound, X } from 'lucide-react'
import { useAuth } from '@/auth/AuthContext'
import { GraduationCap } from 'lucide-react'
import { Avatar } from './ui'
import Palette from './Palette'
import Flow from './Flow'
import NotificationBell from './Notifications'
import { cn, levelOf } from '@/lib/utils'

const MAIN = [
  { to: '/', label: 'Home', icon: LayoutGrid, end: true, hue: 'blue' },
  { to: '/courses', label: 'Courses', icon: GraduationCap, hue: 'plum' },
  { to: '/resources', label: 'Library', icon: BookOpen, hue: 'blue' },
  { to: '/qa', label: 'Questions', icon: HelpCircle, hue: 'violet' },
  { to: '/voice', label: 'Campus Voice', icon: Megaphone, hue: 'orange' },
  { to: '/events', label: 'Calendar & news', icon: CalendarDays, hue: 'rose' },
  { to: '/rentals', label: 'Rentals', icon: PackageOpen, hue: 'green' },
  { to: '/leaderboard', label: 'Leaderboard', icon: Trophy, hue: 'gold' },
]
/** The "New" menu. Each letter works while the menu is open. */
const NEW_ITEMS = [
  { to: '/resources/new', icon: BookOpen, label: 'Share a file', key: 'U' },
  { to: '/qa/new', icon: HelpCircle, label: 'Ask a question', key: 'Q' },
  { to: '/voice/new', icon: Megaphone, label: 'Post to Campus Voice', key: 'V' },
  { to: '/events?new=announcement', icon: Newspaper, label: 'Post an announcement', key: 'N' },
  { to: '/events?new=event', icon: CalendarDays, label: 'Add an event', key: 'E' },
  { to: '/rentals', icon: PackageOpen, label: 'Lend something', key: 'R' },
]
const TITLES: Record<string, string> = { '': 'Home', resources: 'Library', qa: 'Questions', voice: 'Campus Voice', events: 'Calendar & news', rentals: 'Rentals', leaderboard: 'Leaderboard', settings: 'Settings', u: 'Profile', courses: 'Courses' }

export function Logo({ className }: { className?: string }) {
  return (
    <Link to="/" aria-label="SMUhub home" className={cn('flex items-center gap-3', className)}>
      {/* Official SMU mark, kept intact. Its background is transparent and blue on dark is hard to read,
          so in dark mode it sits on a small white rounded tile. */}
      <span className="grid size-8 shrink-0 place-items-center rounded-sm dark:bg-white dark:p-0.5">
        <img src="/smu-mark.png" alt="Logo South Mediterranean University" width={32} height={32} className="size-full object-contain" />
      </span>
      <span className="text-base font-medium text-heading">SMUhub</span>
    </Link>
  )
}

function Item({ to, label, icon: Icon, end, hue = 'blue' }: { to: string; label: string; icon: typeof Search; end?: boolean; hue?: string }) {
  return (
    <NavLink to={to} end={end} className={({ isActive }) => cn(`hue-${hue}`, 'group relative flex h-9 min-w-0 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors', isActive ? 'nav-on text-ink' : 'nav-row text-muted hover:text-ink')}>
      {({ isActive }) => <>
        <span className={cn('grid size-6 shrink-0 place-items-center transition-colors', isActive ? 'text-hue' : 'group-hover:text-hue')}><Icon size={16} aria-hidden /></span>
        <span className="truncate">{label}</span></>}
    </NavLink>
  )
}

function Sidebar({ onNav }: { onNav?: () => void }) {
  const { me, logout } = useAuth()
  if (!me) return null
  const { level, hi, progress } = levelOf(me.xp)
  const pct = Math.max(4, progress * 100)
  // Layout: every block spans the same box (12px from the sidebar edges) and pads its content by 12px (px-3),
  // so logo, nav labels, section title, XP card and user row all line up on the same left and right edges.
  // Stacks are flex columns, not CSS grids: an implicit grid column grows to its widest child's min-content,
  // and nowrap (truncated) text made that wider than the sidebar.
  return (
    <div className="flex h-full min-w-0 flex-col px-3 py-4" onClick={onNav}>
      <div className="flex items-center justify-between gap-2 px-3"><Logo /></div>
      <nav className="mt-6 flex flex-col gap-0.5" aria-label="Main">{MAIN.map((n) => <Item key={n.to} {...n} />)}</nav>
      <p className="mt-8 px-3 pb-2 text-xs font-medium text-faint">You</p>
      <nav className="flex flex-col gap-1" aria-label="Account"><Item to={`/u/${me.id}`} label="Profile" icon={UserRound} /><Item to="/settings" label="Settings" icon={Settings} /></nav>
      <div className="mt-auto flex flex-col gap-2 pt-4">
        <Link to="/leaderboard" className="night relative block overflow-hidden rounded-[10px] px-3 py-3 transition-colors hover:bg-[var(--night-2)]">
          <Flow className="w-full text-[#3fb0d0] opacity-40" />
          <div className="relative flex items-baseline justify-between gap-2"><span className="text-xs font-semibold">Level {level}</span><span className="num truncate text-xs text-white/70">{me.xp} / {hi} XP</span></div>
          <div className="relative mt-2 h-1.5 overflow-hidden rounded-full bg-white/15" aria-hidden><span className="block h-full w-full origin-left rounded-full bg-[#3fb0d0] transition-transform duration-300 ease-out" style={{ transform: `scaleX(${pct / 100})` }} /></div>
          <p className="relative mt-2 text-xs text-white/70">{me.rank ? `#${me.rank} on campus this term` : 'Share something to get ranked'}</p>
        </Link>
        <div className="flex items-center gap-3 rounded-md px-3 py-2 transition-colors hover:bg-hover">
          <Avatar user={me} size={28} />
          <span className="min-w-0 flex-1 leading-tight"><span className="block truncate text-sm font-medium" title={me.name}>{me.name}</span><span className="block truncate text-xs text-muted" title={me.major ? `${me.major}, year ${me.year}` : `Year ${me.year}`}>{me.major ? `${me.major}, year ${me.year}` : `Year ${me.year}`}</span></span>
          <button type="button" aria-label="Sign out" title="Sign out" onClick={(e) => { e.stopPropagation(); logout() }} className="icon-btn -mr-1"><LogOut size={16} aria-hidden /></button>
        </div>
      </div>
    </div>
  )
}

export default function Shell({ children }: { children: ReactNode }) {
  const { me } = useAuth()
  const [menu, setMenu] = useState(false); const [search, setSearch] = useState(false)
  const [dark, setDark] = useState(() => document.documentElement.classList.contains('dark'))
  const { pathname } = useLocation()
  const menuBtn = useRef<HTMLButtonElement>(null); const drawer = useRef<HTMLDivElement>(null); const lastPath = useRef(pathname)
  useEffect(() => { setMenu(false) }, [pathname])
  // After a client-side navigation, move focus to the new page so screen readers and keyboards start there.
  useEffect(() => {
    if (lastPath.current === pathname) return // first render (and StrictMode's second run)
    lastPath.current = pathname
    document.getElementById('main')?.focus({ preventScroll: true })
  }, [pathname])
  // Mobile menu: focus inside, Tab stays inside, Escape closes, focus goes back to the menu button.
  useEffect(() => {
    if (!menu) return
    drawer.current?.querySelector<HTMLElement>('button, a')?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); setMenu(false); return }
      if (e.key !== 'Tab' || !drawer.current) return
      const f = [...drawer.current.querySelectorAll<HTMLElement>('a[href], button:not([disabled])')]
      const first = f[0], last = f[f.length - 1]
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus() }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus() }
    }
    window.addEventListener('keydown', onKey)
    return () => { window.removeEventListener('keydown', onKey); if (document.activeElement === document.body) menuBtn.current?.focus() }
  }, [menu])
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
    <div className="min-h-dvh bg-shell">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[100] focus:rounded-lg focus:bg-ink focus:px-3 focus:py-2 focus:text-paper">Skip to content</a>
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 lg:block"><Sidebar /></aside>
      {/* Desktop: the page is a sheet inset 8px into the stone frame. This strip hides content scrolling above the sticky header. */}
      <div aria-hidden className="fixed right-0 top-0 z-30 hidden h-2 bg-shell lg:left-60 lg:block" />
      <div className="lg:py-2 lg:pl-60 lg:pr-2">
      <div className="min-h-dvh bg-bg lg:min-h-[calc(100dvh-16px)] lg:rounded-2xl lg:border lg:border-line lg:shadow-sheet">
        <header className="sticky top-0 z-20 border-b border-line bg-bg lg:top-2 lg:rounded-t-[17px]">
          <div className="mx-auto flex h-12 max-w-[1120px] items-center gap-2 px-4 sm:gap-3 sm:px-8">
            <button ref={menuBtn} type="button" className="icon-btn -ml-1 text-ink lg:hidden" aria-label="Open menu" aria-expanded={menu} onClick={() => setMenu(true)}><Menu size={18} aria-hidden /></button>
            <span className="flex min-w-0 items-center gap-2 text-sm"><span className="hidden text-faint sm:inline">SMUhub</span><span className="hidden text-faint sm:inline" aria-hidden>/</span><span className="min-w-0 truncate font-medium">{section}</span></span>
            <div className="ml-auto flex shrink-0 items-center gap-1 sm:gap-2">
              <button type="button" onClick={() => setSearch(true)} className="hidden h-8 w-60 items-center gap-2 rounded-sm border border-line bg-surface px-3 text-sm text-faint transition-colors hover:border-line-strong hover:text-muted md:flex"><Search size={14} aria-hidden />Search SMUhub<span className="kbd ml-auto" aria-hidden>⌘K</span></button>
              <button type="button" onClick={() => setSearch(true)} aria-label="Search" className="icon-btn md:hidden"><Search size={16} aria-hidden /></button>
              <button type="button" onClick={toggle} aria-label={dark ? 'Use light theme' : 'Use dark theme'} title={dark ? 'Light theme' : 'Dark theme'} className="icon-btn">{dark ? <Sun size={16} aria-hidden /> : <Moon size={16} aria-hidden />}</button>
              <NotificationBell />
              <NewMenu />
            </div>
          </div>
        </header>
        <main id="main" key={pathname} tabIndex={-1} className="mx-auto w-full max-w-[1120px] px-4 pb-24 pt-8 outline-none sm:px-8 sm:pt-12">{children}</main>
      </div>
      </div>
      {menu && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal aria-label="Menu">
          <div className="absolute inset-0 bg-[var(--overlay)]" style={{ animation: 'fade .15s' }} onClick={() => setMenu(false)} />
          <div ref={drawer} className="drawer absolute inset-y-0 left-0 w-[272px] border-r border-line bg-shell shadow-popover"><button type="button" aria-label="Close menu" className="icon-btn absolute right-3 top-3" onClick={() => setMenu(false)}><X size={16} aria-hidden /></button><Sidebar onNav={() => setMenu(false)} /></div>
        </div>
      )}
      <Palette open={search} onClose={() => setSearch(false)} />
    </div>
  )
}

function NewMenu() {
  const [open, setOpen] = useState(false)
  const btn = useRef<HTMLButtonElement>(null); const list = useRef<HTMLDivElement>(null)
  const nav = useNavigate(); const { pathname } = useLocation()
  useEffect(() => { setOpen(false) }, [pathname])
  useEffect(() => {
    if (!open) return
    list.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return
      const items = [...(list.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [])]
      const i = items.indexOf(document.activeElement as HTMLElement)
      if (e.key === 'Escape') { e.preventDefault(); setOpen(false); btn.current?.focus() }
      else if (e.key === 'ArrowDown') { e.preventDefault(); items[(i + 1) % items.length]?.focus() }
      else if (e.key === 'ArrowUp') { e.preventDefault(); items[(i - 1 + items.length) % items.length]?.focus() }
      else if (e.key === 'Tab') setOpen(false)
      else {
        const hit = NEW_ITEMS.find((x) => x.key === e.key.toUpperCase())
        if (hit) { e.preventDefault(); setOpen(false); nav(hit.to) }
      }
    }
    window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey)
  }, [open, nav])
  return (
    <div className="relative">
      <button ref={btn} type="button" onClick={() => setOpen(!open)} className="btn btn-primary btn-sm" aria-expanded={open} aria-haspopup="menu"><Plus size={14} aria-hidden />New</button>
      {open && (<>
        <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} aria-hidden />
        <div ref={list} role="menu" aria-label="Create" className="popover pop absolute right-0 top-10 z-20 w-64 p-1">
          {NEW_ITEMS.map(({ to, icon: Icon, label, key }) => (
            <Link role="menuitem" key={to} to={to} className="flex items-center gap-3 rounded-sm px-3 py-2 text-sm outline-none hover:bg-hover focus-visible:bg-hover">
              <Icon size={16} className="text-muted" aria-hidden />{label}<span className="kbd ml-auto" aria-hidden>{key}</span>
            </Link>))}
        </div></>)}
    </div>
  )
}
