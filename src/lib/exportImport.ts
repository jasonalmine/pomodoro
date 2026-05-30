import { db, DEFAULT_SETTINGS } from '../db'
import type { DayNote, DayShutdown, Pomodoro, Project, Settings, Task } from '../types'

const EXPORT_VERSION = 1

export type ExportBundle = {
  version: number
  exportedAt: string
  projects: Project[]
  pomodoros: Pomodoro[]
  settings: Settings
  tasks?: Task[]
  dayShutdowns?: DayShutdown[]
  dayNotes?: DayNote[]
}

function todayStamp(): string {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`
}

function downloadBlob(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  setTimeout(() => {
    URL.revokeObjectURL(url)
    a.remove()
  }, 0)
}

function csvEscape(value: string | number | boolean | null | undefined): string {
  if (value == null) return ''
  const s = String(value)
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

export async function exportCsv() {
  const [projects, pomodoros] = await Promise.all([db.projects.toArray(), db.pomodoros.toArray()])
  const projectMap = new Map(projects.map(p => [p.id, p]))
  const headers = [
    'startedAt',
    'endedAt',
    'projectName',
    'projectColor',
    'task',
    'plannedSeconds',
    'actualSeconds',
    'completed',
    'ritualUsed',
    'note',
  ]
  const rows = pomodoros
    .sort((a, b) => a.startedAt - b.startedAt)
    .map(p => {
      const project = projectMap.get(p.projectId)
      return [
        new Date(p.startedAt).toISOString(),
        new Date(p.endedAt).toISOString(),
        project?.name ?? '(deleted project)',
        project?.color ?? '',
        p.task,
        p.plannedSeconds,
        p.actualSeconds,
        p.completed,
        p.ritualUsed,
        p.note ?? '',
      ].map(csvEscape).join(',')
    })
  const csv = [headers.join(','), ...rows].join('\n')
  downloadBlob(`pomodoro-sessions-${todayStamp()}.csv`, new Blob([csv], { type: 'text/csv;charset=utf-8' }))
}

export async function exportJson() {
  const [projects, pomodoros, settings, tasks, dayShutdowns, dayNotes] = await Promise.all([
    db.projects.toArray(),
    db.pomodoros.toArray(),
    db.settings.get('singleton'),
    db.tasks.toArray(),
    db.dayShutdowns.toArray(),
    db.dayNotes.toArray(),
  ])
  // Strip secrets from the exported settings; they should never leave the device.
  const safeSettings = ((): Settings => {
    const s = settings ?? DEFAULT_SETTINGS
    const { anthropicApiKey: _a, aiApiKey: _b, ...rest } = s
    void _a; void _b
    // The Maton key lives inside calendarSync — strip it but keep the prefs.
    if (rest.calendarSync) {
      const { matonApiKey: _c, ...calRest } = rest.calendarSync
      void _c
      rest.calendarSync = calRest as Settings['calendarSync']
    }
    return rest as Settings
  })()
  const bundle: ExportBundle = {
    version: EXPORT_VERSION,
    exportedAt: new Date().toISOString(),
    projects,
    pomodoros,
    settings: safeSettings,
    tasks,
    dayShutdowns,
    dayNotes,
  }
  downloadBlob(
    `pomodoro-backup-${todayStamp()}.json`,
    new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' }),
  )
}

export type ImportResult = {
  projects: number
  pomodoros: number
  tasks: number
  dayShutdowns: number
  dayNotes: number
  settingsRestored: boolean
}

export async function importJson(file: File): Promise<ImportResult> {
  const text = await file.text()
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    throw new Error('File is not valid JSON.')
  }
  const bundle = parsed as Partial<ExportBundle>
  if (!bundle || typeof bundle !== 'object' || bundle.version !== EXPORT_VERSION) {
    throw new Error(`Unrecognized export format (expected version ${EXPORT_VERSION}).`)
  }
  if (!Array.isArray(bundle.projects) || !Array.isArray(bundle.pomodoros)) {
    throw new Error('File is missing projects or pomodoros.')
  }

  const bundleTasks = Array.isArray(bundle.tasks) ? bundle.tasks : []
  const bundleShutdowns = Array.isArray(bundle.dayShutdowns) ? bundle.dayShutdowns : []
  const bundleNotes = Array.isArray(bundle.dayNotes) ? bundle.dayNotes : []

  await db.transaction('rw', [db.projects, db.pomodoros, db.settings, db.tasks, db.dayShutdowns, db.dayNotes], async () => {
    await db.projects.clear()
    await db.pomodoros.clear()
    await db.tasks.clear()
    await db.dayShutdowns.clear()
    await db.dayNotes.clear()
    const now = Date.now()
    const projects = (bundle.projects as Project[]).map(p => ({ ...p, updatedAt: p.updatedAt ?? p.createdAt ?? now }))
    const pomodoros = (bundle.pomodoros as Pomodoro[]).map(p => ({ ...p, updatedAt: p.updatedAt ?? p.endedAt ?? p.startedAt ?? now }))
    const tasks = (bundleTasks as Task[]).map(t => ({ ...t, updatedAt: t.updatedAt ?? t.createdAt ?? now }))
    const shutdowns = (bundleShutdowns as DayShutdown[]).map(d => ({ ...d, updatedAt: d.updatedAt ?? d.createdAt ?? now }))
    const notes = (bundleNotes as DayNote[]).map(n => ({ ...n, updatedAt: n.updatedAt ?? n.createdAt ?? now }))
    await db.projects.bulkPut(projects)
    await db.pomodoros.bulkPut(pomodoros)
    if (tasks.length) await db.tasks.bulkPut(tasks)
    if (shutdowns.length) await db.dayShutdowns.bulkPut(shutdowns)
    if (notes.length) await db.dayNotes.bulkPut(notes)
    if (bundle.settings) {
      // Exports strip on-device secrets (Maton key, AI keys). Preserve the live
      // ones so restoring your own backup doesn't silently wipe them and half-
      // break sync. settings is not cleared above, so `current` is still present.
      const current = await db.settings.get('singleton')
      const incoming = bundle.settings
      await db.settings.put({
        ...DEFAULT_SETTINGS,
        ...incoming,
        id: 'singleton',
        aiApiKey: incoming.aiApiKey ?? current?.aiApiKey,
        anthropicApiKey: incoming.anthropicApiKey ?? current?.anthropicApiKey,
        calendarSync: {
          ...DEFAULT_SETTINGS.calendarSync,
          ...current?.calendarSync,
          ...incoming.calendarSync,
          matonApiKey: incoming.calendarSync?.matonApiKey ?? current?.calendarSync?.matonApiKey,
        },
      })
    }
  })

  return {
    projects: bundle.projects.length,
    pomodoros: bundle.pomodoros.length,
    tasks: bundleTasks.length,
    dayShutdowns: bundleShutdowns.length,
    dayNotes: bundleNotes.length,
    settingsRestored: !!bundle.settings,
  }
}
