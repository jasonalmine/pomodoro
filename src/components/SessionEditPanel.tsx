import { useEffect, useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { format } from 'date-fns'
import { CalendarDays, Trash2, X } from 'lucide-react'
import { db, listActiveProjects } from '../db'
import { Button } from './Button'
import { ProjectChipPicker } from './ProjectChipPicker'
import { confirmDialog } from '../lib/confirm'
import { fmtDuration } from '../lib/format'
import { recentTags } from '../lib/stats'
import { deletePomodoroEverywhere } from '../lib/sync'
import { calendarErrorMessage, syncPomodoroToCalendar, updatePomodoroCalendarEvent } from '../lib/calendar'
import { useSettings } from '../hooks/useSettings'
import type { Pomodoro, Project } from '../types'

// Comprehensive editor for a saved Pomodoro: project, linked task, task text,
// date/start/duration, distractions, tags, all reflection notes, completed
// flag. Used by both the Insights daily timeline and the Calendar day view.
export function SessionEditPanel({ pomodoroId, onClose }: { pomodoroId: string; onClose: () => void }) {
  const pom = useLiveQuery(() => db.pomodoros.get(pomodoroId), [pomodoroId])
  const allProjects = useLiveQuery(() => listActiveProjects(), [], [])
  const activeProjects: Project[] = useMemo(
    () => (allProjects ?? []).filter(p => !p.archived),
    [allProjects],
  )
  const allTasks = useLiveQuery(() => db.tasks.filter(t => !t.deletedAt).toArray(), [], [])
  const allPoms = useLiveQuery(() => db.pomodoros.filter(p => !p.deletedAt).toArray(), [], [])

  const [projectId, setProjectId] = useState('')
  const [taskId, setTaskId] = useState<string | null>(null)
  const [task, setTask] = useState('')
  const [date, setDate] = useState('')
  const [startTime, setStartTime] = useState('')
  const [minutes, setMinutes] = useState(25)
  const [distractions, setDistractions] = useState(0)
  const [tags, setTags] = useState<string[]>([])
  const [tagDraft, setTagDraft] = useState('')
  const [noteDone, setNoteDone] = useState('')
  const [noteNext, setNoteNext] = useState('')
  const [note, setNote] = useState('')
  const [completed, setCompleted] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [calBusy, setCalBusy] = useState(false)
  const [seeded, setSeeded] = useState(false)

  const settings = useSettings()
  const calConfigured = !!settings.calendarSync.matonApiKey

  const addToCalendar = async () => {
    setError(null)
    setCalBusy(true)
    try {
      await syncPomodoroToCalendar(pomodoroId, { force: true, throwOnError: true })
    } catch (e) {
      setError(calendarErrorMessage(e))
    } finally {
      setCalBusy(false)
    }
  }

  // Seed form once from the loaded Pomodoro.
  useEffect(() => {
    if (seeded || !pom) return
    const start = new Date(pom.startedAt)
    // eslint-disable-next-line react-hooks/set-state-in-effect -- seed the edit form once from the loaded session
    setProjectId(pom.projectId)
    setTaskId(pom.taskId ?? null)
    setTask(pom.task ?? '')
    setDate(format(start, 'yyyy-MM-dd'))
    setStartTime(format(start, 'HH:mm'))
    setMinutes(Math.max(1, Math.round(pom.actualSeconds / 60)))
    setDistractions(pom.distractions ?? 0)
    setTags(pom.tags ?? [])
    setNoteDone(pom.noteDone ?? '')
    setNoteNext(pom.noteNext ?? '')
    setNote(pom.note ?? '')
    setCompleted(pom.completed)
    setSeeded(true)
  }, [pom, seeded])

  const projectTasks = useMemo(() => {
    return (allTasks ?? []).filter(t => t.projectId === projectId && !t.archivedAt)
  }, [allTasks, projectId])

  const recentTagOptions = useMemo(
    () => recentTags(allPoms ?? [], 8).filter(t => !tags.includes(t)),
    [allPoms, tags],
  )

  const computedStartMs = useMemo(() => {
    const [h, m] = (startTime || '').split(':').map(Number)
    if (!date || Number.isNaN(h) || Number.isNaN(m)) return NaN
    const d = new Date(`${date}T00:00:00`)
    if (Number.isNaN(d.getTime())) return NaN
    d.setHours(h, m, 0, 0)
    return d.getTime()
  }, [date, startTime])

  const durationSec = Math.max(60, Math.round(minutes * 60))
  const computedEndMs = Number.isNaN(computedStartMs) ? NaN : computedStartMs + durationSec * 1000

  const addTag = (raw: string) => {
    const t = raw.trim().toLowerCase()
    if (!t || tags.includes(t)) return
    setTags(prev => [...prev, t])
    setTagDraft('')
  }
  const removeTag = (t: string) => setTags(prev => prev.filter(x => x !== t))

  const onSave = async () => {
    setError(null)
    if (!pom) return
    if (!projectId) { setError('Pick a project.'); return }
    if (Number.isNaN(computedStartMs)) { setError('Enter a valid date and start time.'); return }
    if (minutes < 1) { setError('Duration must be at least 1 minute.'); return }
    setBusy(true)
    try {
      const patch: Partial<Pomodoro> = {
        projectId,
        taskId: taskId ?? undefined,
        task: task.trim() || 'Focus session',
        startedAt: computedStartMs,
        endedAt: computedEndMs,
        actualSeconds: durationSec,
        // Keep plannedSeconds in sync for manual-style rows; otherwise preserve
        // the original plan (useful for distinguishing planned-vs-actual later).
        plannedSeconds: pom.manual ? durationSec : (pom.plannedSeconds || durationSec),
        distractions: distractions > 0 ? distractions : undefined,
        tags: tags.length ? tags : undefined,
        noteDone: noteDone.trim() || undefined,
        noteNext: noteNext.trim() || undefined,
        note: note.trim() || undefined,
        completed,
        updatedAt: Date.now(),
      }
      await db.pomodoros.update(pomodoroId, patch)
      // Keep the calendar event in step with the edited time / title / notes.
      if (pom.calendarEventId) void updatePomodoroCalendarEvent(pomodoroId)
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed.')
    } finally {
      setBusy(false)
    }
  }

  const onDelete = async () => {
    const msg = pom?.calendarEventId
      ? 'Delete this Pomodoro? It will also be removed from your Google Calendar. This cannot be undone.'
      : 'Delete this Pomodoro? This cannot be undone.'
    if (!(await confirmDialog(msg, { danger: true, confirmLabel: 'Delete' }))) return
    setBusy(true)
    setError(null)
    try {
      await deletePomodoroEverywhere(pomodoroId)
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Delete failed.')
      setBusy(false)
    }
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
          <div className="text-[11px] uppercase tracking-[0.22em] text-accent">Edit session</div>
          <h2 className="font-display text-2xl text-ink-900 dark:text-ink-50">
            {pom ? format(pom.startedAt, 'EEE, MMM d') : 'Loading…'}
          </h2>
          {pom && (
            <p className="text-[11px] text-ink-500">
              {pom.flowMode && 'Flow session · '}
              {pom.manual && 'Logged manually · '}
              {pom.ritualUsed && 'With ritual · '}
              {!pom.flowMode && !pom.manual && pom.plannedSeconds !== pom.actualSeconds
                ? <>planned {fmtDuration(pom.plannedSeconds)} · actual {fmtDuration(pom.actualSeconds)}</>
                : <>original: {fmtDuration(pom.actualSeconds)}</>}
            </p>
          )}
        </header>

        {!pom && <p className="text-sm text-ink-500 text-center">Couldn't find that session.</p>}

        {pom && (
          <>
            {calConfigured && (
              <div className="flex items-center justify-between gap-3 rounded-xl border border-ink-200 dark:border-ink-800 px-3 py-2.5">
                <div className="flex items-center gap-2 text-xs">
                  <CalendarDays size={14} className="text-accent shrink-0" />
                  {pom.calendarEventId
                    ? <span className="text-emerald-600 dark:text-emerald-400">On Google Calendar</span>
                    : <span className="text-ink-500">Not on your calendar yet</span>}
                </div>
                {!pom.calendarEventId && (
                  <Button variant="secondary" size="sm" onClick={() => void addToCalendar()} disabled={calBusy}>
                    {calBusy ? 'Adding…' : 'Add to calendar'}
                  </Button>
                )}
              </div>
            )}

            <div className="space-y-1.5">
              <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-ink-400">Project</div>
              <ProjectChipPicker
                projects={activeProjects}
                value={projectId}
                onChange={id => {
                  setProjectId(id)
                  if (taskId) {
                    // Drop the linked task if it belonged to the previous project.
                    const t = (allTasks ?? []).find(x => x.id === taskId)
                    if (!t || t.projectId !== id) setTaskId(null)
                  }
                }}
              />
            </div>

            {projectTasks.length > 0 && (
              <div className="space-y-1.5">
                <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-ink-400">Linked task</div>
                <div className="flex flex-wrap gap-1.5">
                  {projectTasks.map(t => {
                    const selected = taskId === t.id
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => {
                          if (selected) { setTaskId(null) }
                          else {
                            setTaskId(t.id)
                            // If the task text matches the old linked task, refresh to new task name.
                            const prev = (allTasks ?? []).find(x => x.id === taskId)
                            if (!task || (prev && task === prev.name)) setTask(t.name)
                          }
                        }}
                        className={
                          'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] transition ' +
                          (selected
                            ? 'border-accent text-accent bg-accent/5'
                            : 'border-ink-200 dark:border-ink-800 text-ink-500 hover:text-ink-800 dark:hover:text-ink-100 hover:border-accent/40')
                        }
                      >
                        <span className="truncate max-w-[10rem]">{t.name}</span>
                        {t.completed && <span className="text-[10px] text-ink-400">✓</span>}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            <label className="block space-y-1.5">
              <span className="text-[11px] font-medium uppercase tracking-[0.18em] text-ink-400">Task</span>
              <input
                value={task}
                onChange={e => {
                  setTask(e.target.value)
                  if (taskId) {
                    const linked = (allTasks ?? []).find(x => x.id === taskId)
                    if (!linked || linked.name !== e.target.value) setTaskId(null)
                  }
                }}
                className="w-full rounded-xl border border-ink-200 bg-white px-3 h-11 text-sm dark:bg-ink-900 dark:border-ink-700 dark:text-ink-100 focus:border-accent focus:ring-0 outline-none transition-colors"
              />
            </label>

            <div className="grid grid-cols-3 gap-3">
              <label className="block space-y-1.5">
                <span className="text-[11px] font-medium uppercase tracking-[0.18em] text-ink-400">Date</span>
                <input
                  type="date" value={date} onChange={e => setDate(e.target.value)}
                  className="w-full rounded-xl border border-ink-200 bg-white px-3 h-11 text-sm tabular dark:bg-ink-900 dark:border-ink-700 dark:text-ink-100"
                />
              </label>
              <label className="block space-y-1.5">
                <span className="text-[11px] font-medium uppercase tracking-[0.18em] text-ink-400">Start</span>
                <input
                  type="time" value={startTime} onChange={e => setStartTime(e.target.value)}
                  className="w-full rounded-xl border border-ink-200 bg-white px-3 h-11 text-sm tabular dark:bg-ink-900 dark:border-ink-700 dark:text-ink-100"
                />
              </label>
              <label className="block space-y-1.5">
                <span className="text-[11px] font-medium uppercase tracking-[0.18em] text-ink-400">Minutes</span>
                <input
                  type="number" min={1} max={600} value={minutes}
                  onChange={e => setMinutes(Math.max(1, Math.min(600, Number(e.target.value) || 1)))}
                  className="w-full rounded-xl border border-ink-200 bg-white px-3 h-11 text-sm tabular dark:bg-ink-900 dark:border-ink-700 dark:text-ink-100"
                />
              </label>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <label className="block space-y-1.5">
                <span className="text-[11px] font-medium uppercase tracking-[0.18em] text-ink-400">Distractions</span>
                <input
                  type="number" min={0} max={99} value={distractions}
                  onChange={e => setDistractions(Math.max(0, Math.min(99, Number(e.target.value) || 0)))}
                  className="w-full rounded-xl border border-ink-200 bg-white px-3 h-11 text-sm tabular dark:bg-ink-900 dark:border-ink-700 dark:text-ink-100"
                />
              </label>
              <label className="flex items-center gap-2 text-sm text-ink-700 dark:text-ink-200 pt-7">
                <input
                  type="checkbox" checked={completed}
                  onChange={e => setCompleted(e.target.checked)}
                  className="h-4 w-4 rounded border-ink-300 dark:border-ink-700 text-accent focus:ring-accent"
                />
                Completed (counts toward goal)
              </label>
            </div>

            <div className="space-y-1.5">
              <span className="text-[11px] font-medium uppercase tracking-[0.18em] text-ink-400">Tags</span>
              {tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pb-1">
                  {tags.map(t => (
                    <span key={t} className="inline-flex items-center gap-1 rounded-full bg-accent/10 text-accent px-2.5 py-0.5 text-[11px]">
                      {t}
                      <button type="button" onClick={() => removeTag(t)} className="hover:opacity-70 text-[14px] leading-none" aria-label={`Remove ${t}`}>×</button>
                    </span>
                  ))}
                </div>
              )}
              <input
                value={tagDraft}
                onChange={e => setTagDraft(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addTag(tagDraft) }
                  else if (e.key === 'Backspace' && tagDraft === '' && tags.length) { removeTag(tags[tags.length - 1]) }
                }}
                onBlur={() => { if (tagDraft.trim()) addTag(tagDraft) }}
                placeholder="deep, admin, meeting…"
                className="w-full bg-transparent border-0 border-b border-ink-200 dark:border-ink-800 focus:border-accent focus:ring-0 outline-none text-sm text-ink-900 dark:text-ink-50 py-1.5 px-1 placeholder:text-ink-300 dark:placeholder:text-ink-700 transition-colors"
              />
              {recentTagOptions.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-2">
                  {recentTagOptions.map(t => (
                    <button key={t} type="button" onClick={() => addTag(t)}
                      className="text-[11px] text-ink-500 hover:text-ink-800 dark:hover:text-ink-100 px-2.5 py-0.5 rounded-full border border-ink-200 dark:border-ink-800 hover:border-accent/40 transition">
                      + {t}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <ReflectInput label="What did you finish?" value={noteDone} onChange={setNoteDone} />
            <ReflectInput label="What's next?" value={noteNext} onChange={setNoteNext} />
            <label className="block space-y-1.5">
              <span className="text-[11px] font-medium uppercase tracking-[0.18em] text-ink-400">Anything else</span>
              <textarea
                value={note} onChange={e => setNote(e.target.value)} rows={3}
                placeholder="A blocker, an idea, how it felt…"
                className="w-full rounded-xl border border-ink-200 bg-white px-3 py-2.5 text-sm dark:bg-ink-900 dark:border-ink-700 dark:text-ink-100 resize-none focus:border-accent focus:ring-0 outline-none transition-colors"
              />
            </label>

            {error && (
              <div className="text-xs text-rose-600 dark:text-rose-400 rounded-lg bg-rose-50 dark:bg-rose-500/10 px-3 py-2">
                {error}
              </div>
            )}

            <div className="flex items-center gap-3 pt-1">
              <Button variant="ghost" size="sm" onClick={() => void onDelete()} disabled={busy} title="Delete this Pomodoro">
                <Trash2 size={14} className="text-rose-500" />
              </Button>
              <Button variant="secondary" className="flex-1" onClick={onClose} disabled={busy}>Cancel</Button>
              <Button className="flex-1" onClick={() => void onSave()} disabled={busy}>
                {busy ? 'Saving…' : 'Save'}
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function ReflectInput({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-[11px] font-medium uppercase tracking-[0.18em] text-ink-400">{label}</span>
      <input
        value={value} onChange={e => onChange(e.target.value)}
        className="w-full bg-transparent border-0 border-b border-ink-200 dark:border-ink-800 focus:border-accent focus:ring-0 outline-none text-sm text-ink-900 dark:text-ink-50 py-1.5 px-1 transition-colors"
      />
    </label>
  )
}
