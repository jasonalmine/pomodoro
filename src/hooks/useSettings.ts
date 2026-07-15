import { useLiveQuery } from 'dexie-react-hooks'
import { db, DEFAULT_SETTINGS } from '../db'
import type { CalendarSyncSettings, Palette, Settings, WorkHoursSettings } from '../types'

// Legacy palette ids (pre pastel refresh) → nearest current palette.
const PALETTE_MIGRATE: Record<string, Palette> = { ember: 'coral', pine: 'sage' }

// Merge defaults into the loaded row so any field added in a newer version
// (e.g. timer.allowOvertime) gets a sane default instead of being undefined.
function withDefaults(s: Settings): Settings {
  return {
    ...DEFAULT_SETTINGS,
    ...s,
    palette: PALETTE_MIGRATE[s.palette] ?? s.palette ?? DEFAULT_SETTINGS.palette,
    timer: { ...DEFAULT_SETTINGS.timer, ...s.timer },
    ritual: { ...DEFAULT_SETTINGS.ritual, ...s.ritual },
    audio: { ...DEFAULT_SETTINGS.audio, ...s.audio },
    calendarSync: { ...DEFAULT_SETTINGS.calendarSync, ...s.calendarSync },
    workHours: { ...DEFAULT_SETTINGS.workHours, ...s.workHours },
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

// Deep-merge a partial workHours patch onto the freshly-read settings row, same
// lost-update-safe pattern as updateCalendarSync.
export async function updateWorkHours(patch: Partial<WorkHoursSettings>) {
  const cur = (await db.settings.get('singleton')) ?? DEFAULT_SETTINGS
  const base = { ...DEFAULT_SETTINGS.workHours, ...cur.workHours }
  await db.settings.put({ ...cur, workHours: { ...base, ...patch }, id: 'singleton' })
}

// Flip a single active-day index against the FRESHLY-READ row so rapid toggles
// of different days compose instead of clobbering each other (the whole-array
// patch above can't protect a read-modify-write on the array itself).
export async function toggleWorkDay(index: number) {
  // Read-modify-write inside one rw transaction so two rapid toggles of
  // different days can't interleave their get/put and drop one another.
  await db.transaction('rw', db.settings, async () => {
    const cur = (await db.settings.get('singleton')) ?? DEFAULT_SETTINGS
    const base = { ...DEFAULT_SETTINGS.workHours, ...cur.workHours }
    const days = [...base.days]
    days[index] = !days[index]
    await db.settings.put({ ...cur, workHours: { ...base, days }, id: 'singleton' })
  })
}
