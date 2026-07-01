// Supabase sync adapter. Dexie is the local cache; Supabase is the source of truth.
// Last-write-wins via updatedAt (epoch ms). Settings are stored as a JSON blob.

import type { User, EmailOtpType } from '@supabase/supabase-js'
import { db } from '../db'
import { supabase, supabaseEnabled } from './supabase'
import { deletePomodoroCalendarEvent } from './calendar'
import type { DayNote, DayShutdown, Pomodoro, Project, Task, Template } from '../types'

const LAST_SYNC_KEY = 'pomodoro:lastSyncedAt'

type ProjectRow = {
  id: string
  user_id: string
  name: string
  color: string | null
  description: string | null
  archived: boolean
  weekly_goal_seconds: number | null
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
  distractions: number | null
  tags: string[] | null
  note: string | null
  note_done: string | null
  note_next: string | null
  ritual_used: boolean | null
  calendar_event_id: string | null
  calendar_synced_at: number | null
  deleted_at: number | null
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
  deleted_at: number | null
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

type DayNoteRow = {
  id: string
  user_id: string
  date: number
  content: string
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
    weekly_goal_seconds: p.weeklyGoalSeconds && p.weeklyGoalSeconds > 0 ? p.weeklyGoalSeconds : null,
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
    weeklyGoalSeconds: r.weekly_goal_seconds ?? undefined,
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
    distractions: p.distractions ?? null,
    tags: p.tags && p.tags.length ? p.tags : null,
    note: p.note ?? null,
    note_done: p.noteDone ?? null,
    note_next: p.noteNext ?? null,
    ritual_used: p.ritualUsed,
    calendar_event_id: p.calendarEventId ?? null,
    calendar_synced_at: p.calendarSyncedAt ?? null,
    deleted_at: p.deletedAt ?? null,
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
    distractions: r.distractions ?? undefined,
    tags: r.tags && r.tags.length ? r.tags : undefined,
    note: r.note ?? undefined,
    noteDone: r.note_done ?? undefined,
    noteNext: r.note_next ?? undefined,
    ritualUsed: r.ritual_used ?? false,
    calendarEventId: r.calendar_event_id ?? undefined,
    calendarSyncedAt: r.calendar_synced_at ?? undefined,
    deletedAt: r.deleted_at ?? undefined,
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
    deleted_at: t.deletedAt ?? null,
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
    deletedAt: r.deleted_at ?? undefined,
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

function dayNoteToRow(n: DayNote, userId: string): DayNoteRow {
  return {
    id: n.id,
    user_id: userId,
    date: n.date,
    content: n.content,
    created_at: n.createdAt,
    updated_at: n.updatedAt,
  }
}

function rowToDayNote(r: DayNoteRow): DayNote {
  return {
    id: r.id,
    date: r.date,
    content: r.content ?? '',
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

// Supabase / PostgREST returns plain error objects (not Error instances), so
// throwing them directly results in `[object Object]` once `String(e)` runs in
// the catch site. Normalize every throw into a real Error with the most
// informative message we can extract (PostgREST adds `details`/`hint`/`code`).
function toError(e: unknown, fallback = 'Request failed'): Error {
  if (e instanceof Error) return e
  if (e && typeof e === 'object') {
    const o = e as { message?: unknown; details?: unknown; hint?: unknown; code?: unknown }
    const parts = [o.message, o.details, o.hint].filter(p => typeof p === 'string' && p) as string[]
    const codeSuffix = typeof o.code === 'string' && o.code ? ` [${o.code}]` : ''
    if (parts.length) return new Error(parts.join(' · ') + codeSuffix)
    try { return new Error(JSON.stringify(e)) } catch { /* fallthrough */ }
  }
  return new Error(typeof e === 'string' && e ? e : fallback)
}

export async function signInWithEmail(email: string): Promise<void> {
  if (!supabase) throw new Error('Cloud sync is not configured.')
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: window.location.origin },
  })
  if (error) throw toError(error)
}

// Complete sign-in from the OTP email. The magic *link* can't round-trip into the
// desktop shell (its origin is tauri://localhost, which a browser can't open), so
// `input` accepts either:
//   1. the full login link pasted from the email (we pull the token out of it), or
//   2. a 6-digit code (if the email template exposes {{ .Token }}).
// Both also work on the web. No Supabase email-template change is required for (1).
export async function verifyEmailOtp(email: string, input: string): Promise<void> {
  if (!supabase) throw new Error('Cloud sync is not configured.')
  const trimmed = input.trim()

  // Pasted login link → extract the one-time token / session from the URL.
  if (/^https?:\/\//i.test(trimmed) || trimmed.includes('token')) {
    let u: URL | null
    try { u = new URL(trimmed) } catch { u = null }
    if (u) {
      // Some links deliver an already-minted session in the hash fragment.
      const hash = new URLSearchParams(u.hash.replace(/^#/, ''))
      const access_token = hash.get('access_token')
      const refresh_token = hash.get('refresh_token')
      if (access_token && refresh_token) {
        const { error } = await supabase.auth.setSession({ access_token, refresh_token })
        if (error) throw toError(error)
        return
      }
      // Otherwise it's a verify link carrying a one-time token hash.
      const token_hash = u.searchParams.get('token_hash') || u.searchParams.get('token')
      const type = (u.searchParams.get('type') || 'email') as EmailOtpType
      if (token_hash) {
        const { error } = await supabase.auth.verifyOtp({ token_hash, type })
        if (error) throw toError(error)
        return
      }
    }
  }

  // Fall back to treating the input as a 6-digit code.
  const { error } = await supabase.auth.verifyOtp({
    email: email.trim(),
    token: trimmed,
    type: 'email',
  })
  if (error) throw toError(error)
}

export async function signOut(): Promise<void> {
  if (!supabase) return
  await supabase.auth.signOut()
  localStorage.removeItem(LAST_SYNC_KEY)
}

async function pushDirty(userId: string, since: number): Promise<void> {
  if (!supabase) return
  const [projects, pomodoros, tasks, templates, shutdowns, notes] = await Promise.all([
    db.projects.where('updatedAt').above(since).toArray(),
    db.pomodoros.where('updatedAt').above(since).toArray(),
    db.tasks.where('updatedAt').above(since).toArray(),
    db.templates.where('updatedAt').above(since).toArray(),
    db.dayShutdowns.where('updatedAt').above(since).toArray(),
    db.dayNotes.where('updatedAt').above(since).toArray(),
  ])

  if (projects.length) {
    const rows = projects.map(p => projectToRow(p, userId))
    const { error } = await supabase.from('projects').upsert(rows, { onConflict: 'id' })
    if (error) throw toError(error)
  }

  if (pomodoros.length) {
    const rows = pomodoros.map(p => pomodoroToRow(p, userId))
    const { error } = await supabase.from('pomodoros').upsert(rows, { onConflict: 'id' })
    if (error) throw toError(error)
  }

  if (tasks.length) {
    const rows = tasks.map(t => taskToRow(t, userId))
    const { error } = await supabase.from('tasks').upsert(rows, { onConflict: 'id' })
    if (error) throw toError(error)
  }

  if (templates.length) {
    const rows = templates.map(t => templateToRow(t, userId))
    const { error } = await supabase.from('templates').upsert(rows, { onConflict: 'id' })
    if (error) throw toError(error)
  }

  if (shutdowns.length) {
    const rows = shutdowns.map(d => dayShutdownToRow(d, userId))
    const { error } = await supabase.from('day_shutdowns').upsert(rows, { onConflict: 'id' })
    if (error) throw toError(error)
  }

  if (notes.length) {
    const rows = notes.map(n => dayNoteToRow(n, userId))
    const { error } = await supabase.from('day_notes').upsert(rows, { onConflict: 'id' })
    if (error) throw toError(error)
  }
}

async function pullSince(userId: string, since: number): Promise<number> {
  if (!supabase) return since

  const [projRes, pomRes, taskRes, tmplRes, shutRes, noteRes] = await Promise.all([
    supabase.from('projects').select('*').eq('user_id', userId).gt('updated_at', since),
    supabase.from('pomodoros').select('*').eq('user_id', userId).gt('updated_at', since),
    supabase.from('tasks').select('*').eq('user_id', userId).gt('updated_at', since),
    supabase.from('templates').select('*').eq('user_id', userId).gt('updated_at', since),
    supabase.from('day_shutdowns').select('*').eq('user_id', userId).gt('updated_at', since),
    supabase.from('day_notes').select('*').eq('user_id', userId).gt('updated_at', since),
  ])

  if (projRes.error) throw toError(projRes.error)
  if (pomRes.error) throw toError(pomRes.error)
  if (taskRes.error) throw toError(taskRes.error)
  if (tmplRes.error) throw toError(tmplRes.error)
  if (shutRes.error) throw toError(shutRes.error)
  if (noteRes.error) throw toError(noteRes.error)

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

  const noteRows = (noteRes.data ?? []) as DayNoteRow[]
  if (noteRows.length) {
    const local = await db.dayNotes.bulkGet(noteRows.map(r => r.id))
    const toPut: DayNote[] = []
    noteRows.forEach((r, i) => {
      const existing = local[i]
      if (!existing || existing.updatedAt < r.updated_at) {
        toPut.push(rowToDayNote(r))
      }
      if (r.updated_at > maxUpdated) maxUpdated = r.updated_at
    })
    if (toPut.length) await db.dayNotes.bulkPut(toPut)
  }

  return maxUpdated
}

// Soft-delete a Pomodoro everywhere. Sets `deletedAt` + bumps `updatedAt`
// locally so the UI updates immediately and the normal sync push picks the
// tombstone up; reading code treats `deletedAt != null` as gone. Other
// signed-in devices learn about the deletion on their next pull.
export async function deletePomodoroEverywhere(id: string): Promise<void> {
  // Capture the calendar event id before tombstoning so we can remove it from
  // Google Calendar too (best-effort; the await keeps it before any throw).
  const existing = await db.pomodoros.get(id)
  const now = Date.now()
  await db.pomodoros.update(id, { deletedAt: now, updatedAt: now })
  if (existing?.calendarEventId) await deletePomodoroCalendarEvent(existing)
  // Best-effort immediate push of just this row so the deletion isn't
  // stuck behind the next sync cycle.
  if (!supabase) return
  const user = await getCurrentUser()
  if (!user) return
  const local = await db.pomodoros.get(id)
  if (!local) return
  const { error } = await supabase.from('pomodoros').upsert(pomodoroToRow(local, user.id), { onConflict: 'id' })
  if (error) throw toError(error)
}

// Soft-delete a Task. Mirrors deletePomodoroEverywhere.
export async function deleteTaskEverywhere(id: string): Promise<void> {
  const now = Date.now()
  await db.tasks.update(id, { deletedAt: now, updatedAt: now })
  if (!supabase) return
  const user = await getCurrentUser()
  if (!user) return
  const local = await db.tasks.get(id)
  if (!local) return
  const { error } = await supabase.from('tasks').upsert(taskToRow(local, user.id), { onConflict: 'id' })
  if (error) throw toError(error)
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
