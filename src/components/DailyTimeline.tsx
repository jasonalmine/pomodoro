import { useMemo, useState } from 'react'
import { fmtClock, fmtDuration } from '../lib/format'
import { overtimeSec } from '../lib/stats'
import { ProjectChip } from './ProjectChip'
import { SessionEditPanel } from './SessionEditPanel'
import type { Pomodoro, Project } from '../types'

export function DailyTimeline({ pomodoros, projects }: { pomodoros: Pomodoro[]; projects: Project[] }) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const sorted = useMemo(() => [...pomodoros].sort((a, b) => a.startedAt - b.startedAt), [pomodoros])
  const projectMap = useMemo(() => new Map(projects.map(p => [p.id, p])), [projects])

  if (sorted.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-ink-200 dark:border-ink-800 p-8 text-center text-sm text-ink-500">
        Nothing focused yet today. Start a session to see it here.
      </div>
    )
  }

  // Compute "intra-day" position as % of the local-day window for the left
  // rail dot. We measure against the actual ms between local midnight and the
  // next local midnight so DST-transition days (23h or 25h) report a sensible
  // percentage instead of clipping above/below the natural range.
  const dayStart = new Date(sorted[0].startedAt)
  dayStart.setHours(0, 0, 0, 0)
  const nextMidnight = new Date(dayStart)
  nextMidnight.setDate(nextMidnight.getDate() + 1)
  const dayStartMs = dayStart.getTime()
  const dayLengthMs = Math.max(1, nextMidnight.getTime() - dayStartMs)

  return (
    <>
      <ol className="relative space-y-2">
        <div className="absolute left-[7px] top-1 bottom-1 w-px bg-ink-200 dark:bg-ink-800" aria-hidden />
        {sorted.map(p => {
          const project = projectMap.get(p.projectId)
          const color = project?.color ?? '#ff6a37'
          const topPct = ((p.startedAt - dayStartMs) / dayLengthMs) * 100
          return (
            <li key={p.id} className="relative pl-6">
              <span
                className="absolute left-0 top-3 h-4 w-4 rounded-full border-2 border-white dark:border-ink-950 ring-1 ring-ink-200 dark:ring-ink-800"
                style={{ backgroundColor: color }}
                title={`Started at ${topPct.toFixed(0)}% of the day`}
              />
              <button
                type="button"
                onClick={() => setEditingId(p.id)}
                className="w-full text-left rounded-xl border border-ink-200 dark:border-ink-800 bg-white dark:bg-ink-900 p-3 flex items-start gap-3 hover:border-accent/40 transition"
                title="Click to edit this session"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    {project && <ProjectChip project={project} />}
                    <span className="text-xs tabular text-ink-500">{fmtClock(p.startedAt)}</span>
                    <span className="text-xs tabular text-ink-400">·</span>
                    <span className="text-xs tabular text-ink-500">{fmtDuration(p.actualSeconds)}</span>
                    {overtimeSec(p) > 0 && (
                      <span className="text-[10px] tabular text-accent">+{fmtDuration(overtimeSec(p))}</span>
                    )}
                    {!p.completed && (
                      <span className="text-[10px] uppercase tracking-wider text-rose-500">aborted</span>
                    )}
                    {p.flowMode && <span className="text-[10px] uppercase tracking-wider text-accent">flow</span>}
                    {p.manual && <span className="text-[10px] uppercase tracking-wider text-ink-400">manual</span>}
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
              </button>
            </li>
          )
        })}
      </ol>
      {editingId && (
        <SessionEditPanel pomodoroId={editingId} onClose={() => setEditingId(null)} />
      )}
    </>
  )
}
