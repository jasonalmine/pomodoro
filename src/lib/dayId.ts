import { format } from 'date-fns'

/** Stable per-day id (yyyy-MM-dd) used by day shutdowns and day notes. */
export function todayShutdownId(now = new Date()): string {
  return format(now, 'yyyy-MM-dd')
}
