import { create } from 'zustand'
import { db, BREATH_PATTERNS } from '../db'
import type { Phase, Pomodoro, RitualConfig, TimerDefaults } from '../types'
import { chime } from '../audio/engine'

type SessionPlan = {
  projectId: string
  taskId: string | null
  task: string
  workSeconds: number
  shortBreakSeconds: number
  longBreakSeconds: number
  longBreakEvery: number
  ritual: RitualConfig
  autoStartBreaks: boolean
  autoStartWork: boolean
  flowMode?: boolean
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
  isOverflow: boolean
  selectedProjectId: string | null
  setSelectedProjectId: (id: string) => void
  selectedTaskId: string | null
  setSelectedTaskId: (id: string | null) => void

  prepare: (plan: SessionPlan) => void
  start: () => void
  pause: () => void
  resume: () => void
  skip: () => void
  abort: () => void
  extend: (seconds: number) => void
  tick: () => void
  saveReflection: (input: string | { note?: string; done?: string; next?: string }) => Promise<void>
  dismissReflection: () => void
  startStandaloneBreak: (type: 'short' | 'long', minutes: number) => void
  startFlow: (projectId: string, taskId: string | null, task: string, defaults: TimerDefaults) => void
  setProject: (projectId: string) => void
  setTask: (task: string) => void
  setPlanTaskId: (id: string | null) => void
  adjustPhase: (seconds: number) => void
}

function nowSec() { return Date.now() / 1000 }

const SELECTED_PROJECT_KEY = 'pomodoro.selectedProjectId'
function loadSelectedProjectId(): string | null {
  try { return localStorage.getItem(SELECTED_PROJECT_KEY) } catch { return null }
}
function persistSelectedProjectId(id: string) {
  try { localStorage.setItem(SELECTED_PROJECT_KEY, id) } catch { /* ignore */ }
}

const SELECTED_TASK_KEY = 'pomodoro.selectedTaskId'
function loadSelectedTaskId(): string | null {
  try { return localStorage.getItem(SELECTED_TASK_KEY) } catch { return null }
}
function persistSelectedTaskId(id: string | null) {
  try {
    if (id) localStorage.setItem(SELECTED_TASK_KEY, id)
    else localStorage.removeItem(SELECTED_TASK_KEY)
  } catch { /* ignore */ }
}

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
  isOverflow: false,
  selectedProjectId: loadSelectedProjectId(),
  setSelectedProjectId: (id) => {
    persistSelectedProjectId(id)
    set({ selectedProjectId: id })
  },
  selectedTaskId: loadSelectedTaskId(),
  setSelectedTaskId: (id) => {
    persistSelectedTaskId(id)
    set({ selectedTaskId: id })
  },

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
      isOverflow: false,
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
    const s = get()
    // Flow has no natural boundary; "skip" means "wrap up the flow now."
    if (s.phase === 'flow' && s.plan && !s.isCompleting) {
      void completeFlow(set, get)
      return
    }
    advancePhase(set, get)
  },

  abort: () => {
    clearBreathTimer()
    const s = get()

    // End during a work session: save the partial Pomodoro and roll straight into a running break.
    if (s.phase === 'work' && s.plan && !s.isCompleting) {
      const plan = s.plan
      void endWorkIntoBreak(plan, s.workCount, s.currentPomodoroStartedAt, s.isRunning, s.phaseStartedAt, s.phaseElapsedSec, s.phaseDurationSec, set)
      return
    }

    // End a flow session: save the count-up Pomodoro and offer a proportional break.
    if (s.phase === 'flow' && s.plan && !s.isCompleting) {
      const plan = s.plan
      void endFlowIntoBreak(plan, s.workCount, s.currentPomodoroStartedAt, s.isRunning, s.phaseStartedAt, s.phaseElapsedSec, set)
      return
    }

    // Otherwise (breathing / meditation / break / idle / reflect): just stop.
    set({
      phase: 'idle',
      isRunning: false,
      phaseDurationSec: 0,
      phaseElapsedSec: 0,
      phaseStartedAt: null,
      breath: null,
      currentPomodoroStartedAt: null,
      isCompleting: false,
      isOverflow: false,
    })
  },

  extend: (seconds) => {
    const s = get()
    if (s.phase !== 'work' && s.phase !== 'shortBreak' && s.phase !== 'longBreak') return
    if (s.isCompleting) return
    // Extending in overflow snaps back to countdown by absorbing the overshoot into duration.
    if (s.isOverflow && s.phaseStartedAt != null) {
      const elapsed = s.phaseElapsedSec + (nowSec() - s.phaseStartedAt)
      const overshoot = Math.max(0, elapsed - s.phaseDurationSec)
      set({
        phaseDurationSec: s.phaseDurationSec + overshoot + Math.max(0, seconds),
        isOverflow: false,
      })
      return
    }
    set({ phaseDurationSec: s.phaseDurationSec + Math.max(0, seconds) })
  },

  tick: () => {
    const s = get()
    if (!s.isRunning || s.phaseStartedAt == null) return
    if (s.phase === 'work' && s.isCompleting) return
    if (s.phase === 'flow') return // count-up, never auto-advances
    const elapsed = s.phaseElapsedSec + (nowSec() - s.phaseStartedAt)
    // For metered phases (work / breaks), enter overflow at the boundary instead of advancing.
    // Breathing + meditation keep auto-advancing.
    if (s.phase === 'breathing' || s.phase === 'meditation') {
      if (elapsed >= s.phaseDurationSec) advancePhase(set, get)
      return
    }
    if (elapsed >= s.phaseDurationSec && !s.isOverflow) {
      chime(s.phase === 'work' ? 'workEnd' : 'breakEnd')
      set({ isOverflow: true })
    }
  },

  saveReflection: async (input) => {
    const id = get().lastCompletedPomodoroId
    if (!id) { advanceFromReflect(set, get); return }
    const payload = typeof input === 'string'
      ? { note: input.trim() }
      : {
          note: input.note?.trim() || undefined,
          noteDone: input.done?.trim() || undefined,
          noteNext: input.next?.trim() || undefined,
        }
    const hasAny = (payload.note || (payload as { noteDone?: string }).noteDone || (payload as { noteNext?: string }).noteNext)
    if (hasAny) await db.pomodoros.update(id, { ...payload, updatedAt: Date.now() })
    advanceFromReflect(set, get)
  },

  dismissReflection: () => {
    advanceFromReflect(set, get)
  },

  setProject: (projectId) => {
    const s = get()
    if (!s.plan) return
    if (!projectId || projectId === s.plan.projectId) return
    // Drop any linked task — a task only makes sense within its project,
    // otherwise the saved Pomodoro ends up with cross-project taskId/projectId.
    set({ plan: { ...s.plan, projectId, taskId: null } })
  },

  setTask: (task) => {
    const s = get()
    if (!s.plan) return
    set({ plan: { ...s.plan, task } })
  },

  setPlanTaskId: (id) => {
    const s = get()
    if (!s.plan) return
    set({ plan: { ...s.plan, taskId: id } })
  },

  adjustPhase: (seconds) => {
    const s = get()
    if (s.phase !== 'work' && s.phase !== 'shortBreak' && s.phase !== 'longBreak') return
    if (s.isCompleting) return
    // Positive adjustment in overflow snaps back to countdown by absorbing the overshoot.
    if (s.isOverflow && s.phaseStartedAt != null && seconds > 0) {
      const elapsed = s.phaseElapsedSec + (nowSec() - s.phaseStartedAt)
      const overshoot = Math.max(0, elapsed - s.phaseDurationSec)
      set({
        phaseDurationSec: s.phaseDurationSec + overshoot + seconds,
        isOverflow: false,
      })
      return
    }
    // Allow shortening; clamp absolute duration to a 30s minimum so users
    // can't accidentally zero out a running phase. If the new duration is
    // below elapsed, the tick handler will enter overflow on the next tick.
    const newDuration = Math.max(30, s.phaseDurationSec + seconds)
    set({ phaseDurationSec: newDuration })
  },

  startStandaloneBreak: (type, minutes) => {
    clearBreathTimer()
    const seconds = Math.max(1, Math.round(minutes * 60))
    chime('start')
    set({
      plan: null,
      phase: type === 'long' ? 'longBreak' : 'shortBreak',
      isRunning: true,
      phaseDurationSec: seconds,
      phaseElapsedSec: 0,
      phaseStartedAt: nowSec(),
      breath: null,
      currentPomodoroStartedAt: null,
      lastCompletedPomodoroId: null,
      isCompleting: false,
      isOverflow: false,
    })
  },

  startFlow: (projectId, taskId, task, defaults) => {
    clearBreathTimer()
    const plan: SessionPlan = {
      projectId,
      taskId,
      task,
      workSeconds: 0,
      shortBreakSeconds: defaults.shortBreakMinutes * 60,
      longBreakSeconds: defaults.longBreakMinutes * 60,
      longBreakEvery: defaults.longBreakEvery,
      ritual: { enabled: false, patternId: 'box', cycles: 0, meditationSeconds: 0, breathCues: false },
      autoStartBreaks: defaults.autoStartBreaks,
      autoStartWork: defaults.autoStartWork,
      flowMode: true,
    }
    chime('start')
    set({
      plan,
      phase: 'flow',
      isRunning: true,
      phaseDurationSec: 0,
      phaseElapsedSec: 0,
      phaseStartedAt: nowSec(),
      breath: null,
      currentPomodoroStartedAt: Date.now(),
      lastCompletedPomodoroId: null,
      isCompleting: false,
      isOverflow: false,
    })
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
    isOverflow: false,
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
    isOverflow: false,
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
    taskId: plan.taskId ?? undefined,
    task: plan.task || 'Focus session',
    startedAt,
    endedAt,
    plannedSeconds: plan.workSeconds,
    actualSeconds,
    completed: finishedFully,
    ritualUsed: plan.ritual.enabled,
    updatedAt: endedAt,
  }
  await db.pomodoros.put(pomodoro)
  // Boundary chime already fired when overflow started. Skip it here to avoid a double-chime.
  if (!s.isOverflow) chime('workEnd')
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
    isOverflow: false,
  })
}

async function endWorkIntoBreak(
  plan: SessionPlan,
  workCount: number,
  currentPomodoroStartedAt: number | null,
  isRunning: boolean,
  phaseStartedAt: number | null,
  phaseElapsedSec: number,
  phaseDurationSec: number,
  set: (p: Partial<TimerState>) => void,
) {
  set({ isCompleting: true })
  const startedAt = currentPomodoroStartedAt ?? Date.now() - phaseDurationSec * 1000
  const endedAt = Date.now()
  // Use actual elapsed time, including the running fraction.
  const elapsed = phaseElapsedSec + (isRunning && phaseStartedAt != null ? nowSec() - phaseStartedAt : 0)
  const actualSeconds = Math.max(1, Math.round(elapsed))
  const completed = actualSeconds >= phaseDurationSec - 1
  const pomodoro: Pomodoro = {
    id: crypto.randomUUID(),
    projectId: plan.projectId,
    taskId: plan.taskId ?? undefined,
    task: plan.task || 'Focus session',
    startedAt,
    endedAt,
    plannedSeconds: plan.workSeconds,
    actualSeconds,
    completed,
    ritualUsed: plan.ritual.enabled,
    updatedAt: endedAt,
  }
  await db.pomodoros.put(pomodoro)
  chime('workEnd')
  const newWorkCount = workCount + 1
  const isLong = (newWorkCount % plan.longBreakEvery) === 0
  const breakSec = isLong ? plan.longBreakSeconds : plan.shortBreakSeconds
  set({
    workCount: newWorkCount,
    lastCompletedPomodoroId: pomodoro.id,
    phase: isLong ? 'longBreak' : 'shortBreak',
    isRunning: true,
    phaseDurationSec: breakSec,
    phaseElapsedSec: 0,
    phaseStartedAt: nowSec(),
    breath: null,
    currentPomodoroStartedAt: null,
    isCompleting: false,
    isOverflow: false,
  })
}

// Flow ended via "skip" / "stop flowing": save the count-up Pomodoro and go to reflect.
// Mirrors completeWork but uses live-elapsed seconds for plannedSeconds, and
// rewrites the plan's break durations to a proportional value so the
// post-reflection break matches the "End" path.
async function completeFlow(set: (p: Partial<TimerState>) => void, get: () => TimerState) {
  const s = get()
  const plan = s.plan
  if (!plan) return
  set({ isCompleting: true })
  const startedAt = s.currentPomodoroStartedAt ?? Date.now()
  const endedAt = Date.now()
  const elapsed = s.phaseElapsedSec + (s.isRunning && s.phaseStartedAt != null ? nowSec() - s.phaseStartedAt : 0)
  const actualSeconds = Math.max(1, Math.round(elapsed))
  const pomodoro: Pomodoro = {
    id: crypto.randomUUID(),
    projectId: plan.projectId,
    taskId: plan.taskId ?? undefined,
    task: plan.task || 'Flow session',
    startedAt,
    endedAt,
    plannedSeconds: actualSeconds,
    actualSeconds,
    completed: true,
    flowMode: true,
    ritualUsed: false,
    updatedAt: endedAt,
  }
  await db.pomodoros.put(pomodoro)
  chime('workEnd')
  const breakMinutes = Math.max(5, Math.min(30, Math.round(actualSeconds / 60 / 5)))
  const breakSec = breakMinutes * 60
  set({
    plan: { ...plan, shortBreakSeconds: breakSec, longBreakSeconds: breakSec },
    workCount: s.workCount + 1,
    lastCompletedPomodoroId: pomodoro.id,
    phase: 'reflect',
    isRunning: false,
    phaseStartedAt: null,
    phaseElapsedSec: 0,
    phaseDurationSec: 0,
    currentPomodoroStartedAt: null,
    isCompleting: false,
    isOverflow: false,
  })
}

// Flow ended via "End" button: save and roll straight into a proportional break.
async function endFlowIntoBreak(
  plan: SessionPlan,
  workCount: number,
  currentPomodoroStartedAt: number | null,
  isRunning: boolean,
  phaseStartedAt: number | null,
  phaseElapsedSec: number,
  set: (p: Partial<TimerState>) => void,
) {
  set({ isCompleting: true })
  const startedAt = currentPomodoroStartedAt ?? Date.now()
  const endedAt = Date.now()
  const elapsed = phaseElapsedSec + (isRunning && phaseStartedAt != null ? nowSec() - phaseStartedAt : 0)
  const actualSeconds = Math.max(1, Math.round(elapsed))
  const pomodoro: Pomodoro = {
    id: crypto.randomUUID(),
    projectId: plan.projectId,
    taskId: plan.taskId ?? undefined,
    task: plan.task || 'Flow session',
    startedAt,
    endedAt,
    plannedSeconds: actualSeconds,
    actualSeconds,
    completed: true,
    flowMode: true,
    ritualUsed: false,
    updatedAt: endedAt,
  }
  await db.pomodoros.put(pomodoro)
  chime('workEnd')
  // Proportional break: 1/5 of the flow time, clamped to [5, 30] minutes.
  const breakMinutes = Math.max(5, Math.min(30, Math.round(actualSeconds / 60 / 5)))
  const breakSec = breakMinutes * 60
  set({
    workCount: workCount + 1,
    lastCompletedPomodoroId: pomodoro.id,
    phase: 'shortBreak',
    isRunning: true,
    phaseDurationSec: breakSec,
    phaseElapsedSec: 0,
    phaseStartedAt: nowSec(),
    breath: null,
    currentPomodoroStartedAt: null,
    isCompleting: false,
    isOverflow: false,
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
    isOverflow: false,
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
      // Suppress redundant chime if we already chimed at the overflow boundary.
      if (!s.isOverflow) chime('breakEnd')
      if (plan.autoStartWork) {
        enterWork(plan, set)
      } else {
        set({ phase: 'idle', isRunning: false, phaseDurationSec: 0, phaseElapsedSec: 0, phaseStartedAt: null, isOverflow: false })
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

// Seconds elapsed past the planned duration. 0 when not in overflow.
export function overflowSec(s: TimerState): number {
  if (!s.isOverflow) return 0
  const elapsed = s.phaseElapsedSec + (s.isRunning && s.phaseStartedAt ? nowSec() - s.phaseStartedAt : 0)
  return Math.max(0, elapsed - s.phaseDurationSec)
}

export function planFromSettings(
  defaults: TimerDefaults,
  ritual: RitualConfig,
  override: Partial<{ workMinutes: number; shortBreakMinutes: number; longBreakMinutes: number; useRitual: boolean }>,
  projectId: string,
  task: string,
  taskId: string | null = null,
): SessionPlan {
  const workMinutes = override.workMinutes ?? defaults.workMinutes
  const shortBreakMinutes = override.shortBreakMinutes ?? defaults.shortBreakMinutes
  const longBreakMinutes = override.longBreakMinutes ?? defaults.longBreakMinutes
  return {
    projectId,
    taskId,
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
