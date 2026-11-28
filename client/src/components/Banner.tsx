import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

/** Section colour. Each area of the app keeps one muted hue (see .hue-* in index.css). */
export type Tone = 'blue' | 'violet' | 'orange' | 'rose' | 'green' | 'gold' | 'plum'

/**
 * Page header: section label in its hue, a Newsreader title, context line, actions, and figures in one quiet strip.
 */
export default function Banner({ tone = 'blue', icon, label, title, sub, stats, action, children }: {
  tone?: Tone; icon: ReactNode; label: string; title: ReactNode; sub?: string
  stats?: [string, ReactNode][]; action?: ReactNode; children?: ReactNode
}) {
  return (
    <header className={cn(`hue-${tone}`, 'rise mb-10 flex flex-wrap items-end justify-between gap-x-10 gap-y-6 border-b border-line pb-8')}>
      <div className="min-w-0 max-w-2xl">
        <p className="flex items-center gap-2 text-sm font-medium text-hue"><span className="tile size-6 rounded-md [&_svg]:size-3.5" aria-hidden>{icon}</span>{label}</p>
        <h1 className="mt-4 text-[34px] leading-[40px] sm:text-[40px] sm:leading-[46px]">{title}</h1>
        {sub && <p className="mt-3 max-w-xl text-[15px] leading-6 text-muted">{sub}</p>}
        {action && <div className="mt-6 flex flex-wrap gap-2">{action}</div>}
      </div>
      {stats && (
        <dl className="grid w-full auto-cols-fr grid-flow-col divide-x divide-line rounded-xl border border-line bg-surface shadow-card sm:flex sm:w-auto">
          {stats.map(([l, v]) => (
            <div key={l} className="flex min-w-0 flex-col-reverse px-3 py-3.5 sm:min-w-28 sm:px-5">
              <dt className="text-xs text-muted [overflow-wrap:anywhere]">{l}</dt>
              <dd className="num display text-[28px] leading-8 text-heading">{v}</dd>
            </div>
          ))}
        </dl>
      )}
      {children}
    </header>
  )
}

export const bannerBtn = 'btn btn-primary h-9'
export const bannerGhost = 'btn btn-secondary h-9'
