// Pure work-hours reminder logic (no React / store deps) so it can be reasoned
// about and tested in isolation. The stateful plumbing (interval, refs,
// notification delivery) lives in ../hooks/useWorkHoursReminder.

/** Minutes since local midnight for a Date. */
export function minutesOfDay(d: Date): number {
  return d.getHours() * 60 + d.getMinutes()
}

/**
 * True when `nowMin` is inside [start, end), handling a window that wraps past
 * midnight (end <= start, e.g. a 22:00–06:00 night shift). An empty window
 * (start === end) is never active.
 */
export function withinWorkWindow(nowMin: number, start: number, end: number): boolean {
  if (start === end) return false
  return start < end ? nowMin >= start && nowMin < end : nowMin >= start || nowMin < end
}

/**
 * Is the reminder window active for this clock + day config? `days` is indexed
 * by Date.getDay() (0 = Sunday … 6 = Saturday).
 */
export function isWorkWindowActive(now: Date, days: boolean[], start: number, end: number): boolean {
  return (days[now.getDay()] ?? false) && withinWorkWindow(minutesOfDay(now), start, end)
}

/** True once at least `intervalMin` (min 1) has elapsed since the last nudge. */
export function reminderDue(lastTs: number, nowTs: number, intervalMin: number): boolean {
  return nowTs - lastTs >= Math.max(1, intervalMin) * 60_000
}
