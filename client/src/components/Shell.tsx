import { useState, type ReactNode } from 'react'
import { NavLink, Link, useLocation } from 'react-router-dom'
import { BookOpen, CalendarDays, HelpCircle, Home, Megaphone, Menu, PackageOpen, Settings, Trophy, X, LogOut, Flame } from 'lucide-react'
import { useAuth } from '@/auth/AuthContext'
import { Avatar } from './ui'
import { cn } from '@/lib/utils'

const NAV = [
  { to: '/', label: 'Home', icon: Home, end: true },
  { to: '/resources', label: 'Resources', icon: BookOpen },
  { to: '/qa', label: 'Q&A', icon: HelpCircle },
  { to: '/voice', label: 'Campus Voice', icon: Megaphone },
  { to: '/events', label: 'Events', icon: CalendarDays },
  { to: '/rentals', label: 'Rentals', icon: PackageOpen },
  { to: '/leaderboard', label: 'Leaderboard', icon: Trophy },
]

export function Logo() {
  return (
    <Link to="/" className="flex items-center gap-2.5">
      <span className="grid size-9 place-items-center rounded-xl bg-ink"><svg viewBox="0 0 64 64" className="size-6"><path d="M14 40c0-6 4-8 10-9s9-2 9-5-3-4-6-4-6 1-8 4l-5-5c3-5 8-7 14-7 8 0 14 4 14 11 0 6-4 9-11 10-5 1-8 2-8 4s2 3 6 3c5 0 8-2 10-5l5 5c-3 5-9 8-16 8-9 0-14-4-14-9Z" fill="#ff5a1f" /></svg></span>
      <span className="display text-2xl font-semibold tracking-tight">SMU<span className="text-accent">hub</span></span>
    </Link>
  )
}

function NavList({ onNav }: { onNav?: () => void }) {
  return (
    <nav className="grid gap-1">
      {NAV.map(({ to, label, icon: Icon, end }) => (
        <NavLink key={to} to={to} end={end} onClick={onNav}
          className={({ isActive }) => cn('flex items-center gap-3 rounded-xl px-3 py-2.5 text-[15px] font-medium transition', isActive ? 'bg-ink text-paper' : 'text-muted hover:bg-surface hover:text-ink')}>
          <Icon size={18} />{label}
        </NavLink>
      ))}
    </nav>
  )
}

function Side({ onNav }: { onNav?: () => void }) {
  const { me, logout } = useAuth()
  if (!me) return null
  return (
    <div className="flex h-full flex-col gap-6 p-5">
      <Logo />
      <NavList onNav={onNav} />
      <div className="mt-auto grid gap-3">
        <Link to="/leaderboard" onClick={onNav} className="card p-4 transition hover:border-ink">
          <div className="flex items-center justify-between"><span className="eyebrow">Your XP</span><Flame size={15} className="text-accent" /></div>
          <p className="display num mt-1 text-3xl">{me.xp.toLocaleString()}</p>
          <p className="text-xs text-muted">{me.rank ? `Rank #${me.rank} on campus` : 'Upload to get ranked'} · +{me.weeklyXp} this week</p>
        </Link>
        <div className="flex items-center gap-3 rounded-xl p-1">
          <Link to={`/u/${me.id}`} onClick={onNav} className="flex min-w-0 flex-1 items-center gap-3"><Avatar user={me} size={36} />
            <span className="min-w-0"><span className="block truncate text-sm font-semibold">{me.name}</span><span className="block truncate text-xs text-muted">{me.major} · Y{me.year}</span></span></Link>
          <Link to="/settings" onClick={onNav} aria-label="Settings" className="btn btn-ghost btn-sm !px-2"><Settings size={16} /></Link>
          <button aria-label="Sign out" className="btn btn-ghost btn-sm !px-2" onClick={() => logout()}><LogOut size={16} /></button>
        </div>
      </div>
    </div>
  )
}

export default function Shell({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false)
  const { pathname } = useLocation()
  return (
    <div className="grain min-h-dvh">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-line bg-paper lg:block"><Side /></aside>
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-line bg-paper/85 px-4 backdrop-blur lg:hidden">
        <Logo />
        <button aria-label="Open menu" className="btn btn-ghost btn-sm !px-2" onClick={() => setOpen(true)}><Menu size={18} /></button>
      </header>
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal>
          <div className="absolute inset-0 bg-ink/50" onClick={() => setOpen(false)} />
          <div className="rise absolute inset-y-0 left-0 w-72 bg-paper shadow-2xl">
            <button aria-label="Close menu" className="btn btn-ghost btn-sm absolute right-3 top-3 !px-2" onClick={() => setOpen(false)}><X size={16} /></button>
            <Side onNav={() => setOpen(false)} />
          </div>
        </div>
      )}
      <main key={pathname} className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-8 lg:ml-64 lg:max-w-none lg:px-12 lg:py-12"><div className="mx-auto max-w-5xl">{children}</div></main>
    </div>
  )
}
