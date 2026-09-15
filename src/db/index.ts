import Dexie, { type Table } from 'dexie'
import type {
  DayNote,
  DayShutdown,
  Pomodoro,
  Project,
  Settings,
  Task,
  Template,
  WeeklyReview,
  WorkHoursSettings,
} from '../types'
import { supabaseEnabled } from '../lib/supabase'
import { crumb } from '../lib/breadcrumb'

class PomodoroDB extends Dexie {
  projects!: Table<Project, string>
  pomodoros!: Table<Pomodoro, string>
  settings!: Table<Settings, string>
  templates!: Table<Template, string>
  tasks!: Table<Task, string>
  dayShutdowns!: Table<DayShutdown, string>
  weeklyReviews!: Table<WeeklyReview, string>
  dayNotes!: Table<DayNote, string>

  constructor() {
    super('pomodoro')
    this.version(1).stores({
      projects: 'id, name, archived, createdAt',
      pomodoros: 'id, projectId, startedAt, endedAt, completed',
      settings: 'id',
    })
    this.version(2)
      .stores({
        projects: 'id, name, archived, createdAt',
        pomodoros: 'id, projectId, startedAt, endedAt, completed',
        settings: 'id',
      })
      .upgrade(async (tx) => {
        await tx.table('settings').toCollection().modify((s: Partial<Settings>) => {
          if (s.dailyGoalPomodoros == null) s.dailyGoalPomodoros = 6
        })
      })
    this.version(3)
      .stores({
        projects: 'id, name, archived, createdAt, updatedAt',
        pomodoros: 'id, projectId, startedAt, endedAt, completed, updatedAt',
        settings: 'id',
      })
      .upgrade(async (tx) => {
        const now = Date.now()
        await tx.table('projects').toCollection().modify((p: Partial<Project>) => {
          if (p.updatedAt == null) p.updatedAt = p.createdAt ?? now
        })
        await tx.table('pomodoros').toCollection().modify((p: Partial<Pomodoro>) => {
          if (p.updatedAt == null) p.updatedAt = p.endedAt ?? p.startedAt ?? now
        })
      })
    this.version(4)
      .stores({
        projects: 'id, name, archived, createdAt, updatedAt',
        pomodoros: 'id, projectId, startedAt, endedAt, completed, updatedAt',
        settings: 'id',
        templates: 'id, name, createdAt, updatedAt',
      })
      .upgrade(async (tx) => {
        await tx.table('settings').toCollection().modify((s: Partial<Settings>) => {
          if (!s.palette) s.palette = 'coral'
        })
      })
    this.version(5)
      .stores({
        projects: 'id, name, archived, createdAt, updatedAt',
        pomodoros: 'id, projectId, taskId, startedAt, endedAt, completed, updatedAt',
        settings: 'id',
        templates: 'id, name, createdAt, updatedAt',
        tasks: 'id, projectId, completed, createdAt, updatedAt, order',
      })
    this.version(6)
      .stores({
        projects: 'id, name, archived, createdAt, updatedAt',
        pomodoros: 'id, projectId, taskId, startedAt, endedAt, completed, updatedAt',
        settings: 'id',
        templates: 'id, name, createdAt, updatedAt',
        tasks: 'id, projectId, completed, createdAt, updatedAt, order',
        dayShutdowns: 'id, date, updatedAt',
      })
    this.version(7)
      .stores({
        projects: 'id, name, archived, createdAt, updatedAt',
        pomodoros: 'id, projectId, taskId, startedAt, endedAt, completed, updatedAt',
        settings: 'id',
        templates: 'id, name, createdAt, updatedAt',
        tasks: 'id, projectId, completed, createdAt, updatedAt, order',
        dayShutdowns: 'id, date, updatedAt',
        weeklyReviews: 'id, weekStart, createdAt, updatedAt',
      })
    this.version(8)
      .stores({
        projects: 'id, name, archived, createdAt, updatedAt',
        pomodoros: 'id, projectId, taskId, startedAt, endedAt, completed, updatedAt',
        settings: 'id',
        templates: 'id, name, createdAt, updatedAt',
        tasks: 'id, projectId, completed, createdAt, updatedAt, order',
        dayShutdowns: 'id, date, updatedAt',
        weeklyReviews: 'id, weekStart, createdAt, updatedAt',
        dayNotes: 'id, date, updatedAt',
      })
    // v9: adds optional weeklyGoalSeconds on projects + deletedAt tombstones
    // on pomodoros and tasks. No new indexes required for either.
    this.version(9)
      .stores({
        projects: 'id, name, archived, createdAt, updatedAt',
        pomodoros: 'id, projectId, taskId, startedAt, endedAt, completed, updatedAt',
        settings: 'id',
        templates: 'id, name, createdAt, updatedAt',
        tasks: 'id, projectId, completed, createdAt, updatedAt, order',
        dayShutdowns: 'id, date, updatedAt',
        weeklyReviews: 'id, weekStart, createdAt, updatedAt',
        dayNotes: 'id, date, updatedAt',
      })
    // v10/v11: idle-reminder defaults changed (always-on, 3 min). The settings
    // backfill is NOT done here: an .upgrade() on this store aborted the whole
    // open on WebKit (desktop app stuck on v9, running on in-memory defaults).
    // Schema-only bumps like v5–v9 are proven safe; see backfillSettings().
    this.version(11).stores({
      projects: 'id, name, archived, createdAt, updatedAt',
      pomodoros: 'id, projectId, taskId, startedAt, endedAt, completed, updatedAt',
      settings: 'id',
      templates: 'id, name, createdAt, updatedAt',
      tasks: 'id, projectId, completed, createdAt, updatedAt, order',
      dayShutdowns: 'id, date, updatedAt',
      weeklyReviews: 'id, weekStart, createdAt, updatedAt',
      dayNotes: 'id, date, updatedAt',
    })
  }
}

export const db = new PomodoroDB()

export const BREATH_PATTERNS = [
  { id: 'box', name: 'Box (4-4-4-4)', inhale: 4, holdIn: 4, exhale: 4, holdOut: 4 },
  { id: '478', name: '4-7-8 calming', inhale: 4, holdIn: 7, exhale: 8, holdOut: 0 },
  { id: 'coherent', name: 'Coherent (5-5)', inhale: 5, holdIn: 0, exhale: 5, holdOut: 0 },
  { id: 'energize', name: 'Energize (6-2-4-0)', inhale: 6, holdIn: 2, exhale: 4, holdOut: 0 },
] as const

// Pastel-tuned project swatches, harmonized with the accent palettes so a
// running focus block's dynamic accent (derived from the project color) matches
// the overall look.
export const PROJECT_COLORS = [
  '#e79ab4', '#f0a48c', '#e6bd83', '#c6d07f', '#9fc9a7',
  '#86c6bd', '#93c6e2', '#aca6e5', '#c3a2e2', '#d69ccf',
]

// Fallback for a project with no colour set (or a project that's gone).
export const DEFAULT_PROJECT_COLOR = PROJECT_COLORS[1]

export const DEFAULT_SETTINGS: Settings = {
  id: 'singleton',
  timer: {
    workMinutes: 25,
    shortBreakMinutes: 5,
    longBreakMinutes: 20,
    longBreakEvery: 4,
    autoStartBreaks: false,
    autoStartWork: false,
    allowOvertime: true,
  },
  ritual: {
    enabled: true,
    patternId: 'box',
    cycles: 4,
    breathCues: true,
  },
  audio: {
    master: 0.7,
    chimeVolume: 0.8,
    ambientVolume: 0.35,
    ambient: 'none',
    breathCueVolume: 0.5,
    muted: false,
  },
  notifications: true,
  workHours: {
    enabled: true,
    alwaysOn: true,
    startMinutes: 9 * 60,  // 09:00, fallback for when "always" is turned off
    endMinutes: 17 * 60,   // 17:00
    days: [false, true, true, true, true, true, false], // Mon–Fri
    reminderIntervalMin: 3,
  },
  wakeLock: true,
  theme: 'system',
  palette: 'coral',
  dailyGoalPomodoros: 6,
  calendarSync: {
    enabled: false,
    calendarId: 'primary',
    syncFocus: true,
    syncFlow: true,
    includeReflection: true,
    markBusy: true,
    minMinutes: 1,
  },
}

// One-time opt-in-by-default for idle reminders (always-on, 3 min). A row from
// before that feature has no `alwaysOn` key, which is the marker; anything the
// user has touched since is left alone. Runs in a plain readwrite transaction
// after open, never inside a version upgrade (see the v11 comment above).
async function backfillSettings(existing: Settings) {
  const wh = existing.workHours as Partial<WorkHoursSettings> | undefined
  if (!wh || wh.alwaysOn !== undefined) { crumb('seed.backfill', 'skip'); return }
  const next: Settings = {
    ...existing,
    workHours: {
      ...DEFAULT_SETTINGS.workHours,
      ...wh,
      enabled: true,
      alwaysOn: true,
      reminderIntervalMin: wh.reminderIntervalMin === 15 ? 3 : (wh.reminderIntervalMin ?? 3),
    },
  }
  crumb('seed.backfill', `put keys=${Object.keys(next).join(',')}`)
  try {
    await db.settings.put(next)
    crumb('seed.backfill', 'put ok')
  } catch (e) {
    const err = e as { name?: string; message?: string; stack?: string }
    crumb('seed.backfill', `put err ${err.name}: ${err.message} ${err.stack ?? ''}`)
    throw e
  }
}

const UNREADABLE = Symbol('unreadable')

// Seen after a macOS/WebKit update: reading a row stored by the previous
// WebKit throws "Cannot inject key into script value" from inside the IDB
// success callback, so the request never settles (no rejection to catch).
// A read that hasn't resolved by `ms` is treated as unreadable.
function readOrTimeout<T>(p: Promise<T>, ms: number): Promise<T | typeof UNREADABLE> {
  return Promise.race([p, new Promise<typeof UNREADABLE>(r => setTimeout(() => r(UNREADABLE), ms))])
}

export async function ensureSeed() {
  crumb('seed.step', 'get')
  let existing = await readOrTimeout(db.settings.get('singleton'), 1500)
  if (existing === UNREADABLE) {
    // Settings are device-local (never synced), so the only way forward is to
    // drop the unreadable row and reseed. delete() doesn't read the value.
    crumb('seed.recover', 'settings row unreadable, dropping and reseeding')
    await db.settings.delete('singleton')
    existing = undefined
  } else {
    crumb('seed.step', existing ? 'got row' : 'no row')
  }
  const probe = await readOrTimeout(db.projects.toCollection().first(), 1500)
  crumb('seed.probe', probe === UNREADABLE ? 'projects unreadable' : `projects readable (${probe ? 'has rows' : 'empty'})`)
  if (!existing) {
    await db.settings.put(DEFAULT_SETTINGS)
  } else {
    await backfillSettings(existing)
  }
  // Seed the default project immediately ONLY when there's no cloud sync that
  // could import an existing default. With sync configured we defer to
  // seedDefaultProjectIfEmpty(), called after the first pull (see syncNow), so
  // we don't create a second "Deep Work" that collides with the account's own.
  if (!supabaseEnabled) {
    await seedDefaultProjectIfEmpty()
  }
}

export async function seedDefaultProjectIfEmpty() {
  const projectCount = await db.projects.count()
  if (projectCount > 0) return
  const now = Date.now()
  await db.projects.put({
    id: crypto.randomUUID(),
    name: 'Deep Work',
    color: PROJECT_COLORS[1], // pastel coral, matches the refreshed swatch set
    archived: false,
    createdAt: now,
    updatedAt: now,
  })
}

// Active (non-tombstoned) projects. Use for every surface that lists or offers
// projects to pick, so soft-deleted projects disappear across devices.
export function listActiveProjects(): Promise<Project[]> {
  return db.projects.filter(p => !p.deletedAt).toArray()
}
