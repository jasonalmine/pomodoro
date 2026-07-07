import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { format, startOfDay } from 'date-fns'
import { X } from 'lucide-react'
import { db, listActiveProjects } from '../db'
import { Button } from './Button'
import type { DayShutdown, Project } from '../types'
import { todayShutdownId } from '../lib/dayId'

export function DayShutdownPanel({ onClose, now = new Date() }: { onClose: () => void; now?: Date }) {
  const id = todayShutdownId(now)
  const existing = useLiveQuery(() => db.dayShutdowns.get(id), [id])
  const projects = useLiveQuery(() => listActiveProjects(), [], [])
  const activeProjects: Project[] = (projects ?? []).filter(p => !p.archived)

  const [wins, setWins] = useState('')
  const [blockers, setBlockers] = useState('')
  const [tomorrowProjectId, setTomorrowProjectId] = useState<string>('')
  const [tomorrowTask, setTomorrowTask] = useState('')
  const [tomorrowMinutes, setTomorrowMinutes] = useState<number>(25)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!existing) return
    // eslint-disable-next-line react-hooks/set-state-in-effect -- seed the form from the loaded shutdown row
    setWins(existing.wins ?? '')
    setBlockers(existing.blockers ?? '')
    setTomorrowProjectId(existing.tomorrowProjectId ?? '')
    setTomorrowTask(existing.tomorrowTask ?? '')
    setTomorrowMinutes(existing.tomorrowMinutes ?? 25)
  }, [existing])

  useEffect(() => {
    if (tomorrowProjectId) return
    if (activeProjects.length === 0) return
    // eslint-disable-next-line react-hooks/set-state-in-effect -- default to the first active project once projects load
    setTomorrowProjectId(activeProjects[0].id)
  }, [activeProjects, tomorrowProjectId])

  const save = async () => {
    setSaving(true)
    const ts = Date.now()
    const row: DayShutdown = {
      id,
      date: startOfDay(now).getTime(),
      wins: wins.trim() || undefined,
      blockers: blockers.trim() || undefined,
      tomorrowProjectId: tomorrowProjectId || undefined,
      tomorrowTask: tomorrowTask.trim() || undefined,
      tomorrowMinutes,
      createdAt: existing?.createdAt ?? ts,
      updatedAt: ts,
    }
    await db.dayShutdowns.put(row)
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
          <div className="text-[11px] uppercase tracking-[0.22em] text-accent">End the day</div>
          <h2 className="font-display text-2xl sm:text-3xl text-ink-900 dark:text-ink-50">
            How did today go?
          </h2>
          <p className="text-xs text-ink-500">{format(now, 'EEEE, MMMM d')}</p>
        </header>

        <PromptArea
          label="Wins"
          value={wins}
          onChange={setWins}
          placeholder="Shipped the calendar week view, finally cleared inbox."
          rows={3}
        />

        <PromptArea
          label="Blockers / unfinished"
          value={blockers}
          onChange={setBlockers}
          placeholder="Stuck on the daylight savings bug. Need design feedback on the heatmap."
          rows={3}
        />

        <div className="space-y-2 pt-1">
          <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-ink-400">
            Tomorrow's first focus
          </div>

          {activeProjects.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {activeProjects.slice(0, 6).map(p => {
                const selected = p.id === tomorrowProjectId
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setTomorrowProjectId(p.id)}
                    className={
                      'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs transition ' +
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
          )}

          <input
            value={tomorrowTask}
            onChange={e => setTomorrowTask(e.target.value)}
            placeholder="What's the first Pomodoro tomorrow?"
            className="w-full rounded-xl border border-ink-200 bg-white px-3 h-11 text-sm dark:bg-ink-900 dark:border-ink-700 dark:text-ink-100 focus:border-accent focus:ring-0 outline-none transition-colors"
          />

          <div className="flex items-center gap-2">
            <span className="text-[11px] text-ink-400">Plan to spend</span>
            <input
              type="number"
              min={5}
              max={120}
              step={5}
              value={tomorrowMinutes}
              onChange={e => setTomorrowMinutes(Math.max(5, Math.min(120, Number(e.target.value) || 25)))}
              className="w-16 rounded-md border border-ink-200 dark:border-ink-800 bg-transparent px-2 h-8 text-xs tabular text-center"
            />
            <span className="text-[11px] text-ink-400">minutes</span>
          </div>
        </div>

        <div className="flex gap-3 pt-1">
          <Button variant="secondary" className="flex-1" onClick={onClose}>Cancel</Button>
          <Button className="flex-1" onClick={() => void save()} disabled={saving}>
            {existing ? 'Update' : 'Wrap up'}
          </Button>
        </div>
      </div>
    </div>
  )
}

function PromptArea({ label, value, onChange, placeholder, rows }: { label: string; value: string; onChange: (v: string) => void; placeholder: string; rows: number }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-[11px] font-medium uppercase tracking-[0.18em] text-ink-400">{label}</span>
      <textarea
        value={value}
        onChange={e => onChange(e.target.value)}
        rows={rows}
        placeholder={placeholder}
        className="w-full rounded-xl border border-ink-200 bg-white px-3 py-2.5 text-sm dark:bg-ink-900 dark:border-ink-700 dark:text-ink-100 resize-none focus:border-accent focus:ring-0 outline-none transition-colors"
      />
    </label>
  )
}
