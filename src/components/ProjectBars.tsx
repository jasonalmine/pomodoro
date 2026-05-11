import { fmtDuration } from '../lib/format'
import type { ProjectTotal } from '../lib/stats'

export function ProjectBars({ totals, max }: { totals: ProjectTotal[]; max?: number }) {
  if (totals.length === 0) {
    return <div className="text-sm text-ink-500 py-6 text-center">No focus time in this window yet.</div>
  }
  const top = max ?? Math.max(...totals.map(t => t.seconds), 1)
  return (
    <ol className="space-y-2.5">
      {totals.map(t => {
        const pct = (t.seconds / top) * 100
        return (
          <li key={t.project.id} className="flex items-center gap-3">
            <div className="w-28 sm:w-36 shrink-0 text-sm font-medium truncate" style={{ color: t.project.color }}>
              {t.project.name}
            </div>
            <div className="flex-1 h-3 rounded-full bg-ink-100 dark:bg-ink-800 overflow-hidden">
              <div
                className="h-full rounded-full"
                style={{ width: `${pct}%`, backgroundColor: t.project.color, transition: 'width 400ms ease-out' }}
              />
            </div>
            <div className="w-16 text-right text-xs tabular text-ink-500">{fmtDuration(t.seconds)}</div>
          </li>
        )
      })}
    </ol>
  )
}
