import { useMemo } from 'react'
import { format, isSameDay } from 'date-fns'
import { fmtClock, fmtDuration } from '../lib/format'
import type { Pomodoro, Project } from '../types'

const DEFAULT_START_HOUR = 6
const DEFAULT_END_HOUR = 23 // exclusive; renders 6:00 → 22:00 labels
const PX_PER_HOUR = 56

type PositionedSession = {
  pomodoro: Pomodoro
  topPx: number
  heightPx: number
  startMinutes: number
}

function positionSessions(sessions: Pomodoro[], startHour: number): PositionedSession[] {
  return sessions.map(p => {
    const d = new Date(p.startedAt)
    const startMinutes = d.getHours() * 60 + d.getMinutes() + d.getSeconds() / 60
    const offsetMin = startMinutes - startHour * 60
    const durationMin = p.actualSeconds / 60
    return {
      pomodoro: p,
      topPx: (offsetMin / 60) * PX_PER_HOUR,
      heightPx: Math.max(8, (durationMin / 60) * PX_PER_HOUR),
      startMinutes,
    }
  })
}

function autoRange(sessions: Pomodoro[]): { startHour: number; endHour: number } {
  if (sessions.length === 0) return { startHour: DEFAULT_START_HOUR, endHour: DEFAULT_END_HOUR }
  let minH = DEFAULT_START_HOUR
  let maxH = DEFAULT_END_HOUR
  for (const p of sessions) {
    const start = new Date(p.startedAt)
    const end = new Date(p.endedAt)
    const startH = start.getHours()
    const endH = Math.min(23, end.getHours() + (end.getMinutes() > 0 ? 1 : 0))
    if (startH < minH) minH = Math.max(0, startH)
    if (endH > maxH) maxH = Math.min(24, endH + 1)
  }
  return { startHour: minH, endHour: maxH }
}

function HourRail({ startHour, endHour }: { startHour: number; endHour: number }) {
  const hours = []
  for (let h = startHour; h < endHour; h++) hours.push(h)
  return (
    <div className="relative shrink-0 w-12 text-right pr-2">
      {hours.map((h, i) => (
        <div key={h} className="text-[10px] tabular text-ink-400" style={{ height: PX_PER_HOUR }}>
          {i === 0 ? '' : formatHour(h)}
        </div>
      ))}
    </div>
  )
}

function formatHour(h: number): string {
  const period = h >= 12 ? 'pm' : 'am'
  const hh = h % 12 === 0 ? 12 : h % 12
  return `${hh} ${period}`
}

function DayColumn({
  date,
  sessions,
  projects,
  startHour,
  endHour,
  onSelect,
  selectedId,
  showHeader = false,
  highlightToday = false,
}: {
  date: Date
  sessions: Pomodoro[]
  projects: Map<string, Project>
  startHour: number
  endHour: number
  onSelect: (p: Pomodoro) => void
  selectedId?: string | null
  showHeader?: boolean
  highlightToday?: boolean
}) {
  const positioned = useMemo(() => positionSessions(sessions, startHour), [sessions, startHour])
  const totalHeight = (endHour - startHour) * PX_PER_HOUR
  const today = isSameDay(date, new Date())
  const totalMin = sessions.reduce((a, p) => a + p.actualSeconds, 0) / 60

  return (
    <div className="flex-1 min-w-[88px]">
      {showHeader && (
        <div className={`px-1 pb-2 border-b border-ink-200 dark:border-ink-800 ${highlightToday && today ? 'text-ember-500' : 'text-ink-500'}`}>
          <div className="text-[10px] uppercase tracking-wider">{format(date, 'EEE')}</div>
          <div className={`text-lg font-display tabular ${today ? 'text-ember-500' : 'text-ink-900 dark:text-ink-50'}`}>
            {format(date, 'd')}
          </div>
          <div className="text-[10px] tabular text-ink-400">{totalMin > 0 ? fmtDuration(totalMin * 60) : '—'}</div>
        </div>
      )}
      <div className="relative border-l border-ink-100 dark:border-ink-900" style={{ height: totalHeight }}>
        {/* horizontal hour gridlines */}
        {Array.from({ length: endHour - startHour }).map((_, i) => (
          <div
            key={i}
            className="absolute left-0 right-0 border-t border-ink-100 dark:border-ink-900"
            style={{ top: i * PX_PER_HOUR }}
            aria-hidden
          />
        ))}
        {positioned.map(ps => {
          const project = projects.get(ps.pomodoro.projectId)
          const selected = selectedId === ps.pomodoro.id
          return (
            <button
              key={ps.pomodoro.id}
              onClick={() => onSelect(ps.pomodoro)}
              className={`absolute left-0.5 right-0.5 rounded-md text-left px-1.5 py-1 overflow-hidden transition shadow-sm hover:z-10 hover:shadow-md ${selected ? 'ring-2 ring-ink-900 dark:ring-ink-50 z-20' : ''}`}
              style={{
                top: ps.topPx,
                height: ps.heightPx,
                backgroundColor: `${project?.color ?? '#ff6a37'}26`,
                borderLeft: `3px solid ${project?.color ?? '#ff6a37'}`,
                opacity: ps.pomodoro.completed ? 1 : 0.65,
              }}
              title={`${project?.name ?? 'Unknown'} · ${fmtClock(ps.pomodoro.startedAt)} · ${fmtDuration(ps.pomodoro.actualSeconds)}${ps.pomodoro.completed ? '' : ' (aborted)'}`}
            >
              {ps.heightPx >= 24 ? (
                <>
                  <div className="text-[10px] font-medium leading-tight truncate" style={{ color: project?.color }}>
                    {ps.pomodoro.task || 'Focus'}
                  </div>
                  {ps.heightPx >= 40 && (
                    <div className="text-[9px] tabular text-ink-500 leading-tight mt-0.5">
                      {fmtClock(ps.pomodoro.startedAt)}
                    </div>
                  )}
                </>
              ) : (
                <div className="h-full w-full" />
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}

export function CalendarDaySchedule({
  date,
  sessions,
  projects,
  onSelect,
  selectedId,
}: {
  date: Date
  sessions: Pomodoro[]
  projects: Map<string, Project>
  onSelect: (p: Pomodoro) => void
  selectedId?: string | null
}) {
  const { startHour, endHour } = useMemo(() => autoRange(sessions), [sessions])
  return (
    <div className="flex">
      <HourRail startHour={startHour} endHour={endHour} />
      <DayColumn
        date={date}
        sessions={sessions}
        projects={projects}
        startHour={startHour}
        endHour={endHour}
        onSelect={onSelect}
        selectedId={selectedId}
      />
    </div>
  )
}

export function CalendarWeekSchedule({
  weekDays,
  sessionsByDay,
  projects,
  onSelect,
  selectedId,
}: {
  weekDays: Date[]
  sessionsByDay: Map<string, Pomodoro[]>
  projects: Map<string, Project>
  onSelect: (p: Pomodoro) => void
  selectedId?: string | null
}) {
  const allSessions = useMemo(() => {
    const out: Pomodoro[] = []
    for (const list of sessionsByDay.values()) out.push(...list)
    return out
  }, [sessionsByDay])
  const { startHour, endHour } = useMemo(() => autoRange(allSessions), [allSessions])

  return (
    <div className="overflow-x-auto -mx-1 px-1">
      <div className="flex min-w-[640px]">
        <HourRail startHour={startHour} endHour={endHour} />
        {weekDays.map(day => {
          const key = format(day, 'yyyy-MM-dd')
          const sessions = sessionsByDay.get(key) ?? []
          return (
            <DayColumn
              key={key}
              date={day}
              sessions={sessions}
              projects={projects}
              startHour={startHour}
              endHour={endHour}
              onSelect={onSelect}
              selectedId={selectedId}
              showHeader
              highlightToday
            />
          )
        })}
      </div>
    </div>
  )
}
