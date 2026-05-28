import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { format } from 'date-fns'
import { X } from 'lucide-react'
import { db } from '../db'
import { Button } from './Button'
import { ProjectChip } from './ProjectChip'
import { SessionEditPanel } from './SessionEditPanel'
import { fmtClock, fmtDuration } from '../lib/format'
import type { Pomodoro } from '../types'

// Drill-in view for a single Task: total focus time, session count, and the
// full list of linked Pomodoros. Tap any session to open the SessionEditPanel.
export function TaskDetailPanel({ taskId, onClose }: { taskId: string; onClose: () => void }) {
  const task = useLiveQuery(() => db.tasks.get(taskId), [taskId])
  const project = useLiveQuery(
    async () => (task?.projectId ? await db.projects.get(task.projectId) : undefined),
    [task?.projectId],
  )
  const sessions = useLiveQuery(
    () => db.pomodoros.where('taskId').equals(taskId).toArray(),
    [taskId],
    [] as Pomodoro[],
  )
  const liveSessions = (sessions ?? []).filter(p => !p.deletedAt)
  const sorted = useMemo(
    () => [...liveSessions].sort((a, b) => b.startedAt - a.startedAt),
    [liveSessions],
  )
  const totals = useMemo(() => {
    let seconds = 0
    let count = 0
    for (const p of liveSessions) {
      seconds += p.actualSeconds
      count += 1
    }
    return { seconds, count }
  }, [liveSessions])

  const [editingId, setEditingId] = useState<string | null>(null)

  const toggleComplete = async () => {
    if (!task) return
    const now = Date.now()
    await db.tasks.update(task.id, {
      completed: !task.completed,
      completedAt: !task.completed ? now : undefined,
      updatedAt: now,
    })
  }

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div
        className="relative w-full max-w-lg rounded-2xl bg-white dark:bg-ink-900 border border-ink-200 dark:border-ink-800 p-6 sm:p-7 space-y-5 max-h-[calc(100vh-2rem)] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute top-3 right-3 h-8 w-8 rounded-full flex items-center justify-center text-ink-400 hover:text-ink-800 dark:hover:text-ink-100 hover:bg-ink-100 dark:hover:bg-ink-800 transition"
        >
          <X size={16} />
        </button>

        {!task && <p className="text-sm text-ink-500 text-center py-6">Couldn't find that task.</p>}

        {task && (
          <>
            <header className="space-y-2">
              <div className="text-[11px] uppercase tracking-[0.22em] text-accent">Task</div>
              <h2 className="font-display text-2xl text-ink-900 dark:text-ink-50 leading-snug">
                {task.completed && <span className="line-through text-ink-400">{task.name}</span>}
                {!task.completed && task.name}
              </h2>
              <div className="flex flex-wrap items-center gap-2 text-xs text-ink-500">
                {project && <ProjectChip project={project} />}
                <span className="tabular">{totals.count} of {task.estPomodoros} planned</span>
                <span className="text-ink-300">·</span>
                <span className="tabular">{fmtDuration(totals.seconds)} focused</span>
              </div>
            </header>

            <div>
              <Button
                size="sm"
                variant={task.completed ? 'secondary' : 'primary'}
                onClick={() => void toggleComplete()}
              >
                {task.completed ? 'Reopen task' : 'Mark complete'}
              </Button>
            </div>

            <section className="space-y-2">
              <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-ink-400">
                Sessions ({totals.count})
              </div>
              {sorted.length === 0 ? (
                <div className="rounded-xl border border-dashed border-ink-200 dark:border-ink-800 p-6 text-center text-xs text-ink-500">
                  No sessions logged against this task yet.
                </div>
              ) : (
                <ol className="space-y-1.5">
                  {sorted.map(p => (
                    <li key={p.id}>
                      <button
                        type="button"
                        onClick={() => setEditingId(p.id)}
                        className="w-full text-left rounded-xl border border-ink-200 dark:border-ink-800 bg-white dark:bg-ink-900 px-3 py-2.5 flex items-center gap-3 hover:border-accent/40 transition"
                      >
                        <div
                          className="w-1 self-stretch rounded-full shrink-0"
                          style={{ backgroundColor: project?.color ?? '#ff6a37' }}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 text-xs tabular text-ink-500">
                            <span>{format(p.startedAt, 'EEE, MMM d')}</span>
                            <span className="text-ink-300">·</span>
                            <span>{fmtClock(p.startedAt)}</span>
                            <span className="text-ink-300">·</span>
                            <span>{fmtDuration(p.actualSeconds)}</span>
                            {!p.completed && <span className="text-[10px] uppercase tracking-wider text-rose-500">aborted</span>}
                            {p.flowMode && <span className="text-[10px] uppercase tracking-wider text-accent">flow</span>}
                            {p.manual && <span className="text-[10px] uppercase tracking-wider text-ink-400">manual</span>}
                          </div>
                          {p.note && (
                            <div className="text-xs text-ink-500 mt-1 line-clamp-2">{p.note}</div>
                          )}
                        </div>
                      </button>
                    </li>
                  ))}
                </ol>
              )}
            </section>
          </>
        )}
      </div>
      {editingId && (
        <SessionEditPanel pomodoroId={editingId} onClose={() => setEditingId(null)} />
      )}
    </div>
  )
}
