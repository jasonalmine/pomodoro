import { fmtDuration } from '../lib/format'

const HOUR_LABELS: Record<number, string> = { 6: '6a', 12: '12p', 18: '6p' }

function hourTitle(h: number): string {
  const ampm = h < 12 ? 'am' : 'pm'
  const display = h % 12 === 0 ? 12 : h % 12
  return `${display}${ampm}`
}

// 24 thin columns of focused seconds by start hour.
export function HourBars({ seconds }: { seconds: number[] }) {
  const max = Math.max(...seconds, 60)
  return (
    <div>
      <div className="flex items-end justify-between gap-1 h-24">
        {seconds.map((sec, h) => (
          <div
            key={h}
            className="flex-1 h-full flex flex-col justify-end"
            title={`${hourTitle(h)} · ${sec > 0 ? fmtDuration(sec) : 'nothing'}`}
          >
            <div
              className={`w-full rounded-sm ${sec > 0 ? 'bg-accent' : 'bg-ink-100 dark:bg-ink-800'}`}
              style={{ height: sec > 0 ? `${Math.max((sec / max) * 100, 4)}%` : 2, transition: 'height 400ms ease-out' }}
            />
          </div>
        ))}
      </div>
      <div className="flex justify-between gap-1 mt-1.5">
        {seconds.map((_, h) => (
          <div key={h} className="flex-1 text-center text-[10px] uppercase tracking-wider text-ink-400">
            {HOUR_LABELS[h] ?? ''}
          </div>
        ))}
      </div>
    </div>
  )
}
