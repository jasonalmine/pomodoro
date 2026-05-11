import { create } from 'zustand'
import { db, BREATH_PATTERNS } from '../db'
import type { Phase, Pomodoro, RitualConfig, TimerDefaults } from '../types'
import { chime } from '../audio/engine'

type SessionPlan = {
  projectId: string
  task: string
  workSeconds: number
  shortBreakSeconds: number
  longBreakSeconds: number
  longBreakEvery: number
  ritual: RitualConfig
  autoStartBreaks: boolean
  autoStartWork: boolean
}

type BreathStage = 'inhale' | 'holdIn' | 'exhale' | 'holdOut'

type BreathState = {
  patternId: string
  cycle: number
  totalCycles: number
  stage: BreathStage
  stageDurationSec: number
  stageElapsedSec: number
  stageStartedAt: number | null
}

type TimerState = {
  phase: Phase
  isRunning: boolean
  phaseDurationSec: number
  phaseElapsedSec: number
  phaseStartedAt: number | null
  workCount: number
  plan: SessionPlan | null
  breath: BreathState | null
  currentPomodoroStartedAt: number | null
  lastCompletedPomodoroId: string | null
  isCompleting: boolean

  prepare: (plan: SessionPlan) => void
  start: () => void
  pause: () => void
  resume: () => void
  skip: () => void
  abort: () => void
  extend: (seconds: number) => void
  tick: () => void
  saveReflection: (note: string) => Promise<void>
  dismissReflection: () => void
}

function nowSec() { return Date.now() / 1000 }

function patternStages(patternId: string): Array<[BreathStage, number]> {
  const p = BREATH_PATTERNS.find(b => b.id === patternId) ?? BREATH_PATTERNS[0]
  const s: Array<[BreathStage, number]> = []
  if (p.inhale > 0) s.push(['inhale', p.inhale])
  if (p.holdIn > 0) s.push(['holdIn', p.holdIn])
  if (p.exhale > 0) s.push(['exhale', p.exhale])
  if (p.holdOut > 0) s.push(['holdOut', p.holdOut])
  return s
}

function breathTotalSec(patternId: string, cycles: number): number {
  return patternStages(patternId).reduce((a, [, sec]) => a + sec, 0) * cycles
}

let breathTimeout: ReturnType<typeof setTimeout> | null = null

function clearBreathTimer() {
  if (breathTimeout) { clearTimeout(breathTimeout); breathTimeout = null }
}

export const useTimer = create<TimerState>((set, get) => ({
  phase: 'idle',
  isRunning: false,
  phaseDurationSec: 0,
  phaseElapsedSec: 0,
  phaseStartedAt: null,
  workCount: 0,
  plan: null,
  breath: null,
  currentPomodoroStartedAt: null,
  lastCompletedPomodoroId: null,
  isCompleting: false,

  prepare: (plan) => {
    clearBreathTimer()
    set({
      plan,
      phase: 'idle',
      isRunning: false,
      phaseDurationSec: 0,
      phaseElapsedSec: 0,
      phaseStartedAt: null,
      breath: null,
      currentPomodoroStartedAt: null,
      isCompleting: false,
    })
  },

  start: () => {
    const { plan } = get()
    if (!plan) return
    if (plan.ritual.enabled && plan.ritual.cycles > 0) {
      enterBreathing(plan, set, get)
    } else if (plan.ritual.enabled && plan.ritual.meditationSeconds > 0) {
      enterMeditation(plan, set)
    } else {
      enterWork(plan, set)
    }
  },

  pause: () => {
    const s = get()
    if (!s.isRunning) return
    clearBreathTimer()
    const now = nowSec()
    let nextBreath = s.breath
    if (s.breath && s.breath.stageStartedAt != null) {
      nextBreath = {
        ...s.breath,
        stageElapsedSec: s.breath.stageElapsedSec + (now - s.breath.stageStartedAt),
        stageStartedAt: null,
      }
    }
    if (s.phaseStartedAt != null) {
      const added = now - s.phaseStartedAt
      set({
        phaseElapsedSec: s.phaseElapsedSec + added,
        phaseStartedAt: null,
        isRunning: false,
        breath: nextBreath,
      })
    } else {
      set({ isRunning: false, breath: nextBreath })
    }
  },

  resume: () => {
    const s = get()
    if (s.isRunning || s.phase === 'idle' || s.phase === 'reflect') return
    const now = nowSec()
    let nextBreath = s.breath
    if (s.breath) {
      nextBreath = { ...s.breath, stageStartedAt: now }
    }
    set({ phaseStartedAt: now, isRunning: true, breath: nextBreath })
    if (s.phase === 'breathing' && nextBreath) {
      scheduleBreathTick(set, get)
    }
  },

  skip: () => {
    advancePhase(set, get)
  },

  abort: () => {
    clearBreathTimer()
    set({
      phase: 'idle',
      isRunning: false,
      phaseDurationSec: 0,
      phaseElapsedSec: 0,
      phaseStartedAt: null,
      breath: null,
      currentPomodoroStartedAt: null,
      isCompleting: false,
    })
  },

  extend: (seconds) => {
    const s = get()
    if (s.phase !== 'work' && s.phase !== 'shortBreak' && s.phase !== 'longBreak') return
    if (s.isCompleting) return
    set({ phaseDurationSec: s.phaseDurationSec + Math.max(0, seconds) })
  },

  tick: () => {
    const s = get()
    if (!s.isRunning || s.phaseStartedAt == null) return
    if (s.phase === 'work' && s.isCompleting) return
    const elapsed = s.phaseElapsedSec + (nowSec() - s.phaseStartedAt)
    if (elapsed >= s.phaseDurationSec) {
      advancePhase(set, get)
    }
  },

  saveReflection: async (note) => {
    const id = get().lastCompletedPomodoroId
    if (id && note.trim()) await db.pomodoros.update(id, { note: note.trim() })
    advanceFromReflect(set, get)
  },

  dismissReflection: () => {
    advanceFromReflect(set, get)
  },
}))

function enterBreathing(plan: SessionPlan, set: (p: Partial<TimerState>) => void, get: () => TimerState) {
  const total = breathTotalSec(plan.ritual.patternId, plan.ritual.cycles)
  const stages = patternStages(plan.ritual.patternId)
  const [firstStage, firstDur] = stages[0]
  const now = nowSec()
  set({
    phase: 'breathing',
    isRunning: true,
    phaseDurationSec: total,
    phaseElapsedSec: 0,
    phaseStartedAt: now,
    breath: {
      patternId: plan.ritual.patternId,
      cycle: 1,
      totalCycles: plan.ritual.cycles,
      stage: firstStage,
      stageDurationSec: firstDur,
      stageElapsedSec: 0,
      stageStartedAt: now,
    },
  })
  scheduleBreathTick(set, get)
}

function scheduleBreathTick(set: (p: Partial<TimerState>) => void, get: () => TimerState) {
  clearBreathTimer()
  const b = get().breath
  if (!b || b.stageStartedAt == null) return
  const remainingMs = Math.max(0, (b.stageDurationSec - b.stageElapsedSec) * 1000)
  breathTimeout = setTimeout(() => {
    const cur = get()
    if (!cur.isRunning || cur.phase !== 'breathing' || !cur.breath) return
    const stages = patternStages(cur.breath.patternId)
    const idx = stages.findIndex(s => s[0] === cur.breath!.stage)
    const nextIdx = (idx + 1) % stages.length
    const nextCycle = nextIdx === 0 ? cur.breath.cycle + 1 : cur.breath.cycle
    if (nextCycle > cur.breath.totalCycles) {
      onBreathingComplete(set, get)
      return
    }
    const [nextStage, nextDur] = stages[nextIdx]
    set({
      breath: {
        ...cur.breath,
        stage: nextStage,
        stageDurationSec: nextDur,
        stageElapsedSec: 0,
        stageStartedAt: nowSec(),
        cycle: nextCycle,
      },
    })
    scheduleBreathTick(set, get)
  }, remainingMs)
}

function onBreathingComplete(set: (p: Partial<TimerState>) => void, get: () => TimerState) {
  clearBreathTimer()
  const plan = get().plan!
  if (plan.ritual.meditationSeconds > 0) {
    enterMeditation(plan, set)
  } else {
    enterWork(plan, set)
  }
}

function enterMeditation(plan: SessionPlan, set: (p: Partial<TimerState>) => void) {
  set({
    phase: 'meditation',
    isRunning: true,
    phaseDurationSec: plan.ritual.meditationSeconds,
    phaseElapsedSec: 0,
    phaseStartedAt: nowSec(),
    breath: null,
  })
}

function enterWork(plan: SessionPlan, set: (p: Partial<TimerState>) => void) {
  chime('start')
  set({
    phase: 'work',
    isRunning: true,
    phaseDurationSec: plan.workSeconds,
    phaseElapsedSec: 0,
    phaseStartedAt: nowSec(),
    breath: null,
    currentPomodoroStartedAt: Date.now(),
    isCompleting: false,
  })
}

async function completeWork(set: (p: Partial<TimerState>) => void, get: () => TimerState, finishedFully: boolean) {
  const s = get()
  const plan = s.plan!
  const startedAt = s.currentPomodoroStartedAt ?? Date.now() - plan.workSeconds * 1000
  const endedAt = Date.now()
  const actualSeconds = Math.max(1, Math.round((endedAt - startedAt) / 1000))
  const pomodoro: Pomodoro = {
    id: crypto.randomUUID(),
    projectId: plan.projectId,
    task: plan.task || 'Focus session',
    startedAt,
    endedAt,
    plannedSeconds: plan.workSeconds,
    actualSeconds,
    completed: finishedFully,
    ritualUsed: plan.ritual.enabled,
  }
  await db.pomodoros.put(pomodoro)
  chime('workEnd')
  const newWorkCount = s.workCount + 1
  set({
    workCount: newWorkCount,
    lastCompletedPomodoroId: pomodoro.id,
    phase: 'reflect',
    isRunning: false,
    phaseStartedAt: null,
    phaseElapsedSec: 0,
    phaseDurationSec: 0,
    currentPomodoroStartedAt: null,
    isCompleting: false,
  })
}

function advanceFromReflect(set: (p: Partial<TimerState>) => void, get: () => TimerState) {
  const s = get()
  const plan = s.plan
  if (!plan) {
    set({ lastCompletedPomodoroId: null, phase: 'idle' })
    return
  }
  set({ lastCompletedPomodoroId: null })
  const isLong = (s.workCount % plan.longBreakEvery) === 0
  enterBreak(plan, isLong, set)
}

function enterBreak(plan: SessionPlan, isLong: boolean, set: (p: Partial<TimerState>) => void) {
  set({
    phase: isLong ? 'longBreak' : 'shortBreak',
    isRunning: plan.autoStartBreaks,
    phaseDurationSec: isLong ? plan.longBreakSeconds : plan.shortBreakSeconds,
    phaseElapsedSec: 0,
    phaseStartedAt: plan.autoStartBreaks ? nowSec() : null,
    breath: null,
  })
}

function advancePhase(set: (p: Partial<TimerState>) => void, get: () => TimerState) {
  const s = get()
  clearBreathTimer()
  const plan = s.plan
  if (!plan) {
    set({ phase: 'idle', isRunning: false })
    return
  }
  switch (s.phase) {
    case 'breathing':
      onBreathingComplete(set, get)
      return
    case 'meditation':
      enterWork(plan, set)
      return
    case 'work': {
      if (s.isCompleting) return
      const finishedFully = s.phaseElapsedSec + (s.phaseStartedAt ? nowSec() - s.phaseStartedAt : 0) >= s.phaseDurationSec - 1
      set({ isCompleting: true })
      // Persist the pomodoro and stop here on the reflect phase.
      // The break starts after the user saves or dismisses the reflection.
      void completeWork(set, get, finishedFully)
      return
    }
    case 'shortBreak':
    case 'longBreak':
      chime('breakEnd')
      if (plan.autoStartWork) {
        enterWork(plan, set)
      } else {
        set({ phase: 'idle', isRunning: false, phaseDurationSec: 0, phaseElapsedSec: 0, phaseStartedAt: null })
      }
      return
    default:
      set({ phase: 'idle', isRunning: false })
  }
}

export function remainingSec(s: TimerState): number {
  if (s.phase === 'idle' || s.phase === 'reflect') return 0
  const elapsed = s.phaseElapsedSec + (s.isRunning && s.phaseStartedAt ? nowSec() - s.phaseStartedAt : 0)
  return Math.max(0, s.phaseDurationSec - elapsed)
}

export function planFromSettings(
  defaults: TimerDefaults,
  ritual: RitualConfig,
  override: Partial<{ workMinutes: number; shortBreakMinutes: number; longBreakMinutes: number; useRitual: boolean }>,
  projectId: string,
  task: string,
): SessionPlan {
  const workMinutes = override.workMinutes ?? defaults.workMinutes
  const shortBreakMinutes = override.shortBreakMinutes ?? defaults.shortBreakMinutes
  const longBreakMinutes = override.longBreakMinutes ?? defaults.longBreakMinutes
  return {
    projectId,
    task,
    workSeconds: Math.round(workMinutes * 60),
    shortBreakSeconds: Math.round(shortBreakMinutes * 60),
    longBreakSeconds: Math.round(longBreakMinutes * 60),
    longBreakEvery: defaults.longBreakEvery,
    ritual: { ...ritual, enabled: (override.useRitual ?? ritual.enabled) },
    autoStartBreaks: defaults.autoStartBreaks,
    autoStartWork: defaults.autoStartWork,
  }
}
