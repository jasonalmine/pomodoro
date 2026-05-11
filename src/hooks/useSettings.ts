import { useLiveQuery } from 'dexie-react-hooks'
import { db, DEFAULT_SETTINGS } from '../db'
import type { Settings } from '../types'

export function useSettings(): Settings {
  const s = useLiveQuery(() => db.settings.get('singleton'), [], DEFAULT_SETTINGS)
  return s ?? DEFAULT_SETTINGS
}

export async function updateSettings(patch: Partial<Settings>) {
  const cur = (await db.settings.get('singleton')) ?? DEFAULT_SETTINGS
  await db.settings.put({ ...cur, ...patch, id: 'singleton' })
}
