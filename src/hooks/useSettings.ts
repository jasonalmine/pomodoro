import { useLiveQuery } from 'dexie-react-hooks'
import { db, DEFAULT_SETTINGS } from '../db'
import type { Settings } from '../types'

// Merge defaults into the loaded row so any field added in a newer version
// (e.g. timer.allowOvertime) gets a sane default instead of being undefined.
function withDefaults(s: Settings): Settings {
  return {
    ...DEFAULT_SETTINGS,
    ...s,
    timer: { ...DEFAULT_SETTINGS.timer, ...s.timer },
    ritual: { ...DEFAULT_SETTINGS.ritual, ...s.ritual },
    audio: { ...DEFAULT_SETTINGS.audio, ...s.audio },
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
