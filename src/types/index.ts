export type Phase =
  | 'idle'
  | 'breathing'
  | 'meditation'
  | 'work'
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

export type AmbientId = 'none' | 'rain' | 'brown' | 'lofi'

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
