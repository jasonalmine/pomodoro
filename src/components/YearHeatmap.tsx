import { format } from 'date-fns'
import { fmtDuration } from '../lib/format'

type Cell = { date: Date; key: string; seconds: number; count: number }

export function YearHeatmap({ cells }: { cells: Cell[] }) {
  if (cells.length === 0) return null

  // Group cells into weeks (columns), Sunday=0 on top.
  const firstDay = cells[0].date
  // Pad with empty cells so the first week starts on Sunday.
  const padLeading = firstDay.getDay()
  const padded: Array<Cell | null> = [
    ...Array.from({ length: padLeading }, () => null),
    ...cells,
  ]
  const weeks: Array<Array<Cell | null>> = []
  for (let i = 0; i < padded.length; i += 7) {
    weeks.push(padded.slice(i, i + 7))
  }

  // Compute intensity buckets via quantiles of non-zero days.
  const nonZero = cells.map(c => c.seconds).filter(s => s > 0).sort((a, b) => a - b)
  const q = (p: number) => nonZero.length ? nonZero[Math.floor(nonZero.length * p)] : 0
  const t1 = q(0.25)
  const t2 = q(0.5)
  const t3 = q(0.75)

  function intensity(secs: number): number {
    if (secs === 0) return 0
    if (secs <= t1) return 1
    if (secs <= t2) return 2
    if (secs <= t3) return 3
    return 4
  }

  // Month labels — show label above the first week of each month.
  const monthLabels: Array<{ col: number; label: string }> = []
  let lastMonth = -1
  weeks.forEach((week, col) => {
    const firstActual = week.find(c => c != null) as Cell | undefined
    if (!firstActual) return
    const m = firstActual.date.getMonth()
    if (m !== lastMonth) {
      monthLabels.push({ col, label: format(firstActual.date, 'MMM') })
      lastMonth = m
    }
  })

  const days = ['', 'Mon', '', 'Wed', '', 'Fri', '']

  return (
    <div className="overflow-x-auto">
      <div className="inline-block">
        {/* month labels row */}
        <div className="flex pl-7 mb-1 text-[10px] text-ink-400 tabular">
          {weeks.map((_, col) => {
            const lbl = monthLabels.find(m => m.col === col)
            return (
              <div key={col} className="w-3 mr-0.5 text-left">
                {lbl ? <span className="-translate-x-0.5 inline-block">{lbl.label}</span> : null}
              </div>
            )
          })}
        </div>
        <div className="flex gap-0.5">
          {/* day-of-week labels */}
          <div className="flex flex-col gap-0.5 mr-1 text-[10px] text-ink-400 tabular">
            {days.map((d, i) => (
              <div key={i} className="h-3 leading-3 w-5 text-right">{d}</div>
            ))}
          </div>
          {weeks.map((week, col) => (
            <div key={col} className="flex flex-col gap-0.5">
              {Array.from({ length: 7 }, (_, row) => {
                const cell = week[row]
                if (!cell) return <div key={row} className="h-3 w-3" />
                const level = intensity(cell.seconds)
                const cls =
                  level === 0 ? 'bg-ink-100 dark:bg-ink-800' :
                  level === 1 ? 'bg-accent/30' :
                  level === 2 ? 'bg-accent/55' :
                  level === 3 ? 'bg-accent/80' :
                  'bg-accent'
                return (
                  <div
                    key={row}
                    title={`${format(cell.date, 'EEE, MMM d')} · ${cell.count ? fmtDuration(cell.seconds) + ' · ' + cell.count + ' session' + (cell.count === 1 ? '' : 's') : 'no focus'}`}
                    className={`h-3 w-3 rounded-sm ${cls}`}
                  />
                )
              })}
            </div>
          ))}
        </div>
        <div className="flex items-center gap-1.5 mt-2 text-[10px] text-ink-400">
          <span>less</span>
          <div className="h-3 w-3 rounded-sm bg-ink-100 dark:bg-ink-800" />
          <div className="h-3 w-3 rounded-sm bg-accent/30" />
          <div className="h-3 w-3 rounded-sm bg-accent/55" />
          <div className="h-3 w-3 rounded-sm bg-accent/80" />
          <div className="h-3 w-3 rounded-sm bg-accent" />
          <span>more</span>
        </div>
      </div>
    </div>
  )
}
