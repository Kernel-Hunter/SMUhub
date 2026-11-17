import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { BookOpen, CornerDownLeft, HelpCircle, Megaphone, Search, CalendarDays, PackageOpen, Trophy, Home, Upload, Plus } from 'lucide-react'
import { api } from '@/api/mock'

type Item = { id: string; label: string; hint: string; to: string; icon: typeof Search }
const PAGES: Item[] = [
  { id: 'p-home', label: 'Home', hint: 'Go to', to: '/', icon: Home },
  { id: 'p-lib', label: 'Library', hint: 'Go to', to: '/resources', icon: BookOpen },
  { id: 'p-qa', label: 'Q&A', hint: 'Go to', to: '/qa', icon: HelpCircle },
  { id: 'p-voice', label: 'Campus Voice', hint: 'Go to', to: '/voice', icon: Megaphone },
  { id: 'p-ev', label: 'Events & deadlines', hint: 'Go to', to: '/events', icon: CalendarDays },
  { id: 'p-rent', label: 'Rentals', hint: 'Go to', to: '/rentals', icon: PackageOpen },
  { id: 'p-rank', label: 'Leaderboard', hint: 'Go to', to: '/leaderboard', icon: Trophy },
  { id: 'a-up', label: 'Upload a resource', hint: 'Action', to: '/resources/new', icon: Upload },
  { id: 'a-ask', label: 'Ask a question', hint: 'Action', to: '/qa/new', icon: Plus },
  { id: 'a-voice', label: 'Post to Campus Voice', hint: 'Action', to: '/voice/new', icon: Plus },
]

export default function Palette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const nav = useNavigate()
  const [q, setQ] = useState(''); const [i, setI] = useState(0)
  const ref = useRef<HTMLInputElement>(null)
  const term = q.trim()
  const res = useQuery({ queryKey: ['palette', 'res', term], queryFn: () => api.resources.list({ q: term }), enabled: open && term.length > 1 })
  const th = useQuery({ queryKey: ['palette', 'th', term], queryFn: async () => [...(await api.threads.list('question', { q: term })), ...(await api.threads.list('voice', { q: term }))], enabled: open && term.length > 1 })
  const items = useMemo<Item[]>(() => {
    const pages = PAGES.filter((p) => !term || p.label.toLowerCase().includes(term.toLowerCase()))
    const r: Item[] = (res.data ?? []).slice(0, 5).map((x) => ({ id: x.id, label: x.title, hint: x.courseCode, to: `/resources/${x.id}`, icon: BookOpen }))
    const t: Item[] = (th.data ?? []).slice(0, 5).map((x) => ({ id: x.id, label: x.title, hint: x.kind === 'question' ? 'Q&A' : 'Voice', to: `/${x.kind === 'question' ? 'qa' : 'voice'}/${x.id}`, icon: x.kind === 'question' ? HelpCircle : Megaphone }))
    return [...r, ...t, ...pages]
  }, [term, res.data, th.data])
  useEffect(() => { if (open) { setQ(''); setI(0); setTimeout(() => ref.current?.focus(), 20) } }, [open])
  useEffect(() => setI(0), [term])
  if (!open) return null
  const go = (it?: Item) => { if (!it) return; onClose(); nav(it.to) }
  return (
    <div className="fixed inset-0 z-[70] flex items-start justify-center px-4 pt-[14vh]" role="dialog" aria-modal aria-label="Search">
      <div className="absolute inset-0 bg-black/55 backdrop-blur-sm" style={{ animation: 'fade .15s' }} onClick={onClose} />
      <div className="card rise relative w-full max-w-xl overflow-hidden !bg-raised shadow-2xl" onKeyDown={(e) => {
        if (e.key === 'ArrowDown') { e.preventDefault(); setI((v) => Math.min(v + 1, items.length - 1)) }
        if (e.key === 'ArrowUp') { e.preventDefault(); setI((v) => Math.max(v - 1, 0)) }
        if (e.key === 'Enter') go(items[i])
        if (e.key === 'Escape') onClose()
      }}>
        <div className="flex items-center gap-3 border-b border-line px-4"><Search size={16} className="text-faint" />
          <input ref={ref} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search resources, questions, pages…" className="h-13 w-full bg-transparent py-4 text-[15px] outline-none focus-visible:!outline-none placeholder:text-faint" aria-label="Search" /><span className="kbd">esc</span></div>
        <ul className="max-h-[50vh] overflow-auto p-2">
          {items.length === 0 && <li className="px-3 py-8 text-center text-sm text-muted">No results for “{term}”.</li>}
          {items.map((it, n) => { const Icon = it.icon; return (
            <li key={it.id}><button onMouseMove={() => setI(n)} onClick={() => go(it)} className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm ${n === i ? 'bg-line' : ''}`}>
              <Icon size={16} className="shrink-0 text-muted" /><span className="min-w-0 flex-1 truncate">{it.label}</span><span className="text-xs text-faint">{it.hint}</span>{n === i && <CornerDownLeft size={13} className="text-faint" />}</button></li>) })}
        </ul>
      </div>
    </div>
  )
}
