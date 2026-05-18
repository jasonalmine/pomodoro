// Supabase sync adapter. Dexie is the local cache; Supabase is the source of truth.
// Last-write-wins via updatedAt (epoch ms). Settings are stored as a JSON blob.

import type { User } from '@supabase/supabase-js'
import { db } from '../db'
import { supabase, supabaseEnabled } from './supabase'
import type { DayShutdown, Pomodoro, Project, Task, Template } from '../types'

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
  task_id: string | null
  task: string | null
  started_at: number
  ended_at: number | null
  planned_seconds: number | null
  actual_seconds: number | null
  completed: boolean | null
  flow_mode: boolean | null
  manual: boolean | null
  note: string | null
  note_done: string | null
  note_next: string | null
  ritual_used: boolean | null
  updated_at: number
}

type TaskRow = {
  id: string
  user_id: string
  project_id: string
  name: string
  est_pomodoros: number
  completed: boolean
  completed_at: number | null
  archived_at: number | null
  order: number
  created_at: number
  updated_at: number
}

type TemplateRow = {
  id: string
  user_id: string
  name: string
  project_id: string | null
  work_minutes: number
  short_break_minutes: number
  long_break_minutes: number
  use_ritual: boolean
  created_at: number
  updated_at: number
}

type DayShutdownRow = {
  id: string
  user_id: string
  date: number
  wins: string | null
  blockers: string | null
  tomorrow_project_id: string | null
  tomorrow_task: string | null
  tomorrow_minutes: number | null
  created_at: number
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
    task_id: p.taskId ?? null,
    task: p.task,
    started_at: p.startedAt,
    ended_at: p.endedAt,
    planned_seconds: p.plannedSeconds,
    actual_seconds: p.actualSeconds,
    completed: p.completed,
    flow_mode: p.flowMode ?? null,
    manual: p.manual ?? null,
    note: p.note ?? null,
    note_done: p.noteDone ?? null,
    note_next: p.noteNext ?? null,
    ritual_used: p.ritualUsed,
    updated_at: p.updatedAt,
  }
}

function rowToPomodoro(r: PomodoroRow): Pomodoro {
  return {
    id: r.id,
    projectId: r.project_id ?? '',
    taskId: r.task_id ?? undefined,
    task: r.task ?? '',
    startedAt: r.started_at,
    endedAt: r.ended_at ?? r.started_at,
    plannedSeconds: r.planned_seconds ?? 0,
    actualSeconds: r.actual_seconds ?? 0,
    completed: r.completed ?? false,
    flowMode: r.flow_mode ?? undefined,
    manual: r.manual ?? undefined,
    note: r.note ?? undefined,
    noteDone: r.note_done ?? undefined,
    noteNext: r.note_next ?? undefined,
    ritualUsed: r.ritual_used ?? false,
    updatedAt: r.updated_at,
  }
}

function taskToRow(t: Task, userId: string): TaskRow {
  return {
    id: t.id,
    user_id: userId,
    project_id: t.projectId,
    name: t.name,
    est_pomodoros: t.estPomodoros,
    completed: t.completed,
    completed_at: t.completedAt ?? null,
    archived_at: t.archivedAt ?? null,
    order: t.order,
    created_at: t.createdAt,
    updated_at: t.updatedAt,
  }
}

function rowToTask(r: TaskRow): Task {
  return {
    id: r.id,
    projectId: r.project_id,
    name: r.name,
    estPomodoros: r.est_pomodoros,
    completed: r.completed,
    completedAt: r.completed_at ?? undefined,
    archivedAt: r.archived_at ?? undefined,
    order: r.order,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }
}

function templateToRow(t: Template, userId: string): TemplateRow {
  return {
    id: t.id,
    user_id: userId,
    name: t.name,
    project_id: t.projectId ?? null,
    work_minutes: t.workMinutes,
    short_break_minutes: t.shortBreakMinutes,
    long_break_minutes: t.longBreakMinutes,
    use_ritual: t.useRitual,
    created_at: t.createdAt,
    updated_at: t.updatedAt,
  }
}

function rowToTemplate(r: TemplateRow): Template {
  return {
    id: r.id,
    name: r.name,
    projectId: r.project_id ?? undefined,
    workMinutes: r.work_minutes,
    shortBreakMinutes: r.short_break_minutes,
    longBreakMinutes: r.long_break_minutes,
    useRitual: r.use_ritual,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }
}

function dayShutdownToRow(d: DayShutdown, userId: string): DayShutdownRow {
  return {
    id: d.id,
    user_id: userId,
    date: d.date,
    wins: d.wins ?? null,
    blockers: d.blockers ?? null,
    tomorrow_project_id: d.tomorrowProjectId ?? null,
    tomorrow_task: d.tomorrowTask ?? null,
    tomorrow_minutes: d.tomorrowMinutes ?? null,
    created_at: d.createdAt,
    updated_at: d.updatedAt,
  }
}

function rowToDayShutdown(r: DayShutdownRow): DayShutdown {
  return {
    id: r.id,
    date: r.date,
    wins: r.wins ?? undefined,
    blockers: r.blockers ?? undefined,
    tomorrowProjectId: r.tomorrow_project_id ?? undefined,
    tomorrowTask: r.tomorrow_task ?? undefined,
    tomorrowMinutes: r.tomorrow_minutes ?? undefined,
    createdAt: r.created_at,
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
  const [projects, pomodoros, tasks, templates, shutdowns] = await Promise.all([
    db.projects.where('updatedAt').above(since).toArray(),
    db.pomodoros.where('updatedAt').above(since).toArray(),
    db.tasks.where('updatedAt').above(since).toArray(),
    db.templates.where('updatedAt').above(since).toArray(),
    db.dayShutdowns.where('updatedAt').above(since).toArray(),
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

  if (tasks.length) {
    const rows = tasks.map(t => taskToRow(t, userId))
    const { error } = await supabase.from('tasks').upsert(rows, { onConflict: 'id' })
    if (error) throw error
  }

  if (templates.length) {
    const rows = templates.map(t => templateToRow(t, userId))
    const { error } = await supabase.from('templates').upsert(rows, { onConflict: 'id' })
    if (error) throw error
  }

  if (shutdowns.length) {
    const rows = shutdowns.map(d => dayShutdownToRow(d, userId))
    const { error } = await supabase.from('day_shutdowns').upsert(rows, { onConflict: 'id' })
    if (error) throw error
  }
}

async function pullSince(userId: string, since: number): Promise<number> {
  if (!supabase) return since

  const [projRes, pomRes, taskRes, tmplRes, shutRes] = await Promise.all([
    supabase.from('projects').select('*').eq('user_id', userId).gt('updated_at', since),
    supabase.from('pomodoros').select('*').eq('user_id', userId).gt('updated_at', since),
    supabase.from('tasks').select('*').eq('user_id', userId).gt('updated_at', since),
    supabase.from('templates').select('*').eq('user_id', userId).gt('updated_at', since),
    supabase.from('day_shutdowns').select('*').eq('user_id', userId).gt('updated_at', since),
  ])

  if (projRes.error) throw projRes.error
  if (pomRes.error) throw pomRes.error
  if (taskRes.error) throw taskRes.error
  if (tmplRes.error) throw tmplRes.error
  if (shutRes.error) throw shutRes.error

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

  const taskRows = (taskRes.data ?? []) as TaskRow[]
  if (taskRows.length) {
    const local = await db.tasks.bulkGet(taskRows.map(r => r.id))
    const toPut: Task[] = []
    taskRows.forEach((r, i) => {
      const existing = local[i]
      if (!existing || existing.updatedAt < r.updated_at) {
        toPut.push(rowToTask(r))
      }
      if (r.updated_at > maxUpdated) maxUpdated = r.updated_at
    })
    if (toPut.length) await db.tasks.bulkPut(toPut)
  }

  const tmplRows = (tmplRes.data ?? []) as TemplateRow[]
  if (tmplRows.length) {
    const local = await db.templates.bulkGet(tmplRows.map(r => r.id))
    const toPut: Template[] = []
    tmplRows.forEach((r, i) => {
      const existing = local[i]
      if (!existing || existing.updatedAt < r.updated_at) {
        toPut.push(rowToTemplate(r))
      }
      if (r.updated_at > maxUpdated) maxUpdated = r.updated_at
    })
    if (toPut.length) await db.templates.bulkPut(toPut)
  }

  const shutRows = (shutRes.data ?? []) as DayShutdownRow[]
  if (shutRows.length) {
    const local = await db.dayShutdowns.bulkGet(shutRows.map(r => r.id))
    const toPut: DayShutdown[] = []
    shutRows.forEach((r, i) => {
      const existing = local[i]
      if (!existing || existing.updatedAt < r.updated_at) {
        toPut.push(rowToDayShutdown(r))
      }
      if (r.updated_at > maxUpdated) maxUpdated = r.updated_at
    })
    if (toPut.length) await db.dayShutdowns.bulkPut(toPut)
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
