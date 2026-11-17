import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

export type Tone = 'blue' | 'violet' | 'orange' | 'rose' | 'green' | 'gold'
export const TONE_SHADOW: Record<Tone, string> = { blue: '#3b5bff', violet: '#7b5cf5', orange: '#f2711c', rose: '#e0466f', green: '#14946c', gold: '#e69a12' }

/** Coloured page header. Each area of the app has its own tone. */
export default function Banner({ tone, icon, label, title, sub, stats, action, children }: {
  tone: Tone; icon: ReactNode; label: string; title: ReactNode; sub?: string
  stats?: [string, ReactNode][]; action?: ReactNode; children?: ReactNode
}) {
  return (
    <section className={cn(`tone-${tone}`, 'relative mb-7 overflow-hidden rounded-[22px] px-6 py-7 text-white sm:px-8')} style={{ boxShadow: `0 22px 44px -26px ${TONE_SHADOW[tone]}` }}>
      <div className="dots-light pointer-events-none absolute inset-0 opacity-60 [mask-image:linear-gradient(90deg,transparent_30%,#000)]" aria-hidden />
      <div className="pointer-events-none absolute -right-20 -top-28 size-80 rounded-full bg-white/10 blur-2xl" aria-hidden />
      <div className="relative flex flex-wrap items-end justify-between gap-6">
        <div className="min-w-0 max-w-xl">
          <p className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-1 text-[12px] font-medium ring-1 ring-white/20">{icon}{label}</p>
          <h1 className="mt-3 text-[1.85rem] font-semibold leading-tight tracking-[-0.025em] sm:text-[2.1rem]">{title}</h1>
          {sub && <p className="mt-1.5 text-[14px] text-white/80">{sub}</p>}
          {action && <div className="mt-5 flex flex-wrap gap-2.5">{action}</div>}
        </div>
        {stats && (
          <div className="flex gap-2.5">
            {stats.map(([l, v]) => (
              <div key={l} className="min-w-[92px] rounded-[14px] bg-white/12 px-4 py-3 ring-1 ring-white/20 backdrop-blur-md">
                <p className="text-[22px] font-semibold leading-none tracking-[-0.02em]">{v}</p>
                <p className="mt-1.5 text-[11.5px] text-white/75">{l}</p>
              </div>
            ))}
          </div>
        )}
        {children}
      </div>
    </section>
  )
}

export const bannerBtn = 'btn h-10 bg-white px-4 text-[#161a26] shadow-[0_6px_16px_-6px_rgb(0_0_0/.35)] hover:bg-white/90'
export const bannerGhost = 'btn h-10 bg-white/12 px-4 text-white ring-1 ring-white/25 hover:bg-white/20'
