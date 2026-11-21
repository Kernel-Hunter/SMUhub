import { cn } from '@/lib/utils'

/** A smooth sine line built from quadratic curves, from x=0 to at least `width`. */
function wave(y: number, amp: number, period: number, width = 600 + period) {
  const half = period / 2
  let d = `M0 ${y} Q${half / 2} ${y - amp} ${half} ${y}`
  for (let x = period; x <= width; x += half) d += ` T${x} ${y}`
  return d
}

const LINES = [
  { y: 46, amp: 14, period: 240, dur: 26, op: 0.55, rev: false },
  { y: 70, amp: 22, period: 300, dur: 34, op: 0.35, rev: true },
  { y: 92, amp: 12, period: 200, dur: 22, op: 0.7, rev: false },
  { y: 116, amp: 26, period: 340, dur: 38, op: 0.3, rev: true },
  { y: 138, amp: 16, period: 260, dur: 28, op: 0.5, rev: false },
  { y: 160, amp: 20, period: 320, dur: 32, op: 0.25, rev: true },
]

/**
 * Slow, flowing contour lines in the current text colour, with one bright point travelling along them.
 * Sits behind header content and fades out at both ends. Each line scrolls exactly one period per loop,
 * so the motion never jumps. Everything stops under prefers-reduced-motion (global rule in index.css).
 */
export default function Flow({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 600 200" preserveAspectRatio="none" aria-hidden
      className={cn('pointer-events-none absolute inset-y-0 right-0 h-full w-[75%] [mask-image:linear-gradient(90deg,transparent,#000_40%,#000_85%,transparent)]', className)}>
      <style>{LINES.map((l, i) => `@keyframes flow-${i} { to { transform: translateX(-${l.period}px) } }`).join(' ')}</style>
      {LINES.map((l, i) => (
        <g key={i} style={{ animation: `flow-${i} ${l.dur}s linear infinite`, animationDirection: l.rev ? 'reverse' : 'normal' }}>
          <path d={wave(l.y, l.amp, l.period)} fill="none" stroke="currentColor" strokeWidth={1.25} strokeOpacity={l.op} vectorEffect="non-scaling-stroke" strokeLinecap="round" />
        </g>
      ))}
      <circle r="2.5" fill="currentColor">
        <animateMotion dur="11s" repeatCount="indefinite" path={wave(92, 12, 200, 600)} />
        <animate attributeName="opacity" values="0;1;1;0" keyTimes="0;.15;.85;1" dur="11s" repeatCount="indefinite" />
      </circle>
    </svg>
  )
}
