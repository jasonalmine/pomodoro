import { db, DEFAULT_SETTINGS } from '../db'
import type { Pomodoro, Project, Settings } from '../types'

const EXPORT_VERSION = 1

export type ExportBundle = {
  version: number
  exportedAt: string
  projects: Project[]
  pomodoros: Pomodoro[]
  settings: Settings
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
  const [projects, pomodoros, settings] = await Promise.all([
    db.projects.toArray(),
    db.pomodoros.toArray(),
    db.settings.get('singleton'),
  ])
  const bundle: ExportBundle = {
    version: EXPORT_VERSION,
    exportedAt: new Date().toISOString(),
    projects,
    pomodoros,
    settings: settings ?? DEFAULT_SETTINGS,
  }
  downloadBlob(
    `pomodoro-backup-${todayStamp()}.json`,
    new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' }),
  )
}

export type ImportResult = {
  projects: number
  pomodoros: number
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

  await db.transaction('rw', db.projects, db.pomodoros, db.settings, async () => {
    await db.projects.clear()
    await db.pomodoros.clear()
    const now = Date.now()
    const projects = (bundle.projects as Project[]).map(p => ({ ...p, updatedAt: p.updatedAt ?? p.createdAt ?? now }))
    const pomodoros = (bundle.pomodoros as Pomodoro[]).map(p => ({ ...p, updatedAt: p.updatedAt ?? p.endedAt ?? p.startedAt ?? now }))
    await db.projects.bulkPut(projects)
    await db.pomodoros.bulkPut(pomodoros)
    if (bundle.settings) {
      await db.settings.put({ ...DEFAULT_SETTINGS, ...bundle.settings, id: 'singleton' })
    }
  })

  return {
    projects: bundle.projects.length,
    pomodoros: bundle.pomodoros.length,
    settingsRestored: !!bundle.settings,
  }
}
