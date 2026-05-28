import Dexie, { type Table } from 'dexie'
import type { DayNote, DayShutdown, Pomodoro, Project, Settings, Task, Template, WeeklyReview } from '../types'

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
          if (!s.palette) s.palette = 'ember'
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
  }
}

export const db = new PomodoroDB()

export const BREATH_PATTERNS = [
  { id: 'box', name: 'Box (4-4-4-4)', inhale: 4, holdIn: 4, exhale: 4, holdOut: 4 },
  { id: '478', name: '4-7-8 calming', inhale: 4, holdIn: 7, exhale: 8, holdOut: 0 },
  { id: 'coherent', name: 'Coherent (5-5)', inhale: 5, holdIn: 0, exhale: 5, holdOut: 0 },
  { id: 'energize', name: 'Energize (6-2-4-0)', inhale: 6, holdIn: 2, exhale: 4, holdOut: 0 },
] as const

export const PROJECT_COLORS = [
  '#ff6a37', '#f59e0b', '#10b981', '#06b6d4', '#3b82f6',
  '#6366f1', '#8b5cf6', '#ec4899', '#ef4444', '#84cc16',
]

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
  wakeLock: true,
  theme: 'system',
  palette: 'ember',
  dailyGoalPomodoros: 6,
}

export async function ensureSeed() {
  const existing = await db.settings.get('singleton')
  if (!existing) {
    await db.settings.put(DEFAULT_SETTINGS)
  }
  const projectCount = await db.projects.count()
  if (projectCount === 0) {
    const now = Date.now()
    await db.projects.put({
      id: crypto.randomUUID(),
      name: 'Deep Work',
      color: '#ff6a37',
      archived: false,
      createdAt: now,
      updatedAt: now,
    })
  }
}
