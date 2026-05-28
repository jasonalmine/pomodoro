export type Phase =
  | 'idle'
  | 'breathing'
  | 'work'
  | 'flow'
  | 'shortBreak'
  | 'longBreak'
  | 'reflect'

export type BreathPattern = {
  id: string
  name: string
  inhale: number
  holdIn: number
  exhale: number
  holdOut: number
}

export type RitualConfig = {
  enabled: boolean
  patternId: string
  cycles: number
  breathCues: boolean
}

export type TimerDefaults = {
  workMinutes: number
  shortBreakMinutes: number
  longBreakMinutes: number
  longBreakEvery: number
  autoStartBreaks: boolean
  autoStartWork: boolean
  // When false, sessions auto-advance at the planned boundary instead of
  // entering overflow, and ±5 min adjusters are hidden. Strict-Pomodoro mode.
  allowOvertime: boolean
}

export type AmbientId = 'none' | 'rain' | 'brown' | 'lofi' | 'ticking'

export type AudioSettings = {
  master: number
  chimeVolume: number
  ambientVolume: number
  ambient: AmbientId
  breathCueVolume: number
  muted: boolean
}

export type ThemeMode = 'system' | 'light' | 'dark'
export type Palette = 'ember' | 'pine' | 'slate'

export type AiProvider = 'anthropic' | 'openai' | 'gemini'

export type Settings = {
  id: 'singleton'
  timer: TimerDefaults
  ritual: RitualConfig
  audio: AudioSettings
  notifications: boolean
  wakeLock: boolean
  theme: ThemeMode
  palette: Palette
  dailyGoalPomodoros: number
  pocketBaseUrl?: string
  aiProvider?: AiProvider
  aiApiKey?: string
  aiModel?: string
  // Deprecated (pre multi-provider). Read once for migration, then unused.
  anthropicApiKey?: string
}

// Local-only. Cached AI-generated review per ISO week (e.g. "2026-W19").
export type WeeklyReview = {
  id: string
  weekStart: number
  model: string
  content: string
  createdAt: number
  updatedAt: number
}

export type Project = {
  id: string
  name: string
  color: string
  description?: string
  archived: boolean
  // Weekly Pomodoro goal expressed in seconds. Undefined / 0 means no goal.
  weeklyGoalSeconds?: number
  createdAt: number
  updatedAt: number
}

export type Pomodoro = {
  id: string
  projectId: string
  taskId?: string
  task: string
  startedAt: number
  endedAt: number
  plannedSeconds: number
  actualSeconds: number
  completed: boolean
  flowMode?: boolean
  manual?: boolean
  distractions?: number
  tags?: string[]
  note?: string
  noteDone?: string
  noteNext?: string
  ritualUsed: boolean
  // Soft-delete tombstone (ms). When set, the row is hidden from every read
  // surface but kept in storage so the tombstone can propagate across devices.
  deletedAt?: number
  updatedAt: number
}

export type Task = {
  id: string
  projectId: string
  name: string
  estPomodoros: number
  completed: boolean
  completedAt?: number
  archivedAt?: number
  // Soft-delete tombstone (ms). See Pomodoro.deletedAt.
  deletedAt?: number
  order: number
  createdAt: number
  updatedAt: number
}

// One free-form note per local calendar day. `id` is the date key (yyyy-MM-dd).
// Separate from DayShutdown — this is scratchpad/journal text, not the
// structured wins/blockers/tomorrow ritual.
export type DayNote = {
  id: string
  date: number
  content: string
  createdAt: number
  updatedAt: number
}

// One per local calendar day. `id` is the date key (yyyy-MM-dd).
export type DayShutdown = {
  id: string
  date: number          // start-of-day epoch ms
  wins?: string
  blockers?: string
  tomorrowProjectId?: string
  tomorrowTask?: string
  tomorrowMinutes?: number
  createdAt: number
  updatedAt: number
}

export type Template = {
  id: string
  name: string
  projectId?: string
  workMinutes: number
  shortBreakMinutes: number
  longBreakMinutes: number
  useRitual: boolean
  createdAt: number
  updatedAt: number
}
