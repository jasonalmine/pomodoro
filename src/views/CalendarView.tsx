import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { addMonths, eachDayOfInterval, endOfMonth, endOfWeek, format, isSameDay, isSameMonth, startOfMonth, startOfWeek, isToday } from 'date-fns'
import { ChevronLeft, ChevronRight, Trash2 } from 'lucide-react'
import { db } from '../db'
import { fmtClock, fmtDuration } from '../lib/format'
import { ProjectChip } from '../components/ProjectChip'
import { Button } from '../components/Button'
import type { Pomodoro, Project } from '../types'

export function CalendarView() {
  const [cursor, setCursor] = useState(() => new Date())
  const [selected, setSelected] = useState<Date | null>(new Date())

  const monthStart = startOfMonth(cursor)
  const monthEnd = endOfMonth(cursor)
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 })
  const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 1 })

  const pomodoros = useLiveQuery(
    () => db.pomodoros.where('startedAt').between(gridStart.getTime(), gridEnd.getTime(), true, true).toArray(),
    [gridStart.getTime(), gridEnd.getTime()],
    [],
  )
  const projects = useLiveQuery(() => db.projects.toArray(), [], [])

  const byDay = useMemo(() => {
    const map = new Map<string, Pomodoro[]>()
    for (const p of pomodoros ?? []) {
      const key = format(new Date(p.startedAt), 'yyyy-MM-dd')
      const arr = map.get(key) ?? []
      arr.push(p)
      map.set(key, arr)
    }
    return map
  }, [pomodoros])

  const days = eachDayOfInterval({ start: gridStart, end: gridEnd })

  const maxMinutes = useMemo(() => {
    let max = 0
    for (const list of byDay.values()) {
      const m = list.reduce((a, p) => a + p.actualSeconds, 0) / 60
      if (m > max) max = m
    }
    return Math.max(60, max)
  }, [byDay])

  const selectedKey = selected ? format(selected, 'yyyy-MM-dd') : null
  const selectedPoms = (selectedKey && byDay.get(selectedKey)) || []
  const projectMap = new Map((projects ?? []).map(p => [p.id, p]))

  return (
    <div className="mx-auto w-full max-w-5xl p-4 sm:p-6 space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl text-ink-900 dark:text-ink-50">Calendar</h1>
          <p className="text-sm text-ink-500 mt-1">Your focus history at a glance.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => setCursor(c => addMonths(c, -1))}><ChevronLeft size={16} /></Button>
          <div className="text-sm font-medium tabular w-32 text-center">{format(cursor, 'MMMM yyyy')}</div>
          <Button variant="ghost" size="sm" onClick={() => setCursor(c => addMonths(c, 1))}><ChevronRight size={16} /></Button>
        </div>
      </header>

      <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(d => (
          <div key={d} className="text-[10px] uppercase tracking-wider text-ink-400 text-center py-1">{d}</div>
        ))}
        {days.map(day => {
          const key = format(day, 'yyyy-MM-dd')
          const list = byDay.get(key) ?? []
          const minutes = list.reduce((a, p) => a + p.actualSeconds, 0) / 60
          const intensity = Math.min(1, minutes / maxMinutes)
          const inMonth = isSameMonth(day, cursor)
          const isSel = selected && isSameDay(day, selected)
          return (
            <button
              key={key}
              onClick={() => setSelected(day)}
              className={`relative aspect-square rounded-xl border text-left p-2 transition group
                ${inMonth ? 'border-ink-200 dark:border-ink-800' : 'border-transparent opacity-40'}
                ${isSel ? 'ring-2 ring-ember-500' : ''}
              `}
              style={{
                backgroundColor: intensity > 0
                  ? `rgba(255, 106, 55, ${0.1 + intensity * 0.6})`
                  : undefined,
              }}
            >
              <div className={`text-xs font-medium ${isToday(day) ? 'text-ember-500' : 'text-ink-700 dark:text-ink-200'}`}>
                {format(day, 'd')}
              </div>
              {list.length > 0 && (
                <div className="absolute bottom-1.5 left-1.5 right-1.5 flex items-center gap-0.5">
                  {list.slice(0, 6).map(p => (
                    <span key={p.id} className="h-1 flex-1 rounded-full" style={{ backgroundColor: projectMap.get(p.projectId)?.color ?? '#ff6a37' }} />
                  ))}
                </div>
              )}
            </button>
          )
        })}
      </div>

      {selected && <DayPanel date={selected} pomodoros={selectedPoms} projects={projectMap} />}
    </div>
  )
}

function DayPanel({ date, pomodoros, projects }: { date: Date; pomodoros: Pomodoro[]; projects: Map<string, Project> }) {
  const sorted = useMemo(() => [...pomodoros].sort((a, b) => a.startedAt - b.startedAt), [pomodoros])
  const totalMin = sorted.reduce((a, p) => a + p.actualSeconds, 0) / 60
  const [open, setOpen] = useState<string | null>(null)

  return (
    <div className="rounded-2xl bg-white dark:bg-ink-900 border border-ink-200 dark:border-ink-800 p-5 space-y-4">
      <div className="flex items-baseline justify-between">
        <div>
          <h2 className="font-display text-xl text-ink-900 dark:text-ink-50">{format(date, 'EEEE, MMMM d')}</h2>
          <div className="text-xs text-ink-500 mt-0.5">{sorted.length} session{sorted.length === 1 ? '' : 's'} · {fmtDuration(totalMin * 60)}</div>
        </div>
      </div>
      {sorted.length === 0 ? (
        <div className="text-sm text-ink-500 py-6 text-center">No Pomodoros yet.</div>
      ) : (
        <ol className="space-y-2">
          {sorted.map(p => {
            const project = projects.get(p.projectId)
            return (
              <li key={p.id} className="rounded-xl border border-ink-200 dark:border-ink-800 overflow-hidden">
                <button onClick={() => setOpen(open === p.id ? null : p.id)} className="w-full text-left p-3 flex items-center gap-3 hover:bg-ink-50 dark:hover:bg-ink-800 transition">
                  <div className="w-1 self-stretch rounded-full" style={{ backgroundColor: project?.color ?? '#ff6a37' }} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      {project && <ProjectChip project={project} />}
                      <span className="text-xs text-ink-500 tabular">{fmtClock(p.startedAt)} · {fmtDuration(p.actualSeconds)}</span>
                      {!p.completed && <span className="text-[10px] uppercase tracking-wider text-rose-500">aborted</span>}
                    </div>
                    <div className="text-sm text-ink-800 dark:text-ink-100 truncate mt-1">{p.task}</div>
                  </div>
                </button>
                {open === p.id && (
                  <PomodoroDetail pom={p} />
                )}
              </li>
            )
          })}
        </ol>
      )}
    </div>
  )
}

function PomodoroDetail({ pom }: { pom: Pomodoro }) {
  const [note, setNote] = useState(pom.note ?? '')
  return (
    <div className="border-t border-ink-200 dark:border-ink-800 p-4 space-y-3 bg-ink-50 dark:bg-ink-950/40">
      <div className="grid grid-cols-2 gap-3 text-xs">
        <Stat label="Started" value={fmtClock(pom.startedAt)} />
        <Stat label="Ended" value={fmtClock(pom.endedAt)} />
        <Stat label="Planned" value={fmtDuration(pom.plannedSeconds)} />
        <Stat label="Actual" value={fmtDuration(pom.actualSeconds)} />
      </div>
      <textarea
        value={note} onChange={e => setNote(e.target.value)}
        placeholder="Add a reflection..."
        rows={3}
        className="w-full rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm dark:bg-ink-900 dark:border-ink-700 dark:text-ink-100 resize-none"
      />
      <div className="flex gap-2 justify-end">
        <Button variant="ghost" size="sm" onClick={async () => {
          if (!confirm('Delete this Pomodoro?')) return
          await db.pomodoros.delete(pom.id)
        }}><Trash2 size={14} className="text-rose-500" /></Button>
        <Button size="sm" onClick={() => db.pomodoros.update(pom.id, { note: note.trim() || undefined })}>Save</Button>
      </div>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-ink-400 uppercase tracking-wider">{label}</div>
      <div className="text-ink-800 dark:text-ink-100 tabular mt-0.5">{value}</div>
    </div>
  )
}
