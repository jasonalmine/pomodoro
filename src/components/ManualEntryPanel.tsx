import { useEffect, useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { format } from 'date-fns'
import { X } from 'lucide-react'
import { db } from '../db'
import { Button } from './Button'
import { fmtDuration } from '../lib/format'
import { recentTasks } from '../lib/stats'
import type { Pomodoro, Project } from '../types'

export function ManualEntryPanel({ onClose, now = new Date() }: { onClose: () => void; now?: Date }) {
  const projects = useLiveQuery(() => db.projects.toArray(), [], [])
  const activeProjects: Project[] = useMemo(() => (projects ?? []).filter(p => !p.archived), [projects])
  const recent = useLiveQuery(() => db.pomodoros.orderBy('startedAt').reverse().limit(30).toArray(), [], [])
  const recentChips = useMemo(() => recentTasks(recent ?? [], 4), [recent])

  const [projectId, setProjectId] = useState('')
  const [task, setTask] = useState('')
  const [date, setDate] = useState(format(now, 'yyyy-MM-dd'))
  const [startTime, setStartTime] = useState(format(new Date(now.getTime() - 25 * 60 * 1000), 'HH:mm'))
  const [minutes, setMinutes] = useState(25)
  const [note, setNote] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (projectId) return
    if (activeProjects.length) setProjectId(activeProjects[0].id)
  }, [activeProjects, projectId])

  const startMs = useMemo(() => {
    const [h, m] = startTime.split(':').map(Number)
    const d = new Date(`${date}T00:00:00`)
    if (isNaN(d.getTime()) || isNaN(h) || isNaN(m)) return NaN
    d.setHours(h, m, 0, 0)
    return d.getTime()
  }, [date, startTime])

  const durationSec = Math.max(60, Math.round(minutes * 60))
  const endMs = Number.isNaN(startMs) ? NaN : startMs + durationSec * 1000
  const endLabel = Number.isNaN(endMs) ? '—' : format(new Date(endMs), 'HH:mm')

  const save = async () => {
    setError(null)
    if (!projectId) { setError('Pick a project.'); return }
    if (Number.isNaN(startMs)) { setError('Enter a valid date and start time.'); return }
    if (minutes < 1) { setError('Duration must be at least 1 minute.'); return }
    if (endMs > Date.now() + 60_000) { setError("That session ends in the future. Check the time."); return }
    setSaving(true)
    const ts = Date.now()
    const pomodoro: Pomodoro = {
      id: crypto.randomUUID(),
      projectId,
      task: task.trim() || 'Focus session',
      startedAt: startMs,
      endedAt: endMs,
      plannedSeconds: durationSec,
      actualSeconds: durationSec,
      completed: true,
      manual: true,
      note: note.trim() || undefined,
      ritualUsed: false,
      updatedAt: ts,
    }
    await db.pomodoros.put(pomodoro)
    setSaving(false)
    onClose()
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

        <header className="space-y-1 text-center">
          <div className="text-[11px] uppercase tracking-[0.22em] text-accent">Log a past session</div>
          <h2 className="font-display text-2xl sm:text-3xl text-ink-900 dark:text-ink-50">
            Add focus you forgot to track
          </h2>
        </header>

        {activeProjects.length > 0 ? (
          <div className="space-y-1.5">
            <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-ink-400">Project</div>
            <div className="flex flex-wrap gap-1.5">
              {activeProjects.map(p => {
                const selected = p.id === projectId
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setProjectId(p.id)}
                    className={
                      'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs transition ' +
                      (selected
                        ? 'text-white shadow-sm'
                        : 'border border-ink-200 dark:border-ink-800 text-ink-600 dark:text-ink-300 hover:border-ink-300')
                    }
                    style={selected ? { backgroundColor: p.color } : undefined}
                  >
                    <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: selected ? 'rgba(255,255,255,0.85)' : p.color }} />
                    {p.name}
                  </button>
                )
              })}
            </div>
          </div>
        ) : (
          <p className="text-sm text-ink-500 text-center">Add a project first from the Projects tab.</p>
        )}

        <label className="block space-y-1.5">
          <span className="text-[11px] font-medium uppercase tracking-[0.18em] text-ink-400">Task</span>
          <input
            value={task}
            onChange={e => setTask(e.target.value)}
            placeholder="What did you work on?"
            className="w-full rounded-xl border border-ink-200 bg-white px-3 h-11 text-sm dark:bg-ink-900 dark:border-ink-700 dark:text-ink-100 focus:border-accent focus:ring-0 outline-none transition-colors"
          />
        </label>
        {recentChips.length > 0 && (
          <div className="flex flex-wrap gap-1.5 -mt-2">
            {recentChips.map((t, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setTask(t)}
                className="text-[11px] text-ink-500 hover:text-ink-800 dark:hover:text-ink-100 px-2.5 py-1 rounded-full border border-ink-200 dark:border-ink-800 hover:border-accent/40 transition"
              >
                {t}
              </button>
            ))}
          </div>
        )}

        <div className="grid grid-cols-3 gap-3">
          <label className="block space-y-1.5">
            <span className="text-[11px] font-medium uppercase tracking-[0.18em] text-ink-400">Date</span>
            <input
              type="date"
              value={date}
              max={format(now, 'yyyy-MM-dd')}
              onChange={e => setDate(e.target.value)}
              className="w-full rounded-xl border border-ink-200 bg-white px-3 h-11 text-sm tabular dark:bg-ink-900 dark:border-ink-700 dark:text-ink-100"
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-[11px] font-medium uppercase tracking-[0.18em] text-ink-400">Start</span>
            <input
              type="time"
              value={startTime}
              onChange={e => setStartTime(e.target.value)}
              className="w-full rounded-xl border border-ink-200 bg-white px-3 h-11 text-sm tabular dark:bg-ink-900 dark:border-ink-700 dark:text-ink-100"
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-[11px] font-medium uppercase tracking-[0.18em] text-ink-400">Minutes</span>
            <input
              type="number"
              min={1}
              max={600}
              value={minutes}
              onChange={e => setMinutes(Math.max(1, Math.min(600, Number(e.target.value) || 1)))}
              className="w-full rounded-xl border border-ink-200 bg-white px-3 h-11 text-sm tabular dark:bg-ink-900 dark:border-ink-700 dark:text-ink-100"
            />
          </label>
        </div>

        <p className="text-[11px] text-ink-500 tabular -mt-1">
          {fmtDuration(durationSec)} · ends at {endLabel}
        </p>

        <label className="block space-y-1.5">
          <span className="text-[11px] font-medium uppercase tracking-[0.18em] text-ink-400">Note (optional)</span>
          <textarea
            value={note}
            onChange={e => setNote(e.target.value)}
            rows={2}
            placeholder="Anything worth remembering about this block"
            className="w-full rounded-xl border border-ink-200 bg-white px-3 py-2.5 text-sm dark:bg-ink-900 dark:border-ink-700 dark:text-ink-100 resize-none focus:border-accent focus:ring-0 outline-none transition-colors"
          />
        </label>

        {error && (
          <div className="text-xs text-rose-600 dark:text-rose-400 rounded-lg bg-rose-50 dark:bg-rose-500/10 px-3 py-2">
            {error}
          </div>
        )}

        <div className="flex gap-3 pt-1">
          <Button variant="secondary" className="flex-1" onClick={onClose}>Cancel</Button>
          <Button className="flex-1" onClick={() => void save()} disabled={saving || activeProjects.length === 0}>
            {saving ? 'Saving…' : 'Log session'}
          </Button>
        </div>
      </div>
    </div>
  )
}
