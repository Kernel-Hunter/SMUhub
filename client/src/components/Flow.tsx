import { cn } from '@/lib/utils'

/** A smooth sine line built from quadratic curves, from x=0 to at least `width`. */
function wave(y: number, amp: number, period: number, width = 600 + period) {
  const half = period / 2
  let d = `M0 ${y} Q${half / 2} ${y - amp} ${half} ${y}`
  for (let x = period; x <= width; x += half) d += ` T${x} ${y}`
  return d
}

const LINES = [
  { y: 46, amp: 14, period: 240, op: 0.55 },
  { y: 70, amp: 22, period: 300, op: 0.35 },
  { y: 92, amp: 12, period: 200, op: 0.7 },
  { y: 116, amp: 26, period: 340, op: 0.3 },
  { y: 138, amp: 16, period: 260, op: 0.5 },
  { y: 160, amp: 20, period: 320, op: 0.25 },
]

/** Still contour lines in the current text colour, behind header content, fading out at both ends. */
export default function Flow({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 600 200" preserveAspectRatio="none" aria-hidden
      className={cn('pointer-events-none absolute inset-y-0 right-0 h-full w-[75%] [mask-image:linear-gradient(90deg,transparent,#000_40%,#000_85%,transparent)]', className)}>
      {LINES.map((l, i) => (
        <path key={i} d={wave(l.y, l.amp, l.period)} fill="none" stroke="currentColor" strokeWidth={1.25} strokeOpacity={l.op} vectorEffect="non-scaling-stroke" strokeLinecap="round" />
      ))}
    </svg>
  )
}
