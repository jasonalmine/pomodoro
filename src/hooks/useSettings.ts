import { useLiveQuery } from 'dexie-react-hooks'
import { db, DEFAULT_SETTINGS } from '../db'
import type { CalendarSyncSettings, Settings } from '../types'

// Merge defaults into the loaded row so any field added in a newer version
// (e.g. timer.allowOvertime) gets a sane default instead of being undefined.
function withDefaults(s: Settings): Settings {
  return {
    ...DEFAULT_SETTINGS,
    ...s,
    timer: { ...DEFAULT_SETTINGS.timer, ...s.timer },
    ritual: { ...DEFAULT_SETTINGS.ritual, ...s.ritual },
    audio: { ...DEFAULT_SETTINGS.audio, ...s.audio },
    calendarSync: { ...DEFAULT_SETTINGS.calendarSync, ...s.calendarSync },
  }
}

export function useSettings(): Settings {
  const s = useLiveQuery(() => db.settings.get('singleton'), [], DEFAULT_SETTINGS)
  return withDefaults(s ?? DEFAULT_SETTINGS)
}

export async function updateSettings(patch: Partial<Settings>) {
  const cur = (await db.settings.get('singleton')) ?? DEFAULT_SETTINGS
  await db.settings.put({ ...cur, ...patch, id: 'singleton' })
}

// Deep-merge a partial calendarSync patch onto the FRESHLY-READ settings row.
// Reading from the DB at call time (instead of merging onto a captured render
// value) avoids lost updates when a write happens after an await — e.g. the
// connect() flow persisting connectionId up to 180s after the user opened it,
// during which other sub-settings may have changed.
export async function updateCalendarSync(patch: Partial<CalendarSyncSettings>) {
  const cur = (await db.settings.get('singleton')) ?? DEFAULT_SETTINGS
  const base = { ...DEFAULT_SETTINGS.calendarSync, ...cur.calendarSync }
  await db.settings.put({ ...cur, calendarSync: { ...base, ...patch }, id: 'singleton' })
}
