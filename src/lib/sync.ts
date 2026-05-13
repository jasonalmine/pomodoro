// Supabase sync adapter. Dexie is the local cache; Supabase is the source of truth.
// Last-write-wins via updatedAt (epoch ms). Settings are stored as a JSON blob.

import type { User } from '@supabase/supabase-js'
import { db } from '../db'
import { supabase, supabaseEnabled } from './supabase'
import type { Pomodoro, Project } from '../types'

const LAST_SYNC_KEY = 'pomodoro:lastSyncedAt'

type ProjectRow = {
  id: string
  user_id: string
  name: string
  color: string | null
  description: string | null
  archived: boolean
  created_at: number
  updated_at: number
}

type PomodoroRow = {
  id: string
  user_id: string
  project_id: string | null
  task: string | null
  started_at: number
  ended_at: number | null
  planned_seconds: number | null
  actual_seconds: number | null
  completed: boolean | null
  note: string | null
  ritual_used: boolean | null
  updated_at: number
}

function projectToRow(p: Project, userId: string): ProjectRow {
  return {
    id: p.id,
    user_id: userId,
    name: p.name,
    color: p.color,
    description: p.description ?? null,
    archived: p.archived,
    created_at: p.createdAt,
    updated_at: p.updatedAt,
  }
}

function rowToProject(r: ProjectRow): Project {
  return {
    id: r.id,
    name: r.name,
    color: r.color ?? '#ff6a37',
    description: r.description ?? undefined,
    archived: r.archived,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }
}

function pomodoroToRow(p: Pomodoro, userId: string): PomodoroRow {
  return {
    id: p.id,
    user_id: userId,
    project_id: p.projectId || null,
    task: p.task,
    started_at: p.startedAt,
    ended_at: p.endedAt,
    planned_seconds: p.plannedSeconds,
    actual_seconds: p.actualSeconds,
    completed: p.completed,
    note: p.note ?? null,
    ritual_used: p.ritualUsed,
    updated_at: p.updatedAt,
  }
}

function rowToPomodoro(r: PomodoroRow): Pomodoro {
  return {
    id: r.id,
    projectId: r.project_id ?? '',
    task: r.task ?? '',
    startedAt: r.started_at,
    endedAt: r.ended_at ?? r.started_at,
    plannedSeconds: r.planned_seconds ?? 0,
    actualSeconds: r.actual_seconds ?? 0,
    completed: r.completed ?? false,
    note: r.note ?? undefined,
    ritualUsed: r.ritual_used ?? false,
    updatedAt: r.updated_at,
  }
}

export type SyncStatus = 'idle' | 'syncing' | 'error'

let syncing = false
let lastError: string | null = null

export function getLastSyncedAt(): number {
  const raw = localStorage.getItem(LAST_SYNC_KEY)
  return raw ? Number(raw) || 0 : 0
}

function setLastSyncedAt(ms: number) {
  localStorage.setItem(LAST_SYNC_KEY, String(ms))
}

export function getLastError(): string | null {
  return lastError
}

export function isSyncing(): boolean {
  return syncing
}

export async function getCurrentUser(): Promise<User | null> {
  if (!supabase) return null
  const { data } = await supabase.auth.getUser()
  return data.user ?? null
}

export async function signInWithEmail(email: string): Promise<void> {
  if (!supabase) throw new Error('Cloud sync is not configured.')
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: window.location.origin },
  })
  if (error) throw error
}

export async function signOut(): Promise<void> {
  if (!supabase) return
  await supabase.auth.signOut()
  localStorage.removeItem(LAST_SYNC_KEY)
}

async function pushDirty(userId: string, since: number): Promise<void> {
  if (!supabase) return
  const [projects, pomodoros] = await Promise.all([
    db.projects.where('updatedAt').above(since).toArray(),
    db.pomodoros.where('updatedAt').above(since).toArray(),
  ])

  if (projects.length) {
    const rows = projects.map(p => projectToRow(p, userId))
    const { error } = await supabase.from('projects').upsert(rows, { onConflict: 'id' })
    if (error) throw error
  }

  if (pomodoros.length) {
    const rows = pomodoros.map(p => pomodoroToRow(p, userId))
    const { error } = await supabase.from('pomodoros').upsert(rows, { onConflict: 'id' })
    if (error) throw error
  }
}

async function pullSince(userId: string, since: number): Promise<number> {
  if (!supabase) return since

  const [projRes, pomRes] = await Promise.all([
    supabase.from('projects').select('*').eq('user_id', userId).gt('updated_at', since),
    supabase.from('pomodoros').select('*').eq('user_id', userId).gt('updated_at', since),
  ])

  if (projRes.error) throw projRes.error
  if (pomRes.error) throw pomRes.error

  let maxUpdated = since

  const projectRows = (projRes.data ?? []) as ProjectRow[]
  if (projectRows.length) {
    const local = await db.projects.bulkGet(projectRows.map(r => r.id))
    const toPut: Project[] = []
    projectRows.forEach((r, i) => {
      const existing = local[i]
      if (!existing || existing.updatedAt < r.updated_at) {
        toPut.push(rowToProject(r))
      }
      if (r.updated_at > maxUpdated) maxUpdated = r.updated_at
    })
    if (toPut.length) await db.projects.bulkPut(toPut)
  }

  const pomRows = (pomRes.data ?? []) as PomodoroRow[]
  if (pomRows.length) {
    const local = await db.pomodoros.bulkGet(pomRows.map(r => r.id))
    const toPut: Pomodoro[] = []
    pomRows.forEach((r, i) => {
      const existing = local[i]
      if (!existing || existing.updatedAt < r.updated_at) {
        toPut.push(rowToPomodoro(r))
      }
      if (r.updated_at > maxUpdated) maxUpdated = r.updated_at
    })
    if (toPut.length) await db.pomodoros.bulkPut(toPut)
  }

  return maxUpdated
}

export async function syncNow(): Promise<void> {
  if (!supabaseEnabled || syncing) return
  const user = await getCurrentUser()
  if (!user) return
  syncing = true
  lastError = null
  try {
    const since = getLastSyncedAt()
    // Push first so a fresh device doesn't appear to wipe local data.
    await pushDirty(user.id, since)
    const maxPulled = await pullSince(user.id, since)
    setLastSyncedAt(Math.max(since, maxPulled, Date.now()))
  } catch (e) {
    lastError = e instanceof Error ? e.message : String(e)
    throw e
  } finally {
    syncing = false
  }
}

export { supabaseEnabled }
