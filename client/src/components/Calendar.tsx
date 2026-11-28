import { cn } from '@/lib/utils'

/** Month grid with a dot on days that have events. */
export default function Calendar({ days, size = 'sm', selected, onSelect }: { days: Map<number, string>; size?: 'sm' | 'lg'; selected?: number; onSelect?: (d: number) => void }) {
  const now = new Date(), y = now.getFullYear(), m = now.getMonth()
  const first = (new Date(y, m, 1).getDay() + 6) % 7, total = new Date(y, m + 1, 0).getDate()
  const cells = [...Array(first).fill(0), ...Array.from({ length: total }, (_, i) => i + 1)]
  const lg = size === 'lg'
  return (
    <div className={cn('grid grid-cols-7 text-center', lg ? 'gap-2 text-sm' : 'gap-y-1 text-xs')}>
      {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => <span key={d} className="pb-1 font-medium text-faint">{lg ? d : d[0]}</span>)}
      {cells.map((d, i) => {
        const kind = d ? days.get(d) : undefined, today = d === now.getDate(), past = d && d < now.getDate()
        const Tag = onSelect && d ? 'button' : 'span'
        return (
          <span key={i} className="grid place-items-center">
            <Tag {...(Tag === 'button' ? { type: 'button' as const, onClick: () => onSelect!(d) } : {})}
              className={cn('num relative grid place-items-center rounded-full transition-colors', lg ? 'size-10' : 'size-7',
                today ? 'bg-accent-fill font-semibold text-on-accent' : selected === d ? 'bg-ink text-paper' : d ? 'hover:bg-hover' : '', past && !today && 'text-faint')}>
              {d || ''}{kind && !today && <span className={cn('absolute bottom-1 size-1 rounded-full', kind === 'deadline' ? 'bg-danger' : kind === 'club' ? 'bg-faint' : 'bg-accent')} />}
            </Tag>
          </span>)
      })}
    </div>
  )
}
