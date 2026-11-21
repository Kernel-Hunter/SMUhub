import type { ReactNode } from 'react'

/** @deprecated Kept so existing call sites compile; page headers no longer use colour. */
export type Tone = 'blue' | 'violet' | 'orange' | 'rose' | 'green' | 'gold'

/**
 * Page header: small section label, title, grey context line, optional actions and metrics.
 * Sober on purpose: no background colour, separated from the content by a 1px rule.
 */
export default function Banner({ icon, label, title, sub, stats, action, children }: {
  tone?: Tone; icon: ReactNode; label: string; title: ReactNode; sub?: string
  stats?: [string, ReactNode][]; action?: ReactNode; children?: ReactNode
}) {
  return (
    <header className="mb-8 border-b border-line pb-6">
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div className="min-w-0 max-w-2xl">
          <p className="flex items-center gap-2 text-xs font-medium text-muted"><span className="text-faint" aria-hidden>{icon}</span>{label}</p>
          <h1 className="mt-1 text-2xl font-semibold">{title}</h1>
          {sub && <p className="mt-2 text-sm text-muted">{sub}</p>}
          {action && <div className="mt-4 flex flex-wrap gap-2">{action}</div>}
        </div>
        {stats && (
          <dl className="flex flex-wrap gap-3">
            {stats.map(([l, v]) => (
              <div key={l} className="flex min-w-24 flex-col-reverse rounded-md border border-line bg-surface px-4 py-2">
                <dt className="text-xs text-muted">{l}</dt>
                <dd className="num text-lg font-semibold text-heading">{v}</dd>
              </div>
            ))}
          </dl>
        )}
        {children}
      </div>
    </header>
  )
}

export const bannerBtn = 'btn btn-primary h-9'
export const bannerGhost = 'btn btn-secondary h-9'
