import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import Flow from './Flow'

/** Section colour. Each area of the app keeps one muted hue (see .hue-* in index.css). */
export type Tone = 'blue' | 'violet' | 'orange' | 'rose' | 'green' | 'gold' | 'plum'

/**
 * Page header: a lightly tinted panel in the section's hue, with an icon tile, title,
 * context line, optional actions and metrics. Solid tint with still contour lines (Flow), no gradients.
 */
export default function Banner({ tone = 'blue', icon, label, title, sub, stats, action, children }: {
  tone?: Tone; icon: ReactNode; label: string; title: ReactNode; sub?: string
  stats?: [string, ReactNode][]; action?: ReactNode; children?: ReactNode
}) {
  return (
    <header className={cn(`hue-${tone}`, 'relative mb-8 overflow-hidden rounded-[12px] border px-6 py-6 sm:px-7')} style={{ background: 'var(--hue-tint)', borderColor: 'var(--hue-line)' }}>
      <Flow className="text-[color:var(--hue)] opacity-60" />
      <div className="relative flex flex-wrap items-end justify-between gap-6">
        <div className="flex min-w-0 max-w-2xl gap-4">
          <span className="bg-hue grid size-11 shrink-0 place-items-center rounded-[10px] [&_svg]:size-5">{icon}</span>
          <div className="min-w-0">
            <p className="text-hue text-xs font-medium">{label}</p>
            <h1 className="mt-0.5 text-2xl font-semibold">{title}</h1>
            {sub && <p className="mt-2 text-sm text-muted">{sub}</p>}
            {action && <div className="mt-4 flex flex-wrap gap-2">{action}</div>}
          </div>
        </div>
        {stats && (
          <dl className="flex flex-wrap gap-3">
            {stats.map(([l, v]) => (
              <div key={l} className="flex min-w-24 flex-col-reverse rounded-[10px] border bg-surface px-4 py-2.5 shadow-[var(--shadow-card)]" style={{ borderColor: 'var(--hue-line)' }}>
                <dt className="text-xs text-muted">{l}</dt>
                <dd className="num text-hue text-xl font-semibold">{v}</dd>
              </div>
            ))}
          </dl>
        )}
        {children}
      </div>
    </header>
  )
}

export const bannerBtn = 'btn btn-hue h-9'
export const bannerGhost = 'btn btn-secondary h-9'
