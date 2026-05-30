// Google Calendar sync via the Maton API gateway (https://api.maton.ai).
//
// Maton is a managed-OAuth passthrough: you bring a Maton API key, authorize
// your Google account once through Maton's connect flow, and Maton injects the
// Google OAuth token on every gateway request. So this file never touches
// Google credentials — it talks to `api.maton.ai/google-calendar/<native path>`
// with `Authorization: Bearer <MATON_API_KEY>`. The gateway sets permissive
// CORS headers, so this all runs from the browser (same BYO-key posture as the
// AI weekly review key in lib/ai.ts). The key lives on-device only.

import { format } from 'date-fns'
import { db, DEFAULT_SETTINGS } from '../db'
import type { CalendarSyncSettings, Pomodoro, Project } from '../types'

const MATON_BASE = 'https://api.maton.ai'
const APP = 'google-calendar'

// ---- error handling ---------------------------------------------------------

export type CalendarError = { status: number; message: string }

function calErr(status: number, message: string): CalendarError {
  return { status, message }
}

function isCalendarError(e: unknown): e is CalendarError {
  return !!e && typeof e === 'object' && 'status' in e && 'message' in e
}

export function calendarErrorMessage(e: unknown): string {
  if (isCalendarError(e)) return e.message
  if (e instanceof Error) return e.message
  return typeof e === 'string' ? e : 'Calendar request failed.'
}

// Maton / passthrough errors come back as JSON `{"error":{"message,type,code"}}`,
// but a target-API (Google) error passes through with Google's own shape
// `{"error":{"message","errors":[...]}}`. Pull the most useful message either way.
async function readError(res: Response): Promise<CalendarError> {
  let message = `HTTP ${res.status}`
  try {
    const j = await res.json()
    message = j?.error?.message || j?.message || JSON.stringify(j)
  } catch {
    try {
      const t = await res.text()
      if (t) message = t
    } catch { /* keep default */ }
  }
  if (res.status === 401) message = 'Maton API key is invalid or missing. Check the key in Settings.'
  else if (res.status === 400 && /connection/i.test(message)) {
    message = 'No active Google Calendar connection for this Maton key. Connect Google Calendar first.'
  } else if (res.status === 429) message = 'Maton rate limit hit. Try again in a moment.'
  return calErr(res.status, message)
}

function authHeaders(key: string, connectionId?: string, json = false): Record<string, string> {
  const h: Record<string, string> = { authorization: `Bearer ${key}` }
  if (json) h['content-type'] = 'application/json'
  if (connectionId) h['Maton-Connection'] = connectionId
  return h
}

async function matonFetch(
  key: string,
  path: string,
  init: RequestInit = {},
  connectionId?: string,
): Promise<Response> {
  if (!key) throw calErr(401, 'No Maton API key set.')
  const hasBody = init.body != null
  const extra = (init.headers as Record<string, string> | undefined) ?? {}
  const res = await fetch(`${MATON_BASE}${path}`, {
    ...init,
    headers: { ...authHeaders(key, connectionId, hasBody), ...extra },
  })
  return res
}

// ---- connections ------------------------------------------------------------

export type MatonConnection = {
  connection_id: string
  status: 'ACTIVE' | 'PENDING' | 'FAILED' | string
  app: string
  url?: string
  creation_time?: string
  last_updated_time?: string
}

export async function listConnections(key: string, status?: string): Promise<MatonConnection[]> {
  const q = new URLSearchParams({ app: APP })
  if (status) q.set('status', status)
  const res = await matonFetch(key, `/connections?${q.toString()}`)
  if (!res.ok) throw await readError(res)
  const json = (await res.json()) as { connections?: MatonConnection[] }
  return json.connections ?? []
}

export async function findActiveConnection(key: string): Promise<MatonConnection | null> {
  const active = await listConnections(key, 'ACTIVE')
  return active[0] ?? null
}

export async function createConnection(key: string): Promise<MatonConnection> {
  const res = await matonFetch(key, '/connections', {
    method: 'POST',
    body: JSON.stringify({ app: APP }),
  })
  if (!res.ok) throw await readError(res)
  const json = (await res.json()) as { connection?: MatonConnection }
  if (!json.connection?.url) throw calErr(0, 'Maton did not return an authorization URL.')
  return json.connection
}

export async function getConnection(key: string, connectionId: string): Promise<MatonConnection> {
  const res = await matonFetch(key, `/connections/${encodeURIComponent(connectionId)}`)
  if (!res.ok) throw await readError(res)
  const json = (await res.json()) as { connection?: MatonConnection }
  if (!json.connection) throw calErr(res.status, 'Connection not found.')
  return json.connection
}

// Poll a freshly-created connection until the user finishes Google OAuth in the
// popped tab. Resolves with the ACTIVE connection, or throws on timeout/failure.
export async function pollConnection(
  key: string,
  connectionId: string,
  opts: { intervalMs?: number; timeoutMs?: number; signal?: AbortSignal } = {},
): Promise<MatonConnection> {
  const intervalMs = opts.intervalMs ?? 2500
  const timeoutMs = opts.timeoutMs ?? 180_000
  const startedAt = Date.now()
  for (;;) {
    if (opts.signal?.aborted) throw calErr(0, 'Cancelled.')
    let conn: MatonConnection | null
    try {
      conn = await getConnection(key, connectionId)
    } catch (e) {
      // A bad/expired key (401/403) will never resolve by waiting, so surface it
      // immediately instead of spinning out the full timeout. Transient errors
      // (not-found-yet, network blip, 5xx, rate limit) fall through and retry.
      if (isCalendarError(e) && (e.status === 401 || e.status === 403)) throw e
      conn = null
    }
    if (conn?.status === 'ACTIVE') return conn
    if (conn?.status === 'FAILED') throw calErr(0, 'Google authorization failed. Try connecting again.')
    if (Date.now() - startedAt > timeoutMs) {
      throw calErr(0, 'Timed out waiting for Google authorization. Finish it in the opened tab, then check again.')
    }
    await new Promise((r) => setTimeout(r, intervalMs))
  }
}

// Non-destructive connection test: read the target calendar's metadata. Returns
// the calendar's display name (e.g. your email for `primary`).
export async function verifyCalendarAccess(
  key: string,
  calendarId = 'primary',
  connectionId?: string,
): Promise<string> {
  const res = await matonFetch(
    key,
    `/${APP}/calendar/v3/calendars/${encodeURIComponent(calendarId)}`,
    {},
    connectionId,
  )
  if (!res.ok) throw await readError(res)
  const json = (await res.json()) as { summary?: string; id?: string }
  return json.summary || json.id || calendarId
}

// ---- event building + writes ------------------------------------------------

type GoogleEvent = {
  summary: string
  description?: string
  start: { dateTime: string; timeZone: string }
  end: { dateTime: string; timeZone: string }
  transparency: 'opaque' | 'transparent'
  reminders: { useDefault: false }
  extendedProperties: { private: Record<string, string> }
}

function localTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
  } catch {
    return 'UTC'
  }
}

// date-fns 'XXX' renders the local UTC offset (e.g. +08:00), which is exactly
// what Google Calendar wants alongside an IANA timeZone.
function isoWithOffset(ms: number): string {
  return format(new Date(ms), "yyyy-MM-dd'T'HH:mm:ssXXX")
}

export function buildEventBody(
  pom: Pomodoro,
  project: Project | undefined,
  cfg: CalendarSyncSettings,
): GoogleEvent {
  const projectName = project?.name?.trim()
  const taskText = pom.task?.trim()
  const summary = projectName
    ? (taskText && taskText.toLowerCase() !== projectName.toLowerCase()
        ? `${projectName} — ${taskText}`
        : projectName)
    : (taskText || 'Focus session')

  const tz = localTimeZone()
  const minutes = Math.max(1, Math.round(pom.actualSeconds / 60))

  let description: string | undefined
  if (cfg.includeReflection) {
    const lines: string[] = []
    lines.push(`${minutes}m ${pom.flowMode ? 'flow' : 'focus'}${pom.ritualUsed ? ' (with ritual)' : ''}`)
    if (pom.noteDone) lines.push(`Finished: ${pom.noteDone}`)
    if (pom.noteNext) lines.push(`Next: ${pom.noteNext}`)
    if (pom.note) lines.push(pom.note)
    if (pom.tags?.length) lines.push(`Tags: ${pom.tags.join(', ')}`)
    if (pom.distractions) lines.push(`${pom.distractions} distraction${pom.distractions === 1 ? '' : 's'}`)
    lines.push('')
    lines.push('Logged by Pomodoro')
    description = lines.join('\n')
  }

  return {
    summary,
    description,
    start: { dateTime: isoWithOffset(pom.startedAt), timeZone: tz },
    end: { dateTime: isoWithOffset(pom.endedAt), timeZone: tz },
    transparency: cfg.markBusy ? 'opaque' : 'transparent',
    // A logged, already-finished block should never trigger a reminder.
    reminders: { useDefault: false },
    extendedProperties: { private: { pomodoroId: pom.id, app: 'pomodoro-focus' } },
  }
}

export async function createCalendarEvent(
  key: string,
  calendarId: string,
  body: GoogleEvent,
  connectionId?: string,
): Promise<{ id: string; htmlLink?: string }> {
  const res = await matonFetch(
    key,
    `/${APP}/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`,
    { method: 'POST', body: JSON.stringify(body) },
    connectionId,
  )
  if (!res.ok) throw await readError(res)
  const json = (await res.json()) as { id?: string; htmlLink?: string }
  if (!json.id) throw calErr(0, 'Calendar did not return an event id.')
  return { id: json.id, htmlLink: json.htmlLink }
}

export async function updateCalendarEvent(
  key: string,
  calendarId: string,
  eventId: string,
  body: GoogleEvent,
  connectionId?: string,
): Promise<void> {
  const res = await matonFetch(
    key,
    `/${APP}/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
    { method: 'PUT', body: JSON.stringify(body) },
    connectionId,
  )
  if (!res.ok) throw await readError(res)
}

export async function deleteCalendarEvent(
  key: string,
  calendarId: string,
  eventId: string,
  connectionId?: string,
): Promise<void> {
  const res = await matonFetch(
    key,
    `/${APP}/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
    { method: 'DELETE' },
    connectionId,
  )
  // 404/410 = already gone on Google's side; treat as success.
  if (!res.ok && res.status !== 404 && res.status !== 410) throw await readError(res)
}

// ---- settings + orchestration -----------------------------------------------

async function getCalendarSettings(): Promise<CalendarSyncSettings> {
  const row = await db.settings.get('singleton')
  return { ...DEFAULT_SETTINGS.calendarSync, ...row?.calendarSync }
}

function shouldSync(pom: Pomodoro, cfg: CalendarSyncSettings): boolean {
  if (!cfg.enabled || !cfg.matonApiKey) return false
  if (pom.deletedAt) return false
  if (pom.flowMode ? !cfg.syncFlow : !cfg.syncFocus) return false
  const minutes = pom.actualSeconds / 60
  if (minutes < (cfg.minMinutes || 0)) return false
  return true
}

// Module-level last-error + in-flight guard so the auto path can surface a
// status without throwing into the timer flow, and never double-creates.
let lastError: string | null = null
const inFlight = new Set<string>()

export function getLastCalendarError(): string | null {
  return lastError
}

export type SyncResult = 'created' | 'skipped' | 'already' | 'error'

// Push one Pomodoro to Google Calendar. Fire-and-forget safe: on the auto path
// (force=false) it swallows errors into module state. The manual/test paths
// pass `throwOnError` to surface failures in the UI.
export async function syncPomodoroToCalendar(
  pomodoroId: string,
  opts: { force?: boolean; throwOnError?: boolean } = {},
): Promise<SyncResult> {
  if (inFlight.has(pomodoroId)) return 'skipped'
  inFlight.add(pomodoroId)
  try {
    const cfg = await getCalendarSettings()
    const pom = await db.pomodoros.get(pomodoroId)
    if (!pom) return 'skipped'
    if (pom.calendarEventId && !opts.force) return 'already'
    if (!opts.force && !shouldSync(pom, cfg)) return 'skipped'
    // A key is the only hard requirement. The `enabled` master toggle gates the
    // AUTO path (via shouldSync above); an explicit force/manual add should work
    // even when auto-sync is off, since the user asked for this one directly.
    if (!cfg.matonApiKey) {
      if (opts.throwOnError) throw calErr(0, 'No Maton API key is set. Add one in Settings → Google Calendar.')
      return 'skipped'
    }

    const calId = cfg.calendarId || 'primary'
    const project = pom.projectId ? await db.projects.get(pom.projectId) : undefined
    const body = buildEventBody(pom, project, cfg)
    // Forcing a re-sync of an already-synced row would otherwise orphan the old
    // event (POST makes a new one). Remove the prior event first, best-effort.
    if (opts.force && pom.calendarEventId) {
      await deleteCalendarEvent(cfg.matonApiKey, calId, pom.calendarEventId, cfg.connectionId).catch(() => { /* best-effort */ })
    }
    const { id } = await createCalendarEvent(cfg.matonApiKey, calId, body, cfg.connectionId)
    const now = Date.now()
    try {
      await db.pomodoros.update(pomodoroId, { calendarEventId: id, calendarSyncedAt: now, updatedAt: now })
    } catch (dbErr) {
      // The event was created on Google but we failed to record its id locally.
      // Without the id, the next auto-sync / backfill would create a duplicate,
      // so remove the just-created event to keep things idempotent.
      await deleteCalendarEvent(cfg.matonApiKey, calId, id, cfg.connectionId).catch(() => { /* best-effort */ })
      throw dbErr
    }
    lastError = null
    return 'created'
  } catch (e) {
    lastError = calendarErrorMessage(e)
    if (opts.throwOnError) throw e
    // Auto path: log quietly, never disrupt the timer.
    console.warn('[calendar] sync failed:', lastError)
    return 'error'
  } finally {
    inFlight.delete(pomodoroId)
  }
}

// Best-effort: push the edited fields of an already-synced block to its
// existing Google event, so moving/retitling a synced session doesn't leave a
// stale calendar entry. No-op when the row isn't on the calendar.
export async function updatePomodoroCalendarEvent(pomodoroId: string): Promise<void> {
  const cfg = await getCalendarSettings()
  if (!cfg.matonApiKey) return
  const pom = await db.pomodoros.get(pomodoroId)
  if (!pom?.calendarEventId || pom.deletedAt) return
  try {
    const project = pom.projectId ? await db.projects.get(pom.projectId) : undefined
    const body = buildEventBody(pom, project, cfg)
    await updateCalendarEvent(cfg.matonApiKey, cfg.calendarId || 'primary', pom.calendarEventId, body, cfg.connectionId)
    const now = Date.now()
    await db.pomodoros.update(pomodoroId, { calendarSyncedAt: now, updatedAt: now })
    lastError = null
  } catch (e) {
    lastError = calendarErrorMessage(e)
    console.warn('[calendar] event update failed:', lastError)
  }
}

// Best-effort delete of the calendar event for a Pomodoro that's being deleted.
// Reads the row's stored eventId; no-op when there's nothing to remove.
export async function deletePomodoroCalendarEvent(pom: Pick<Pomodoro, 'calendarEventId'>): Promise<void> {
  if (!pom.calendarEventId) return
  const cfg = await getCalendarSettings()
  if (!cfg.matonApiKey) return
  try {
    await deleteCalendarEvent(cfg.matonApiKey, cfg.calendarId || 'primary', pom.calendarEventId, cfg.connectionId)
  } catch (e) {
    lastError = calendarErrorMessage(e)
    console.warn('[calendar] event delete failed:', lastError)
  }
}

// Backfill: push recent finished blocks that aren't on the calendar yet. Returns
// counts. Used by the "Sync recent sessions" button in Settings.
export async function backfillRecent(days = 7): Promise<{ created: number; failed: number; scanned: number }> {
  const cfg = await getCalendarSettings()
  if (!cfg.enabled || !cfg.matonApiKey) throw calErr(0, 'Turn on calendar sync and set a Maton key first.')
  const since = Date.now() - days * 24 * 60 * 60 * 1000
  const rows = await db.pomodoros.where('startedAt').above(since).toArray()
  const candidates = rows.filter((p) => !p.calendarEventId && shouldSync(p, cfg))
  let created = 0
  let failed = 0
  // Sequential to respect the 10 req/sec gateway limit comfortably.
  for (const p of candidates) {
    const r = await syncPomodoroToCalendar(p.id, { throwOnError: false })
    if (r === 'created') created++
    else if (r === 'error') failed++
  }
  return { created, failed, scanned: candidates.length }
}
