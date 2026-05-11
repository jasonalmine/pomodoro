import { useMemo } from 'react'
import { fmtClock, fmtDuration } from '../lib/format'
import { ProjectChip } from './ProjectChip'
import type { Pomodoro, Project } from '../types'

export function DailyTimeline({ pomodoros, projects }: { pomodoros: Pomodoro[]; projects: Project[] }) {
  const sorted = useMemo(() => [...pomodoros].sort((a, b) => a.startedAt - b.startedAt), [pomodoros])
  const projectMap = useMemo(() => new Map(projects.map(p => [p.id, p])), [projects])

  if (sorted.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-ink-200 dark:border-ink-800 p-8 text-center text-sm text-ink-500">
        Nothing focused yet today. Start a session to see it here.
      </div>
    )
  }

  // Compute "intra-day" position as % of the 24h window for the left rail dot.
  const dayStart = new Date(sorted[0].startedAt)
  dayStart.setHours(0, 0, 0, 0)
  const dayStartMs = dayStart.getTime()
  const DAY_MS = 24 * 60 * 60 * 1000

  return (
    <ol className="relative space-y-2">
      <div className="absolute left-[7px] top-1 bottom-1 w-px bg-ink-200 dark:bg-ink-800" aria-hidden />
      {sorted.map(p => {
        const project = projectMap.get(p.projectId)
        const color = project?.color ?? '#ff6a37'
        const topPct = ((p.startedAt - dayStartMs) / DAY_MS) * 100
        return (
          <li key={p.id} className="relative pl-6">
            <span
              className="absolute left-0 top-3 h-4 w-4 rounded-full border-2 border-white dark:border-ink-950 ring-1 ring-ink-200 dark:ring-ink-800"
              style={{ backgroundColor: color }}
              title={`Started at ${topPct.toFixed(0)}% of the day`}
            />
            <div className="rounded-xl border border-ink-200 dark:border-ink-800 bg-white dark:bg-ink-900 p-3 flex items-start gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  {project && <ProjectChip project={project} />}
                  <span className="text-xs tabular text-ink-500">{fmtClock(p.startedAt)}</span>
                  <span className="text-xs tabular text-ink-400">·</span>
                  <span className="text-xs tabular text-ink-500">{fmtDuration(p.actualSeconds)}</span>
                  {!p.completed && (
                    <span className="text-[10px] uppercase tracking-wider text-rose-500">aborted</span>
                  )}
                </div>
                <div className="text-sm text-ink-800 dark:text-ink-100 mt-1 truncate">
                  {p.task || 'Focus session'}
                </div>
                {p.note && (
                  <div className="text-xs text-ink-500 mt-1 line-clamp-2">
                    {p.note}
                  </div>
                )}
              </div>
            </div>
          </li>
        )
      })}
    </ol>
  )
}
