export type Phase =
  | 'idle'
  | 'breathing'
  | 'meditation'
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
  meditationSeconds: number
  breathCues: boolean
}

export type TimerDefaults = {
  workMinutes: number
  shortBreakMinutes: number
  longBreakMinutes: number
  longBreakEvery: number
  autoStartBreaks: boolean
  autoStartWork: boolean
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
  note?: string
  noteDone?: string
  noteNext?: string
  ritualUsed: boolean
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
  order: number
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
