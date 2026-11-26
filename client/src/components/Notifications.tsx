import { useEffect, useId, useRef, useState, type FocusEvent } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Bell, X } from 'lucide-react'
import { api } from '@/api/client'
import type { AppNotification } from '@/api/types'
import { cn, errMsg, timeAgo } from '@/lib/utils'
import { Skeleton, useToast } from './ui'

const KEY = ['notifications']
type Data = { notifications: AppNotification[]; unread: number }

/**
 * Bell in the top bar (US-23): unread badge, polled every 15 s and on window focus, and a panel with the newest 30.
 * Opening one marks it read. Escape or a click outside closes the panel and focus returns to the bell.
 */
export default function NotificationBell() {
  const qc = useQueryClient()
  const toast = useToast()
  const [open, setOpen] = useState(false)
  const bell = useRef<HTMLButtonElement>(null)
  const panel = useRef<HTMLDivElement>(null)
  const titleId = useId()
  const { pathname } = useLocation()

  const q = useQuery({ queryKey: KEY, queryFn: api.notifications.list, refetchInterval: 15_000, refetchOnWindowFocus: true })
  const unread = q.data?.unread ?? 0
  const list = q.data?.notifications ?? []

  // Optimistic: the dot and the badge change at once, the server's answer corrects the count.
  const patch = (fn: (d: Data) => Data) => qc.setQueryData<Data>(KEY, (d) => (d ? fn(d) : d))
  const fail = (e: unknown) => { toast(errMsg(e), 'err'); void qc.invalidateQueries({ queryKey: KEY }) }
  const read = useMutation({
    mutationFn: (ids?: string[]) => api.notifications.read(ids),
    onMutate: (ids) => patch((d) => {
      const hit = (n: AppNotification) => !n.read && (!ids || ids.includes(n.id))
      return { notifications: d.notifications.map((n) => (hit(n) ? { ...n, read: true } : n)), unread: Math.max(0, d.unread - d.notifications.filter(hit).length) }
    }),
    onSuccess: (count) => patch((d) => ({ ...d, unread: count })),
    onError: fail,
  })
  const remove = useMutation({
    mutationFn: (id: string) => api.notifications.remove(id),
    onMutate: (id) => patch((d) => {
      const gone = d.notifications.find((n) => n.id === id)
      return { notifications: d.notifications.filter((n) => n.id !== id), unread: Math.max(0, d.unread - (gone && !gone.read ? 1 : 0)) }
    }),
    onError: fail,
    onSettled: () => qc.invalidateQueries({ queryKey: KEY }),
  })

  const close = (refocus: boolean) => { setOpen(false); if (refocus) bell.current?.focus() }
  useEffect(() => { setOpen(false) }, [pathname])
  useEffect(() => {
    if (!open) return
    panel.current?.focus()
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.preventDefault(); setOpen(false); bell.current?.focus() } }
    window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k)
  }, [open])
  // Tabbing out of the panel closes it, like a click outside.
  const onBlur = (e: FocusEvent) => { const to = e.relatedTarget as Node | null; if (to && !panel.current?.contains(to) && to !== bell.current) close(false) }

  const toggle = () => {
    if (!open) void qc.invalidateQueries({ queryKey: KEY })
    setOpen(!open)
  }

  return (
    <div className="relative">
      <button ref={bell} type="button" onClick={toggle} aria-label={unread ? `Notifications, ${unread} unread` : 'Notifications'} title="Notifications"
        aria-expanded={open} aria-haspopup="dialog" className="relative grid size-8 place-items-center rounded-sm text-muted transition hover:bg-hover hover:text-ink">
        <Bell size={16} />
        {unread > 0 && <span aria-hidden className="num absolute -right-1 -top-1 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-accent-fill px-1 text-xs font-semibold leading-none text-on-accent ring-2 ring-bg">{unread > 99 ? '99+' : unread}</span>}
      </button>
      {open && (<>
        <div className="fixed inset-0 z-10" onClick={() => close(false)} aria-hidden />
        <div ref={panel} role="dialog" aria-labelledby={titleId} tabIndex={-1} onBlur={onBlur}
          className="popover fixed inset-x-4 top-14 z-20 flex max-h-[min(32rem,calc(100dvh-5rem))] flex-col overflow-hidden focus:outline-none sm:absolute sm:inset-x-auto sm:right-0 sm:top-10 sm:w-96" style={{ animation: 'rise .16s ease-out' }}>
          <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
            <h2 id={titleId} className="text-sm font-semibold">Notifications</h2>
            {unread > 0 && <button type="button" onClick={() => read.mutate(undefined)} className="rounded-sm text-xs font-medium text-accent hover:underline">Mark all as read</button>}
          </div>
          {q.isPending ? <div className="p-3"><Skeleton rows={3} className="h-12" /></div>
            : q.isError && !q.data ? <p role="alert" className="px-4 py-6 text-sm text-muted">Could not load your notifications. Try again in a moment.</p>
            : list.length === 0 ? <p className="px-6 py-10 text-center text-sm text-muted">Nothing new. Answers to your questions and course news show up here.</p>
            : (
              <ul className="overflow-y-auto py-1">
                {list.map((n) => (
                  <li key={n.id} className="group relative">
                    <Link to={n.link} onClick={() => { if (!n.read) read.mutate([n.id]); close(false) }} className="flex gap-3 py-2.5 pl-4 pr-11 transition-colors hover:bg-hover focus-visible:bg-hover">
                      <span aria-hidden className={cn('mt-1.5 size-2 shrink-0 rounded-full', n.read ? 'bg-transparent' : 'bg-accent-fill')} />
                      <span className="min-w-0 flex-1">
                        <span className={cn('block text-sm', n.read ? 'text-muted' : 'font-medium text-ink')}>{n.title}{!n.read && <span className="sr-only"> (unread)</span>}</span>
                        {n.body && <span className="mt-0.5 block truncate text-xs text-muted">{n.body}</span>}
                        <span className="mt-0.5 block text-xs text-faint">{timeAgo(n.createdAt)}</span>
                      </span>
                    </Link>
                    <button type="button" aria-label={`Dismiss: ${n.title}`} title="Dismiss" onClick={() => { remove.mutate(n.id); panel.current?.focus() }}
                      className="absolute right-2 top-2 grid size-7 place-items-center rounded-sm text-faint transition hover:bg-surface hover:text-ink focus-visible:opacity-100 sm:opacity-0 sm:group-hover:opacity-100"><X size={14} /></button>
                  </li>
                ))}
              </ul>
            )}
        </div>
      </>)}
    </div>
  )
}
