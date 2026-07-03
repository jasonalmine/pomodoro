import { format } from 'date-fns'
import { fmtDuration } from '../lib/format'
import type { WeeklyTotal } from '../lib/stats'

// Slim per-week bars, oldest first; the current (last) week is accented.
export function WeekTrend({ weeks }: { weeks: WeeklyTotal[] }) {
  const max = Math.max(...weeks.map(w => w.seconds), 60)
  return (
    <div className="flex items-end justify-between gap-2 h-24">
      {weeks.map((w, i) => {
        const isCurrent = i === weeks.length - 1
        return (
          <div
            key={w.weekStart.getTime()}
            className="flex-1 h-full flex flex-col items-center justify-end gap-1.5 min-w-0"
            title={`Week of ${format(w.weekStart, 'MMM d')} · ${w.seconds > 0 ? `${fmtDuration(w.seconds)} · ${w.count} session${w.count === 1 ? '' : 's'}` : 'nothing'}`}
          >
            <div className="w-full h-full flex flex-col justify-end">
              <div
                className={`w-full rounded-md ${
                  w.seconds > 0
                    ? isCurrent ? 'bg-accent' : 'bg-accent/35'
                    : 'bg-ink-100 dark:bg-ink-800'
                }`}
                style={{ height: w.seconds > 0 ? `${Math.max((w.seconds / max) * 100, 5)}%` : 2, transition: 'height 400ms ease-out' }}
              />
            </div>
            <div className={`text-[10px] uppercase tracking-wider ${isCurrent ? 'text-accent font-semibold' : 'text-ink-400'}`}>
              {format(w.weekStart, 'MMM d')}
            </div>
          </div>
        )
      })}
    </div>
  )
}
