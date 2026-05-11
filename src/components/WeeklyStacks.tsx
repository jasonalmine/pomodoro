import { useMemo } from 'react'
import { format, isSameDay } from 'date-fns'
import { fmtDuration } from '../lib/format'
import type { Pomodoro, Project } from '../types'

export function WeeklyStacks({
  pomodoros,
  projects,
  weekDays,
}: {
  pomodoros: Pomodoro[]
  projects: Project[]
  weekDays: Date[]
}) {
  const projectMap = useMemo(() => new Map(projects.map(p => [p.id, p])), [projects])

  // Bucket Pomodoros per day, sort each by startedAt.
  const buckets = useMemo(() => {
    const m = new Map<string, Pomodoro[]>()
    for (const d of weekDays) m.set(format(d, 'yyyy-MM-dd'), [])
    for (const p of pomodoros) {
      const key = format(new Date(p.startedAt), 'yyyy-MM-dd')
      m.get(key)?.push(p)
    }
    for (const arr of m.values()) arr.sort((a, b) => a.startedAt - b.startedAt)
    return m
  }, [pomodoros, weekDays])

  // Max daily total (in seconds) — used to size every day's column relative to the heaviest day.
  const maxDaySec = useMemo(() => {
    let max = 0
    for (const arr of buckets.values()) {
      const sum = arr.reduce((a, p) => a + p.actualSeconds, 0)
      if (sum > max) max = sum
    }
    return Math.max(max, 60) // at least 1m so a tiny session is visible
  }, [buckets])

  const today = new Date()

  return (
    <div className="flex items-end justify-between gap-2 h-44">
      {weekDays.map(day => {
        const key = format(day, 'yyyy-MM-dd')
        const items = buckets.get(key) ?? []
        const dayTotal = items.reduce((a, p) => a + p.actualSeconds, 0)
        const colHeightPct = (dayTotal / maxDaySec) * 100
        const isToday = isSameDay(day, today)

        return (
          <div key={key} className="flex-1 flex flex-col items-center justify-end gap-1.5 min-w-0">
            <div className="w-full h-full flex flex-col justify-end relative">
              {/* Stacked segments */}
              {items.length > 0 ? (
                <div
                  className="w-full flex flex-col-reverse gap-0.5 rounded-md overflow-hidden"
                  style={{ height: `${Math.max(colHeightPct, 6)}%`, transition: 'height 400ms ease-out' }}
                >
                  {items.map(p => {
                    const project = projectMap.get(p.projectId)
                    const segPct = (p.actualSeconds / dayTotal) * 100
                    return (
                      <div
                        key={p.id}
                        className="w-full"
                        style={{
                          flexBasis: `${segPct}%`,
                          backgroundColor: project?.color ?? '#ff6a37',
                          opacity: p.completed ? 1 : 0.55,
                          minHeight: 2,
                        }}
                        title={`${project?.name ?? 'Unknown'} · ${fmtDuration(p.actualSeconds)} at ${format(new Date(p.startedAt), 'h:mm a')}${p.completed ? '' : ' (aborted)'}`}
                      />
                    )
                  })}
                </div>
              ) : (
                <div className="w-full h-px" />
              )}
            </div>
            <div className={`text-[10px] uppercase tracking-wider ${isToday ? 'text-ember-500 font-semibold' : 'text-ink-400'}`}>
              {format(day, 'EEE')}
            </div>
            <div className="text-[10px] tabular text-ink-500">
              {dayTotal > 0 ? fmtDuration(dayTotal) : '—'}
            </div>
          </div>
        )
      })}
    </div>
  )
}
