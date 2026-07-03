import { differenceInCalendarDays, eachDayOfInterval, endOfWeek, format, startOfDay, startOfWeek, subWeeks } from 'date-fns'
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

export type LifetimeStats = {
  seconds: number
  sessions: number
  bestStreak: number
  bestDay: { date: string; seconds: number } | null
  topProject: { project: Project; seconds: number } | null
  averagePerDay: number
  firstSession: number | null
}

export function lifetimeStats(poms: Pomodoro[], projects: Project[]): LifetimeStats {
  if (poms.length === 0) {
    return { seconds: 0, sessions: 0, bestStreak: 0, bestDay: null, topProject: null, averagePerDay: 0, firstSession: null }
  }
  let seconds = 0
  const perDay = new Map<string, number>()
  const perProj = new Map<string, number>()
  let firstSession: number | null = null
  for (const p of poms) {
    seconds += p.actualSeconds
    const dayKey = format(new Date(p.startedAt), 'yyyy-MM-dd')
    perDay.set(dayKey, (perDay.get(dayKey) ?? 0) + p.actualSeconds)
    if (p.projectId) perProj.set(p.projectId, (perProj.get(p.projectId) ?? 0) + p.actualSeconds)
    if (firstSession == null || p.startedAt < firstSession) firstSession = p.startedAt
  }
  let bestDay: { date: string; seconds: number } | null = null
  for (const [date, secs] of perDay) {
    if (!bestDay || secs > bestDay.seconds) bestDay = { date, seconds: secs }
  }
  let topProjectId: string | null = null
  let topProjectSec = 0
  for (const [id, secs] of perProj) {
    if (secs > topProjectSec) { topProjectId = id; topProjectSec = secs }
  }
  const topProject = topProjectId ? projects.find(p => p.id === topProjectId) : null
  const bestStreak = computeBestStreak(poms)
  const daysActive = perDay.size || 1
  const averagePerDay = Math.round(seconds / daysActive)
  return {
    seconds,
    sessions: poms.length,
    bestStreak,
    bestDay,
    topProject: topProject ? { project: topProject, seconds: topProjectSec } : null,
    averagePerDay,
    firstSession,
  }
}

function computeBestStreak(poms: Pomodoro[]): number {
  const completedDays = new Set<string>()
  for (const p of poms) {
    if (!p.completed) continue
    completedDays.add(format(new Date(p.startedAt), 'yyyy-MM-dd'))
  }
  if (completedDays.size === 0) return 0
  const sorted = [...completedDays].sort()
  let best = 1
  let cur = 1
  for (let i = 1; i < sorted.length; i++) {
    const prev = new Date(sorted[i - 1]).getTime()
    const cdate = new Date(sorted[i]).getTime()
    const diffDays = Math.round((cdate - prev) / (24 * 60 * 60 * 1000))
    if (diffDays === 1) { cur += 1; best = Math.max(best, cur) }
    else { cur = 1 }
  }
  return best
}

// 365-day heatmap ending today.
export function yearlyHeatmap(poms: Pomodoro[], now = new Date()): Array<{ date: Date; key: string; seconds: number; count: number }> {
  const end = startOfDay(now)
  const start = new Date(end.getTime() - 364 * 24 * 60 * 60 * 1000)
  const days = eachDayOfInterval({ start, end })
  const map = new Map<string, { seconds: number; count: number }>()
  for (const d of days) map.set(format(d, 'yyyy-MM-dd'), { seconds: 0, count: 0 })
  for (const p of poms) {
    const key = format(new Date(p.startedAt), 'yyyy-MM-dd')
    const b = map.get(key)
    if (!b) continue
    b.seconds += p.actualSeconds
    b.count += 1
  }
  return days.map(d => {
    const key = format(d, 'yyyy-MM-dd')
    const v = map.get(key)!
    return { date: d, key, seconds: v.seconds, count: v.count }
  })
}

// Focused seconds bucketed by start hour (24 buckets), optionally windowed.
export function focusByHour(poms: Pomodoro[], windowStartMs?: number): number[] {
  const buckets = new Array<number>(24).fill(0)
  for (const p of poms) {
    if (windowStartMs != null && p.startedAt < windowStartMs) continue
    buckets[new Date(p.startedAt).getHours()] += p.actualSeconds
  }
  return buckets
}

export type WeeklyTotal = {
  weekStart: Date
  seconds: number
  count: number
}

// Focused totals for the last N ISO weeks (Mon-Sun), oldest first, current week last.
// Calendar-aware (subWeeks/startOfWeek) so DST transitions can't skew buckets or labels.
export function weeklyTotals(poms: Pomodoro[], weeks = 8, now = new Date()): WeeklyTotal[] {
  const current = startOfWeek(now, { weekStartsOn: 1 })
  const out: WeeklyTotal[] = []
  const byStart = new Map<number, WeeklyTotal>()
  for (let i = weeks - 1; i >= 0; i--) {
    const weekStart = subWeeks(current, i)
    const entry: WeeklyTotal = { weekStart, seconds: 0, count: 0 }
    out.push(entry)
    byStart.set(weekStart.getTime(), entry)
  }
  for (const p of poms) {
    const entry = byStart.get(startOfWeek(new Date(p.startedAt), { weekStartsOn: 1 }).getTime())
    if (!entry) continue
    entry.seconds += p.actualSeconds
    entry.count += 1
  }
  return out
}

// Seconds a session ran past its plan. Zero for flow (no plan boundary),
// manual entries (planned == actual by construction), and aborted sessions.
// The single home for the "+Xm" badge predicate.
export function overtimeSec(p: Pomodoro): number {
  if (p.flowMode || p.manual || !p.completed) return 0
  return Math.max(0, p.actualSeconds - p.plannedSeconds)
}

// Count of Pomodoros logged against each taskId (any completion state).
export function pomodorosByTask(poms: Pomodoro[]): Map<string, number> {
  const m = new Map<string, number>()
  for (const p of poms) {
    if (!p.taskId) continue
    m.set(p.taskId, (m.get(p.taskId) ?? 0) + 1)
  }
  return m
}

// Most-recently-used distinct tags across the last N pomodoros, ordered by
// frequency-then-recency.
export function recentTags(poms: Pomodoro[], limit = 8): string[] {
  const sorted = [...poms].sort((a, b) => b.startedAt - a.startedAt).slice(0, 200)
  const score = new Map<string, { count: number; latest: number }>()
  for (const p of sorted) {
    if (!p.tags) continue
    for (const raw of p.tags) {
      const t = raw.trim().toLowerCase()
      if (!t) continue
      const e = score.get(t) ?? { count: 0, latest: 0 }
      e.count += 1
      e.latest = Math.max(e.latest, p.startedAt)
      score.set(t, e)
    }
  }
  return [...score.entries()]
    .sort((a, b) => (b[1].count - a[1].count) || (b[1].latest - a[1].latest))
    .slice(0, limit)
    .map(([t]) => t)
}

// Most-recent distinct task strings from completed Pomodoros, newest first.
export function recentTasks(poms: Pomodoro[], limit = 3): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  const sorted = [...poms].sort((a, b) => b.startedAt - a.startedAt)
  for (const p of sorted) {
    const t = (p.task || '').trim()
    if (!t || t === 'Focus session') continue
    const key = t.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(t)
    if (out.length >= limit) break
  }
  return out
}
