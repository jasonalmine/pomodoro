import { differenceInCalendarDays, eachDayOfInterval, endOfWeek, format, startOfDay, startOfWeek } from 'date-fns'
import type { Pomodoro, Project } from '../types'

export type DailyTotal = {
  date: Date
  key: string
  seconds: number
  count: number
}

export function focusByDay(poms: Pomodoro[], start: Date, end: Date): DailyTotal[] {
  const days = eachDayOfInterval({ start, end })
  const map = new Map<string, { seconds: number; count: number }>()
  for (const d of days) map.set(format(d, 'yyyy-MM-dd'), { seconds: 0, count: 0 })
  for (const p of poms) {
    const key = format(new Date(p.startedAt), 'yyyy-MM-dd')
    const bucket = map.get(key)
    if (!bucket) continue
    bucket.seconds += p.actualSeconds
    bucket.count += 1
  }
  return days.map(d => {
    const key = format(d, 'yyyy-MM-dd')
    const v = map.get(key)!
    return { date: d, key, seconds: v.seconds, count: v.count }
  })
}

export function weekRange(now = new Date()): { start: Date; end: Date } {
  return {
    start: startOfWeek(now, { weekStartsOn: 1 }),
    end: endOfWeek(now, { weekStartsOn: 1 }),
  }
}

export function totalsInWindow(poms: Pomodoro[], start: number, end: number) {
  let seconds = 0
  let count = 0
  let completed = 0
  for (const p of poms) {
    if (p.startedAt < start || p.startedAt > end) continue
    seconds += p.actualSeconds
    count += 1
    if (p.completed) completed += 1
  }
  return { seconds, count, completed }
}

export function todayBounds(now = new Date()): { start: number; end: number } {
  const s = startOfDay(now).getTime()
  return { start: s, end: s + 24 * 60 * 60 * 1000 - 1 }
}

export type ProjectTotal = {
  project: Project
  seconds: number
  count: number
}

export function projectTotals(poms: Pomodoro[], projects: Project[], windowStart?: number): ProjectTotal[] {
  const byId = new Map<string, ProjectTotal>()
  for (const p of projects) byId.set(p.id, { project: p, seconds: 0, count: 0 })
  for (const p of poms) {
    if (windowStart != null && p.startedAt < windowStart) continue
    const entry = byId.get(p.projectId)
    if (!entry) continue
    entry.seconds += p.actualSeconds
    entry.count += 1
  }
  return [...byId.values()]
    .filter(e => e.seconds > 0)
    .sort((a, b) => b.seconds - a.seconds)
}

export function streakDays(poms: Pomodoro[], now = new Date()): number {
  if (poms.length === 0) return 0
  const completedDays = new Set<string>()
  for (const p of poms) {
    if (!p.completed) continue
    completedDays.add(format(new Date(p.startedAt), 'yyyy-MM-dd'))
  }
  if (completedDays.size === 0) return 0

  // Walk back from today (or yesterday if today has nothing yet) day by day until a gap.
  const today = startOfDay(now)
  const todayKey = format(today, 'yyyy-MM-dd')
  let cursor = today
  if (!completedDays.has(todayKey)) {
    // Allow streak to count yesterday-onward (today not yet logged).
    cursor = new Date(today.getTime() - 24 * 60 * 60 * 1000)
  }
  let streak = 0
  while (completedDays.has(format(cursor, 'yyyy-MM-dd'))) {
    streak += 1
    cursor = new Date(cursor.getTime() - 24 * 60 * 60 * 1000)
  }
  return streak
}

export function completionRate(poms: Pomodoro[]): { rate: number; completed: number; total: number } {
  const total = poms.length
  const completed = poms.filter(p => p.completed).length
  return { rate: total === 0 ? 0 : completed / total, completed, total }
}

export function daysSince(ts: number, now = Date.now()): number {
  return differenceInCalendarDays(now, ts)
}
