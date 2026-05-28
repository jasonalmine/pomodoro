import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { addDays, addMonths, addWeeks, eachDayOfInterval, endOfMonth, endOfWeek, format, isSameDay, isSameMonth, startOfDay, startOfMonth, startOfWeek, isToday } from 'date-fns'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { db } from '../db'
import { fmtClock, fmtDuration } from '../lib/format'
import { ProjectChip } from '../components/ProjectChip'
import { Button } from '../components/Button'
import { CalendarDaySchedule, CalendarWeekSchedule } from '../components/CalendarSchedule'
import { SessionEditPanel } from '../components/SessionEditPanel'
import type { Pomodoro, Project } from '../types'

type Mode = 'month' | 'week' | 'day'

export function CalendarView() {
  const [mode, setMode] = useState<Mode>('month')
  const [cursor, setCursor] = useState(() => new Date())
  const [selected, setSelected] = useState<Date | null>(new Date())
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null)

  // Pick the right query range based on mode.
  const { rangeStart, rangeEnd } = useMemo(() => {
    if (mode === 'day') {
      const s = startOfDay(cursor)
      return { rangeStart: s, rangeEnd: addDays(s, 1) }
    }
    if (mode === 'week') {
      const s = startOfWeek(cursor, { weekStartsOn: 1 })
      return { rangeStart: s, rangeEnd: endOfWeek(cursor, { weekStartsOn: 1 }) }
    }
    const monthStart = startOfMonth(cursor)
    const monthEnd = endOfMonth(cursor)
    return {
      rangeStart: startOfWeek(monthStart, { weekStartsOn: 1 }),
      rangeEnd: endOfWeek(monthEnd, { weekStartsOn: 1 }),
    }
  }, [mode, cursor])

  const pomodoros = useLiveQuery(
    () => db.pomodoros
      .where('startedAt').between(rangeStart.getTime(), rangeEnd.getTime(), true, true)
      .filter(p => !p.deletedAt)
      .toArray(),
    [rangeStart.getTime(), rangeEnd.getTime()],
    [],
  )
  const projects = useLiveQuery(() => db.projects.toArray(), [], [])
  const projectMap = useMemo(() => new Map((projects ?? []).map(p => [p.id, p])), [projects])

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

  const headerLabel = useMemo(() => {
    if (mode === 'day') return format(cursor, 'EEEE, MMM d')
    if (mode === 'week') {
      const s = startOfWeek(cursor, { weekStartsOn: 1 })
      const e = endOfWeek(cursor, { weekStartsOn: 1 })
      return `${format(s, 'MMM d')} – ${format(e, 'MMM d')}`
    }
    return format(cursor, 'MMMM yyyy')
  }, [mode, cursor])

  const onPrev = () => {
    if (mode === 'day') setCursor(c => addDays(c, -1))
    else if (mode === 'week') setCursor(c => addWeeks(c, -1))
    else setCursor(c => addMonths(c, -1))
  }
  const onNext = () => {
    if (mode === 'day') setCursor(c => addDays(c, 1))
    else if (mode === 'week') setCursor(c => addWeeks(c, 1))
    else setCursor(c => addMonths(c, 1))
  }
  const onToday = () => {
    const now = new Date()
    setCursor(now)
    setSelected(now)
  }

  const selectedKey = selected ? format(selected, 'yyyy-MM-dd') : null
  const selectedPoms = (selectedKey && byDay.get(selectedKey)) || []
  const selectedSession = useMemo(
    () => (pomodoros ?? []).find(p => p.id === selectedSessionId) ?? null,
    [pomodoros, selectedSessionId],
  )

  return (
    <div className="mx-auto w-full max-w-5xl p-4 sm:p-6 space-y-5">
      <header className="space-y-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div>
            <h1 className="font-display text-3xl text-ink-900 dark:text-ink-50">Calendar</h1>
            <p className="text-sm text-ink-500 mt-1">Your focus history at a glance.</p>
          </div>
          <div className="inline-flex items-center rounded-full bg-ink-100 dark:bg-ink-800 p-1">
            <ModeBtn active={mode === 'day'} onClick={() => setMode('day')}>Day</ModeBtn>
            <ModeBtn active={mode === 'week'} onClick={() => setMode('week')}>Week</ModeBtn>
            <ModeBtn active={mode === 'month'} onClick={() => setMode('month')}>Month</ModeBtn>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={onPrev}><ChevronLeft size={16} /></Button>
          <div className="text-sm font-medium tabular text-center min-w-[10rem]">{headerLabel}</div>
          <Button variant="ghost" size="sm" onClick={onNext}><ChevronRight size={16} /></Button>
          <Button variant="ghost" size="sm" onClick={onToday}>Today</Button>
        </div>
      </header>

      {mode === 'month' && (
        <MonthGrid
          cursor={cursor}
          byDay={byDay}
          projectMap={projectMap}
          selected={selected}
          onSelect={d => { setSelected(d); setMode('day'); setCursor(d) }}
        />
      )}

      {mode === 'week' && (
        <section className="rounded-2xl bg-white dark:bg-ink-900 border border-ink-200 dark:border-ink-800 p-4 sm:p-5">
          <CalendarWeekSchedule
            weekDays={eachDayOfInterval({ start: rangeStart, end: rangeEnd })}
            sessionsByDay={byDay}
            projects={projectMap}
            onSelect={p => setSelectedSessionId(p.id)}
            selectedId={selectedSessionId}
          />
        </section>
      )}

      {mode === 'day' && (
        <section className="rounded-2xl bg-white dark:bg-ink-900 border border-ink-200 dark:border-ink-800 p-4 sm:p-5 space-y-3">
          <div className="text-xs text-ink-500">
            {selectedPoms.length} session{selectedPoms.length === 1 ? '' : 's'} ·{' '}
            {fmtDuration(selectedPoms.reduce((a, p) => a + p.actualSeconds, 0))}
          </div>
          <CalendarDaySchedule
            date={cursor}
            sessions={byDay.get(format(cursor, 'yyyy-MM-dd')) ?? []}
            projects={projectMap}
            onSelect={p => setSelectedSessionId(p.id)}
            selectedId={selectedSessionId}
          />
        </section>
      )}

      {selectedSession && (
        <SessionEditPanel pomodoroId={selectedSession.id} onClose={() => setSelectedSessionId(null)} />
      )}

      {mode === 'month' && selected && (
        <DayPanel date={selected} pomodoros={selectedPoms} projects={projectMap} />
      )}
    </div>
  )
}

function ModeBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`h-7 px-3 rounded-full text-xs font-medium transition ${
        active
          ? 'bg-white dark:bg-ink-900 text-ink-900 dark:text-ink-50 shadow-sm'
          : 'text-ink-500 hover:text-ink-700 dark:hover:text-ink-200'
      }`}
    >
      {children}
    </button>
  )
}

function MonthGrid({
  cursor,
  byDay,
  projectMap,
  selected,
  onSelect,
}: {
  cursor: Date
  byDay: Map<string, Pomodoro[]>
  projectMap: Map<string, Project>
  selected: Date | null
  onSelect: (d: Date) => void
}) {
  const monthStart = startOfMonth(cursor)
  const monthEnd = endOfMonth(cursor)
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 })
  const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 1 })
  const days = eachDayOfInterval({ start: gridStart, end: gridEnd })

  const maxMinutes = useMemo(() => {
    let max = 0
    for (const list of byDay.values()) {
      const m = list.reduce((a, p) => a + p.actualSeconds, 0) / 60
      if (m > max) max = m
    }
    return Math.max(60, max)
  }, [byDay])

  return (
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
            onClick={() => onSelect(day)}
            className={`relative aspect-square rounded-xl border text-left p-2 transition group
              ${inMonth ? 'border-ink-200 dark:border-ink-800' : 'border-transparent opacity-40'}
              ${isSel ? 'ring-2 ring-accent' : ''}
            `}
            style={{
              backgroundColor: intensity > 0
                ? `rgba(255, 106, 55, ${0.1 + intensity * 0.6})`
                : undefined,
            }}
          >
            <div className={`text-xs font-medium ${isToday(day) ? 'text-accent' : 'text-ink-700 dark:text-ink-200'}`}>
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
  )
}

function DayPanel({ date, pomodoros, projects }: { date: Date; pomodoros: Pomodoro[]; projects: Map<string, Project> }) {
  const sorted = useMemo(() => [...pomodoros].sort((a, b) => a.startedAt - b.startedAt), [pomodoros])
  const totalMin = sorted.reduce((a, p) => a + p.actualSeconds, 0) / 60
  const [editingId, setEditingId] = useState<string | null>(null)

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
                <button onClick={() => setEditingId(p.id)} className="w-full text-left p-3 flex items-center gap-3 hover:bg-ink-50 dark:hover:bg-ink-800 transition" title="Click to edit">
                  <div className="w-1 self-stretch rounded-full" style={{ backgroundColor: project?.color ?? '#ff6a37' }} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      {project && <ProjectChip project={project} />}
                      <span className="text-xs text-ink-500 tabular">{fmtClock(p.startedAt)} · {fmtDuration(p.actualSeconds)}</span>
                      {!p.completed && <span className="text-[10px] uppercase tracking-wider text-rose-500">aborted</span>}
                      {p.flowMode && <span className="text-[10px] uppercase tracking-wider text-accent">flow</span>}
                      {p.manual && <span className="text-[10px] uppercase tracking-wider text-ink-400">manual</span>}
                    </div>
                    <div className="text-sm text-ink-800 dark:text-ink-100 truncate mt-1">{p.task}</div>
                  </div>
                </button>
              </li>
            )
          })}
        </ol>
      )}
      {editingId && (
        <SessionEditPanel pomodoroId={editingId} onClose={() => setEditingId(null)} />
      )}
    </div>
  )
}

