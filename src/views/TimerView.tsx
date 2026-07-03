import { useEffect, useMemo, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { format, subDays } from 'date-fns'
import { Pause, Play, Plus, Minus, SkipForward, X, Coffee, Moon, RotateCcw, Pencil, Sunrise } from 'lucide-react'
import { useTimer, planFromSettings } from '../store/timer'
import { useSettings } from '../hooks/useSettings'
import { useWakeLock } from '../hooks/useWakeLock'
import { useNotificationRequest, requestNotificationPermission } from '../hooks/useNotifications'
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts'
import { db, listActiveProjects } from '../db'
import { Button } from '../components/Button'
import { RingTimer } from '../components/RingTimer'
import { GoalRing } from '../components/GoalRing'
import { BreathingCircle } from '../components/BreathingCircle'
import { ProjectChip } from '../components/ProjectChip'
import { ProjectChipPicker } from '../components/ProjectChipPicker'
import { DurationStepper } from '../components/DurationStepper'
import { WelcomeCard } from '../components/WelcomeCard'
import { fmtDuration } from '../lib/format'
import { todayBounds, totalsInWindow, recentTasks, pomodorosByTask, recentTags } from '../lib/stats'
import type { Project, Task, Template } from '../types'
import { Bookmark, AlertTriangle, Zap } from 'lucide-react'
import { useTabPresence } from '../hooks/useTabPresence'

export function TimerView() {
  useKeyboardShortcuts()

  const settings = useSettings()
  const phase = useTimer(s => s.phase)
  const { otherTabsActive } = useTabPresence(phase)
  const isRunning = useTimer(s => s.isRunning)
  const breath = useTimer(s => s.breath)
  const prepare = useTimer(s => s.prepare)
  const start = useTimer(s => s.start)
  const pause = useTimer(s => s.pause)
  const resume = useTimer(s => s.resume)
  const skip = useTimer(s => s.skip)
  const abort = useTimer(s => s.abort)
  const extend = useTimer(s => s.extend)
  const adjustPhase = useTimer(s => s.adjustPhase)
  const setPlanTask = useTimer(s => s.setTask)
  const workCount = useTimer(s => s.workCount)
  const startStandaloneBreak = useTimer(s => s.startStandaloneBreak)
  const startFlow = useTimer(s => s.startFlow)
  const phaseElapsedSec = useTimer(s => s.phaseElapsedSec)
  const phaseStartedAt = useTimer(s => s.phaseStartedAt)
  const phaseDurationSec = useTimer(s => s.phaseDurationSec)
  const planProjectId = useTimer(s => s.plan?.projectId ?? null)
  const planTask = useTimer(s => s.plan?.task ?? '')
  const setPlanProject = useTimer(s => s.setProject)
  const planTaskIdLive = useTimer(s => s.plan?.taskId ?? null)
  const setPlanTaskIdAction = useTimer(s => s.setPlanTaskId)
  const sessionDistractions = useTimer(s => s.sessionDistractions)
  const addDistraction = useTimer(s => s.addDistraction)
  const planAllowOvertime = useTimer(s => s.plan?.allowOvertime ?? true)
  const isOverflow = useTimer(s => s.isOverflow)
  const planLongBreakEvery = useTimer(s => s.plan?.longBreakEvery ?? 4)
  const storedProjectId = useTimer(s => s.selectedProjectId)
  const setStoredProjectId = useTimer(s => s.setSelectedProjectId)
  const storedTaskId = useTimer(s => s.selectedTaskId)
  const setStoredTaskId = useTimer(s => s.setSelectedTaskId)

  const [mode, setMode] = useState<IdleMode>('focus')
  const [breakKind, setBreakKind] = useState<'short' | 'long'>('short')

  const allProjects = useLiveQuery(() => listActiveProjects(), [], [])
  const active = useMemo(() => (allProjects ?? []).filter(p => !p.archived), [allProjects])

  const today = todayBounds()
  const todaysPoms = useLiveQuery(
    () => db.pomodoros
      .where('startedAt').between(today.start, today.end, true, true)
      .filter(p => !p.deletedAt)
      .toArray(),
    [today.start, today.end],
    [],
  )
  const todayCount = useMemo(() => totalsInWindow(todaysPoms ?? [], today.start, today.end).count, [todaysPoms, today.start, today.end])

  const recent = useLiveQuery(
    () => db.pomodoros.orderBy('startedAt').reverse().filter(p => !p.deletedAt).limit(30).toArray(),
    [],
    [],
  )
  const recentChips = useMemo(() => recentTasks(recent ?? [], 3), [recent])
  const lastSession = useMemo(() => (recent ?? [])[0] ?? null, [recent])

  const templates = useLiveQuery(() => db.templates.orderBy('createdAt').toArray(), [], [])
  const allTasks = useLiveQuery(() => db.tasks.filter(t => !t.deletedAt).toArray(), [], [])
  const allPoms = useLiveQuery(() => db.pomodoros.filter(p => !p.deletedAt).toArray(), [], [])
  const taskCounts = useMemo(() => pomodorosByTask(allPoms ?? []), [allPoms])

  const yesterdayKey = format(subDays(new Date(), 1), 'yyyy-MM-dd')
  const yesterdayShutdown = useLiveQuery(() => db.dayShutdowns.get(yesterdayKey), [yesterdayKey])

  const applyTemplate = (t: Template) => {
    setWorkMin(t.workMinutes)
    setShortMin(t.shortBreakMinutes)
    setLongMin(t.longBreakMinutes)
    setUseRitual(t.useRitual)
    if (t.projectId && active.some(p => p.id === t.projectId)) setProjectId(t.projectId)
  }


  const [projectId, setProjectIdLocal] = useState<string>(storedProjectId ?? '')
  const setProjectId = (id: string) => {
    setProjectIdLocal(id)
    setStoredProjectId(id)
  }
  const [task, setTask] = useState('')
  const [workMin, setWorkMin] = useState<number | null>(null)
  const [shortMin, setShortMin] = useState<number | null>(null)
  const [longMin, setLongMin] = useState<number | null>(null)
  const [useRitual, setUseRitual] = useState<boolean | null>(null)

  // Initialize form values from settings once they load, but don't overwrite user edits afterward.
  useEffect(() => { if (workMin === null) setWorkMin(settings.timer.workMinutes) }, [settings.timer.workMinutes, workMin])
  useEffect(() => { if (shortMin === null) setShortMin(settings.timer.shortBreakMinutes) }, [settings.timer.shortBreakMinutes, shortMin])
  useEffect(() => { if (longMin === null) setLongMin(settings.timer.longBreakMinutes) }, [settings.timer.longBreakMinutes, longMin])
  useEffect(() => { if (useRitual === null) setUseRitual(settings.ritual.enabled) }, [settings.ritual.enabled, useRitual])
  useEffect(() => {
    if (!active.length) return
    const saved = storedProjectId ?? projectId
    if (saved && active.some(p => p.id === saved)) {
      if (projectId !== saved) setProjectIdLocal(saved)
      return
    }
    setProjectId(active[0].id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, storedProjectId])

  const workMinVal = workMin ?? settings.timer.workMinutes
  const shortMinVal = shortMin ?? settings.timer.shortBreakMinutes
  const longMinVal = longMin ?? settings.timer.longBreakMinutes
  const useRitualVal = useRitual ?? settings.ritual.enabled

  useNotificationRequest(settings.notifications)
  const wakeActive = isRunning && (phase === 'work' || phase === 'flow' || phase === 'shortBreak' || phase === 'longBreak')
  useWakeLock(wakeActive, settings.wakeLock)

  const activeProject = (allProjects ?? []).find(p => p.id === (planProjectId ?? projectId)) ?? null

  const projectOpenTasks = useMemo(() => {
    return (allTasks ?? [])
      .filter(t => t.projectId === projectId && !t.completed && !t.archivedAt)
      .sort((a, b) => a.order - b.order)
  }, [allTasks, projectId])

  // Clear stored task if it's been completed/deleted or belongs to another project.
  useEffect(() => {
    if (!storedTaskId) return
    const t = (allTasks ?? []).find(x => x.id === storedTaskId)
    if (!t || t.completed || t.archivedAt || t.projectId !== projectId) {
      setStoredTaskId(null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allTasks, projectId, storedTaskId])

  const selectedTask = (allTasks ?? []).find(t => t.id === storedTaskId) ?? null

  // Estimated remaining time across open tasks for this project.
  const finishEstimate = useMemo(() => {
    if (projectOpenTasks.length === 0) return null
    let remainingPoms = 0
    for (const t of projectOpenTasks) {
      const done = taskCounts.get(t.id) ?? 0
      remainingPoms += Math.max(0, t.estPomodoros - done)
    }
    if (remainingPoms === 0) return null
    const minutes = remainingPoms * workMinVal
    const finishAt = new Date(Date.now() + minutes * 60 * 1000)
    return { remainingPoms, minutes, finishAt }
  }, [projectOpenTasks, taskCounts, workMinVal])

  // Pick / unpick a task. Picking prefills the task input; unpicking clears the input only
  // if it matches the task name (avoid stomping a user-typed string).
  const pickTask = (t: Task | null) => {
    if (t) {
      setStoredTaskId(t.id)
      setTask(t.name)
    } else {
      const prev = selectedTask
      setStoredTaskId(null)
      if (prev && task === prev.name) setTask('')
    }
  }

  const onStart = async () => {
    if (!projectId) return
    if (settings.notifications) await requestNotificationPermission()
    const plan = planFromSettings(
      settings.timer,
      settings.ritual,
      { workMinutes: workMinVal, shortBreakMinutes: shortMinVal, longBreakMinutes: longMinVal, useRitual: useRitualVal },
      projectId,
      task.trim(),
      storedTaskId,
    )
    prepare(plan)
    start()
  }

  if (phase === 'reflect') return <ReflectionPanel />

  if (phase === 'idle') {
    return (
      <div className="mx-auto w-full max-w-2xl px-4 sm:px-6 pt-10 sm:pt-20 pb-12 space-y-10">
        {otherTabsActive && <OtherTabBanner />}
        <WelcomeCard />
        <div className="flex justify-center">
          <ModePicker mode={mode} onChange={setMode} />
        </div>

        {mode === 'focus' ? (
          <>
            <div className="space-y-6 text-center">
              <ProjectPicker projects={active ?? []} value={projectId} onChange={setProjectId} />

              <div className="space-y-2">
                <div className="text-[11px] font-medium uppercase tracking-[0.22em] text-ink-400">What's the focus?</div>
                <input
                  value={task}
                  onChange={e => {
                    setTask(e.target.value)
                    if (selectedTask && e.target.value !== selectedTask.name) setStoredTaskId(null)
                  }}
                  placeholder="Say what matters"
                  autoFocus
                  onKeyDown={e => { if (e.key === 'Enter' && projectId) void onStart() }}
                  className="w-full bg-transparent border-0 border-b border-ink-200 dark:border-ink-800 focus:border-accent focus:ring-0 outline-none font-display text-3xl sm:text-5xl text-center text-ink-900 dark:text-ink-50 placeholder:italic placeholder:text-ink-300 dark:placeholder:text-ink-700 py-3 px-2 transition-colors"
                />
              </div>

              {projectOpenTasks.length > 0 && (
                <div className="space-y-2">
                  <div className="flex flex-wrap justify-center gap-1.5">
                    {projectOpenTasks.slice(0, 8).map(t => {
                      const done = taskCounts.get(t.id) ?? 0
                      const isSelected = storedTaskId === t.id
                      return (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => pickTask(isSelected ? null : t)}
                          className={
                            'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs transition ' +
                            (isSelected
                              ? 'border-accent text-accent bg-accent/5'
                              : 'border-ink-200 dark:border-ink-800 text-ink-600 dark:text-ink-300 hover:border-accent/40 hover:text-ink-900 dark:hover:text-ink-50')
                          }
                          title={`${done} of ${t.estPomodoros} Pomodoros logged`}
                        >
                          <span className="truncate max-w-[12rem]">{t.name}</span>
                          <span className="text-[10px] tabular text-ink-400">{done}/{t.estPomodoros}</span>
                        </button>
                      )
                    })}
                  </div>
                  {finishEstimate && (
                    <p className="text-center text-[11px] text-ink-400 tabular">
                      ≈ {finishEstimate.remainingPoms} Pomodoro{finishEstimate.remainingPoms === 1 ? '' : 's'} left ·
                      {' '}finishes ~{finishEstimate.finishAt.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                    </p>
                  )}
                </div>
              )}
              {recentChips.length > 0 && (
                <div className="flex flex-wrap justify-center gap-2 pt-1">
                  {recentChips.map((t, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setTask(t)}
                      className="text-xs text-ink-500 hover:text-ink-800 dark:hover:text-ink-100 px-3 py-1.5 rounded-full border border-ink-200 dark:border-ink-800 hover:border-accent/40 transition"
                    >
                      {t}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="flex justify-center">
              <DurationStepper label="Focus" value={workMinVal} onChange={setWorkMin} min={5} max={120} step={5} />
            </div>

            {yesterdayShutdown?.tomorrowTask && active.some(p => p.id === yesterdayShutdown.tomorrowProjectId) && (
              <div className="flex justify-center">
                <button
                  type="button"
                  onClick={() => {
                    if (yesterdayShutdown.tomorrowProjectId) setProjectId(yesterdayShutdown.tomorrowProjectId)
                    if (yesterdayShutdown.tomorrowTask) setTask(yesterdayShutdown.tomorrowTask)
                    if (yesterdayShutdown.tomorrowMinutes) setWorkMin(yesterdayShutdown.tomorrowMinutes)
                  }}
                  className="inline-flex items-center gap-2 rounded-full border border-accent/30 bg-accent/5 px-3 py-1.5 text-[11px] text-accent hover:bg-accent/10 transition"
                  title="Yesterday's plan for today's first Pomodoro"
                >
                  <Sunrise size={12} />
                  Yesterday's plan
                  <span className="text-accent/60">·</span>
                  <span className="truncate max-w-[14rem] text-ink-700 dark:text-ink-200">{yesterdayShutdown.tomorrowTask}</span>
                  {yesterdayShutdown.tomorrowMinutes != null && (
                    <>
                      <span className="text-accent/60">·</span>
                      <span className="tabular text-ink-700 dark:text-ink-200">{yesterdayShutdown.tomorrowMinutes}m</span>
                    </>
                  )}
                </button>
              </div>
            )}

            {lastSession && active.some(p => p.id === lastSession.projectId) && (
              <div className="flex justify-center">
                <button
                  type="button"
                  onClick={() => {
                    setProjectId(lastSession.projectId)
                    setTask(lastSession.task && lastSession.task !== 'Focus session' ? lastSession.task : '')
                    const mins = Math.max(1, Math.round(lastSession.plannedSeconds / 60))
                    setWorkMin(mins)
                  }}
                  className="inline-flex items-center gap-2 rounded-full border border-ink-200 dark:border-ink-800 px-3 py-1.5 text-[11px] text-ink-500 hover:text-ink-800 dark:hover:text-ink-100 hover:border-accent/40 transition"
                  title="Prefill the last session"
                >
                  <RotateCcw size={12} />
                  Resume last
                  <span className="text-ink-400">·</span>
                  <span className="truncate max-w-[14rem]">{lastSession.task || 'Focus session'}</span>
                  <span className="text-ink-400">·</span>
                  <span className="tabular">{Math.max(1, Math.round(lastSession.plannedSeconds / 60))}m</span>
                </button>
              </div>
            )}

            <div className="flex justify-center">
              <Button size="lg" className="w-full max-w-sm" onClick={onStart} disabled={!projectId || active.length === 0}>
                {useRitualVal ? 'Begin Ritual' : 'Start Focus'}
              </Button>
            </div>

            {(templates ?? []).length > 0 && (
              <div className="flex flex-wrap justify-center gap-2 pt-2">
                {(templates ?? []).map(t => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => applyTemplate(t)}
                    className="inline-flex items-center gap-1.5 text-[11px] text-ink-400 hover:text-ink-700 dark:hover:text-ink-200 transition"
                    title={`${t.workMinutes}m focus · ${t.shortBreakMinutes}m short · ${t.longBreakMinutes}m long`}
                  >
                    <Bookmark size={11} /> {t.name}
                  </button>
                ))}
              </div>
            )}

            {active.length === 0 && (
              <p className="text-center text-sm text-ink-500">Add a project from the Projects tab to get started.</p>
            )}

            <p className="text-center text-[11px] text-ink-400">
              Adjust defaults in <a href="/settings" className="underline decoration-dotted hover:text-ink-700 dark:hover:text-ink-200">Settings</a>
            </p>
          </>
        ) : mode === 'flow' ? (
          <div className="space-y-8 text-center">
            <div className="space-y-2">
              <div className="text-[11px] uppercase tracking-[0.22em] text-accent">Flowtime</div>
              <h1 className="font-display text-3xl sm:text-4xl text-ink-900 dark:text-ink-50">
                Let it run as long as it wants
              </h1>
              <p className="text-sm text-ink-500 max-w-md mx-auto">
                No target, no overflow. The clock counts up. Stop when you reach a natural pause. We'll suggest a proportional break.
              </p>
            </div>

            <ProjectPicker projects={active ?? []} value={projectId} onChange={setProjectId} />

            <div className="space-y-2 max-w-lg mx-auto">
              <input
                value={task}
                onChange={e => {
                  setTask(e.target.value)
                  if (selectedTask && e.target.value !== selectedTask.name) setStoredTaskId(null)
                }}
                placeholder="What are you working on?"
                onKeyDown={e => { if (e.key === 'Enter' && projectId) startFlow(projectId, storedTaskId, task.trim(), settings.timer) }}
                className="w-full bg-transparent border-0 border-b border-ink-200 dark:border-ink-800 focus:border-accent focus:ring-0 outline-none font-display text-2xl sm:text-3xl text-center text-ink-900 dark:text-ink-50 placeholder:italic placeholder:text-ink-300 dark:placeholder:text-ink-700 py-3 px-2 transition-colors"
              />
            </div>

            <div className="flex justify-center">
              <Button
                size="lg"
                className="w-full max-w-sm"
                onClick={() => startFlow(projectId, storedTaskId, task.trim(), settings.timer)}
                disabled={!projectId || active.length === 0}
              >
                Start Flowing
              </Button>
            </div>

            {active.length === 0 && (
              <p className="text-center text-sm text-ink-500">Add a project from the Projects tab to get started.</p>
            )}
          </div>
        ) : (
          <div className="space-y-8 text-center">
            <div className="space-y-2">
              <h1 className="font-display text-3xl sm:text-4xl text-ink-900 dark:text-ink-50">
                {breakKind === 'short' ? 'Take a short break' : 'Take a long break'}
              </h1>
              <p className="text-sm text-ink-500">Step away. The timer will let you know when time is up.</p>
            </div>

            <div className="flex justify-center">
              <div className="inline-flex items-center rounded-full bg-ink-100 dark:bg-ink-800 p-1">
                {(['short', 'long'] as const).map(k => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setBreakKind(k)}
                    className={`h-8 px-4 rounded-full text-xs font-medium transition ${
                      breakKind === k
                        ? 'bg-white dark:bg-ink-900 text-ink-900 dark:text-ink-50 shadow-sm'
                        : 'text-ink-500 hover:text-ink-700 dark:hover:text-ink-200'
                    }`}
                  >
                    {k === 'short' ? 'Short' : 'Long'}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex justify-center">
              {breakKind === 'short' ? (
                <DurationStepper label="Short break" value={shortMinVal} onChange={setShortMin} min={1} max={60} step={1} />
              ) : (
                <DurationStepper label="Long break" value={longMinVal} onChange={setLongMin} min={5} max={120} step={5} />
              )}
            </div>

            <div className="flex justify-center">
              <Button
                size="lg"
                className="w-full max-w-sm"
                onClick={() => startStandaloneBreak(breakKind, breakKind === 'short' ? shortMinVal : longMinVal)}
              >
                {breakKind === 'short' ? 'Start Short Break' : 'Start Long Break'}
              </Button>
            </div>
          </div>
        )}
      </div>
    )
  }

  // Active phase
  const isWorkLike = phase === 'work' || phase === 'flow'
  const canExtend = planAllowOvertime && (phase === 'work' || phase === 'shortBreak' || phase === 'longBreak')
  const isBreakPhase = phase === 'shortBreak' || phase === 'longBreak'
  const queuedBreak = isBreakPhase && !isRunning && phaseElapsedSec === 0 && phaseStartedAt === null
  const breakLabel = phase === 'longBreak' ? 'Long Break' : 'Short Break'

  const intentionText = queuedBreak
    ? `Time for a ${phase === 'longBreak' ? 'long' : 'short'} break`
    : isBreakPhase
      ? `On a ${phase === 'longBreak' ? 'long' : 'short'} break`
      : (planTask || (phase === 'work' ? 'Focus session' : phase === 'flow' ? 'Flow session' : phase === 'breathing' ? 'Breathe' : ''))

  // Projected end of the current phase. Constant while running (start + remaining
  // planned), so no ticker needed; hidden when paused/overflowing where it would
  // drift or mislead.
  const endsAtText = isRunning && !isOverflow && phaseStartedAt != null && phaseDurationSec > 0 && phase !== 'flow'
    ? ` · ends ~${format(new Date((phaseStartedAt + phaseDurationSec - phaseElapsedSec) * 1000), 'h:mm aaa')}`
    : ''

  return (
    <div className="mx-auto w-full max-w-2xl min-h-screen p-4 sm:p-8 flex flex-col items-center justify-center text-center gap-8 relative">
      <div className="absolute top-4 right-4 sm:top-6 sm:right-6">
        <GoalRing current={todayCount} goal={settings.dailyGoalPomodoros} size={44} />
      </div>
      {otherTabsActive && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 px-2 max-w-md w-full">
          <OtherTabBanner />
        </div>
      )}

      <div key={phase} className="space-y-2 animate-[fadeIn_300ms_ease-out]">
        {activeProject && isWorkLike && (
          <div className="flex justify-center">
            <ProjectSwitcher
              projects={active}
              value={activeProject.id}
              onChange={setPlanProject}
            />
          </div>
        )}
        {isWorkLike ? (
          <EditableIntention
            value={planTask}
            placeholder={phase === 'flow' ? 'Flow session' : 'Focus session'}
            onChange={(next) => {
              setPlanTask(next)
              // If the user renamed away from the linked task, unlink so the
              // saved Pomodoro doesn't carry a mismatched taskId.
              if (planTaskIdLive) {
                const linked = (allTasks ?? []).find(t => t.id === planTaskIdLive)
                if (!linked || linked.name !== next) setPlanTaskIdAction(null)
              }
            }}
          />
        ) : (
          <div className="font-display text-2xl sm:text-3xl text-ink-900 dark:text-ink-50 px-6 max-w-xl mx-auto leading-tight">
            {intentionText}
          </div>
        )}
        {isWorkLike && activeProject && (
          <ActiveTaskSwitcher
            tasks={(allTasks ?? []).filter(t => t.projectId === activeProject.id && !t.archivedAt && !t.completed)}
            counts={taskCounts}
            currentTaskId={planTaskIdLive}
            onPick={(t) => {
              if (planTaskIdLive === t.id) {
                setPlanTaskIdAction(null)
                return
              }
              setPlanTaskIdAction(t.id)
              setPlanTask(t.name)
            }}
          />
        )}
      </div>

      <div key={`ring-${phase}`} className="animate-[ringIn_400ms_ease-out]">
        {phase === 'breathing' ? <BreathingCircle /> : <RingTimer />}
      </div>

      {phase !== 'breathing' && breath == null && (
        <div className="flex flex-col items-center gap-2.5">
          <div className="text-[11px] uppercase tracking-[0.18em] text-ink-400">
            {phase === 'work' && <>Pomodoro {workCount + 1} · {fmtDuration(phaseDurationSec)} planned{endsAtText}</>}
            {phase === 'flow' && <>Flow · counting up</>}
            {isBreakPhase && !queuedBreak && <>{breakLabel} · {fmtDuration(phaseDurationSec)}{endsAtText}</>}
          </div>
          {phase === 'work' && planLongBreakEvery > 1 && (
            <CycleDots total={planLongBreakEvery} done={workCount % planLongBreakEvery} />
          )}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-center gap-3 mt-2">
        {queuedBreak ? (
          <Button variant="primary" size="lg" onClick={resume}>
            {phase === 'longBreak' ? <Moon size={18} /> : <Coffee size={18} />} Start {breakLabel}
          </Button>
        ) : isRunning ? (
          <Button variant="secondary" size="lg" onClick={pause}><Pause size={18} /> Pause</Button>
        ) : (
          <Button variant="primary" size="lg" onClick={resume}><Play size={18} /> Resume</Button>
        )}
        {canExtend && !queuedBreak && (
          <div className="inline-flex items-center rounded-full border border-ink-200 dark:border-ink-800 overflow-hidden">
            <button
              type="button"
              onClick={() => adjustPhase(-5 * 60)}
              className="h-12 px-3 inline-flex items-center gap-1 text-sm text-ink-700 dark:text-ink-200 hover:bg-ink-100 dark:hover:bg-ink-800 transition"
              aria-label="Subtract 5 minutes"
              title="Subtract 5 minutes"
            >
              <Minus size={16} /> 5
            </button>
            <span className="h-6 w-px bg-ink-200 dark:bg-ink-800" />
            <button
              type="button"
              onClick={() => extend(5 * 60)}
              className="h-12 px-3 inline-flex items-center gap-1 text-sm text-ink-700 dark:text-ink-200 hover:bg-ink-100 dark:hover:bg-ink-800 transition"
              aria-label="Add 5 minutes"
              title="Add 5 minutes"
            >
              <Plus size={16} /> 5 min
            </button>
          </div>
        )}
        {isWorkLike && (
          <Button
            variant="ghost"
            size="lg"
            onClick={addDistraction}
            title="Log a distraction"
          >
            <Zap size={18} /> Distracted{sessionDistractions > 0 ? ` · ${sessionDistractions}` : ''}
          </Button>
        )}
        <Button variant="ghost" size="lg" onClick={skip}>
          <SkipForward size={18} /> {queuedBreak ? 'Skip Break' : phase === 'flow' ? 'Wrap up' : 'Skip'}
        </Button>
        <Button variant="ghost" size="lg" onClick={abort}><X size={18} /> End</Button>
      </div>

      {phase !== 'breathing' && (
        <div className="hidden sm:flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-[11px] text-ink-400">
          <span><Kbd>Space</Kbd> {queuedBreak ? 'start' : isRunning ? 'pause' : 'resume'}</span>
          {canExtend && !queuedBreak && <span><Kbd>E</Kbd> +5 · <Kbd>⇧E</Kbd> −5</span>}
          <span><Kbd>S</Kbd> skip</span>
          <span><Kbd>Esc</Kbd> end</span>
        </div>
      )}
    </div>
  )
}

// Position in the current cycle toward the long break: filled = completed
// blocks, outlined = the one in progress.
function CycleDots({ total, done }: { total: number; done: number }) {
  return (
    <div
      className="flex items-center gap-1.5"
      title={`${done} of ${total} until the long break`}
      aria-label={`${done} of ${total} pomodoros until the long break`}
    >
      {Array.from({ length: total }, (_, i) => (
        <span
          key={i}
          className={`h-1.5 w-1.5 rounded-full ${
            i < done
              ? 'bg-accent'
              : i === done
                ? 'border border-accent'
                : 'bg-ink-200 dark:bg-ink-800'
          }`}
        />
      ))}
    </div>
  )
}

function ProjectPicker({ projects, value, onChange }: { projects: Project[]; value: string; onChange: (id: string) => void }) {
  if (projects.length === 0) return null
  // Inline chip picker for ≤5; styled select for more.
  if (projects.length <= 5) {
    return <ProjectChipPicker projects={projects} value={value} onChange={onChange} size="md" center />
  }
  const current = projects.find(p => p.id === value)
  return (
    <div className="flex justify-center">
      <div className="inline-flex items-center gap-3 rounded-full border border-ink-200 dark:border-ink-800 pl-3 pr-1 py-1">
        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: current?.color ?? '#999' }} />
        <select
          value={value}
          onChange={e => onChange(e.target.value)}
          className="bg-transparent text-sm text-ink-700 dark:text-ink-200 focus:outline-none pr-2 py-1"
        >
          {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </div>
    </div>
  )
}

function EditableIntention({ value, placeholder, onChange }: { value: string; placeholder: string; onChange: (v: string) => void }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)
  const inputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => { if (!editing) setDraft(value) }, [value, editing])
  useEffect(() => {
    if (editing) {
      inputRef.current?.focus()
      inputRef.current?.select()
    }
  }, [editing])

  const commit = () => {
    const next = draft.trim()
    onChange(next)
    setEditing(false)
  }
  const cancel = () => {
    setDraft(value)
    setEditing(false)
  }

  if (editing) {
    return (
      <div className="px-6 max-w-xl mx-auto">
        <input
          ref={inputRef}
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={e => {
            if (e.key === 'Enter') { e.preventDefault(); commit() }
            else if (e.key === 'Escape') { e.preventDefault(); cancel() }
          }}
          placeholder={placeholder}
          className="w-full bg-transparent border-0 border-b border-accent focus:ring-0 outline-none font-display text-2xl sm:text-3xl text-center text-ink-900 dark:text-ink-50 placeholder:italic placeholder:text-ink-300 dark:placeholder:text-ink-700 py-1 px-2"
        />
      </div>
    )
  }

  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      className="group inline-flex items-center justify-center gap-2 font-display text-2xl sm:text-3xl text-ink-900 dark:text-ink-50 px-6 max-w-xl mx-auto leading-tight hover:text-accent transition-colors"
      title="Edit task"
    >
      <span>{value || placeholder}</span>
      <Pencil size={14} className="opacity-0 group-hover:opacity-60 transition-opacity text-ink-500" />
    </button>
  )
}

function OtherTabBanner() {
  return (
    <div className="flex items-center gap-2 rounded-full border border-amber-300/60 dark:border-amber-500/30 bg-amber-50/80 dark:bg-amber-500/10 px-3 py-1.5 text-[11px] text-amber-900 dark:text-amber-200 shadow-sm">
      <AlertTriangle size={12} className="shrink-0" />
      <span className="truncate">A session is active in another tab. Starting one here will run a second timer.</span>
    </div>
  )
}

function ActiveTaskSwitcher({
  tasks,
  counts,
  currentTaskId,
  onPick,
}: {
  tasks: Task[]
  counts: Map<string, number>
  currentTaskId: string | null
  onPick: (t: Task) => void
}) {
  if (tasks.length === 0) return null
  return (
    <div className="flex flex-wrap justify-center gap-1.5 pt-1 max-w-xl mx-auto">
      {tasks.slice(0, 6).map(t => {
        const done = counts.get(t.id) ?? 0
        const selected = currentTaskId === t.id
        return (
          <button
            key={t.id}
            type="button"
            onClick={() => onPick(t)}
            className={
              'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] transition ' +
              (selected
                ? 'border-accent text-accent bg-accent/5'
                : 'border-ink-200 dark:border-ink-800 text-ink-500 hover:text-ink-800 dark:hover:text-ink-100 hover:border-accent/40')
            }
            title={`${done}/${t.estPomodoros} Pomodoros logged${selected ? ' · tap to unlink' : ''}`}
          >
            <span className="truncate max-w-[10rem]">{t.name}</span>
            <span className="text-[10px] tabular text-ink-400">{done}/{t.estPomodoros}</span>
          </button>
        )
      })}
    </div>
  )
}

function ProjectSwitcher({ projects, value, onChange }: { projects: Project[]; value: string; onChange: (id: string) => void }) {
  const [open, setOpen] = useState(false)
  useEffect(() => {
    if (!open) return
    const onDocClick = () => setOpen(false)
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    const t = setTimeout(() => document.addEventListener('click', onDocClick), 0)
    document.addEventListener('keydown', onKey)
    return () => {
      clearTimeout(t)
      document.removeEventListener('click', onDocClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const current = projects.find(p => p.id === value)
  if (!current) return null

  return (
    <div className="relative" onClick={e => e.stopPropagation()}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium hover:opacity-80 transition"
        style={{ backgroundColor: `${current.color}1a`, color: current.color }}
        title="Change project"
      >
        <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: current.color }} />
        {current.name}
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden>
          <path d="M2 4l3 3 3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open && (
        <div
          role="listbox"
          className="absolute left-1/2 -translate-x-1/2 mt-2 min-w-[12rem] max-h-64 overflow-y-auto rounded-xl border border-ink-200 dark:border-ink-800 bg-white dark:bg-ink-900 shadow-lg p-1 z-20"
        >
          {projects.map(p => {
            const selected = p.id === value
            return (
              <button
                key={p.id}
                type="button"
                role="option"
                aria-selected={selected}
                onClick={() => { onChange(p.id); setOpen(false) }}
                className={
                  'w-full flex items-center gap-2 rounded-lg px-2.5 py-2 text-sm text-left transition ' +
                  (selected
                    ? 'bg-ink-100 dark:bg-ink-800 text-ink-900 dark:text-ink-50'
                    : 'text-ink-700 dark:text-ink-200 hover:bg-ink-50 dark:hover:bg-ink-800')
                }
              >
                <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: p.color }} />
                <span className="truncate">{p.name}</span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

type IdleMode = 'focus' | 'flow' | 'break'

function ModePicker({ mode, onChange }: { mode: IdleMode; onChange: (m: IdleMode) => void }) {
  const tabs: Array<{ key: IdleMode; label: string }> = [
    { key: 'focus', label: 'Focus' },
    { key: 'flow', label: 'Flow' },
    { key: 'break', label: 'Break' },
  ]
  return (
    <div className="grid grid-cols-3 rounded-xl bg-ink-100 dark:bg-ink-900 p-1 gap-1">
      {tabs.map(t => (
        <button
          key={t.key}
          type="button"
          onClick={() => onChange(t.key)}
          className={
            'rounded-lg px-3 py-2 text-sm font-medium transition ' +
            (mode === t.key
              ? 'bg-white dark:bg-ink-800 text-ink-900 dark:text-ink-50 shadow-sm'
              : 'text-ink-500 hover:text-ink-700 dark:hover:text-ink-200')
          }
        >
          {t.label}
        </button>
      ))}
    </div>
  )
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-flex items-center rounded-md border border-ink-200 bg-ink-50 px-1.5 py-0.5 text-[10px] font-medium text-ink-600 dark:border-ink-700 dark:bg-ink-800 dark:text-ink-300">
      {children}
    </kbd>
  )
}

function ReflectionPanel() {
  const saveReflection = useTimer(s => s.saveReflection)
  const dismissReflection = useTimer(s => s.dismissReflection)
  const lastId = useTimer(s => s.lastCompletedPomodoroId)
  const [done, setDone] = useState('')
  const [next, setNext] = useState('')
  const [note, setNote] = useState('')
  const [tags, setTags] = useState<string[]>([])
  const [tagDraft, setTagDraft] = useState('')
  // The quick path is one line + tags; "next" and the free-form note sit
  // behind a disclosure so the after-every-Pomodoro modal stays light.
  const [moreOpen, setMoreOpen] = useState(false)
  const pom = useLiveQuery(async () => (lastId ? await db.pomodoros.get(lastId) : undefined), [lastId])
  const projects = useLiveQuery(() => listActiveProjects(), [], [])
  const project = pom ? (projects ?? []).find(p => p.id === pom.projectId) : null
  const allPoms = useLiveQuery(() => db.pomodoros.filter(p => !p.deletedAt).toArray(), [], [])
  const recentTagOptions = useMemo(
    () => recentTags(allPoms ?? [], 8).filter(t => !tags.includes(t)),
    [allPoms, tags],
  )
  const linkedTask = useLiveQuery(
    async () => (pom?.taskId ? await db.tasks.get(pom.taskId) : undefined),
    [pom?.taskId],
  )
  const linkedTaskCount = useLiveQuery(
    async () => (pom?.taskId
      ? await db.pomodoros.where('taskId').equals(pom.taskId).filter(p => !p.deletedAt).count()
      : 0),
    [pom?.taskId],
  ) ?? 0

  const hasAny = done.trim() || next.trim() || note.trim() || tags.length > 0

  const addTag = (raw: string) => {
    const t = raw.trim().toLowerCase()
    if (!t) return
    if (tags.includes(t)) return
    setTags(prev => [...prev, t])
    setTagDraft('')
  }
  const removeTag = (t: string) => setTags(prev => prev.filter(x => x !== t))

  const markTaskDone = async () => {
    if (!linkedTask || linkedTask.completed) return
    await db.tasks.update(linkedTask.id, { completed: true, completedAt: Date.now(), updatedAt: Date.now() })
  }

  return (
    <div className="mx-auto w-full max-w-xl px-4 sm:px-6 pt-10 sm:pt-16 pb-12 space-y-8">
      <div className="space-y-2 text-center">
        <div className="text-[11px] uppercase tracking-[0.22em] text-accent">Nice work</div>
        <h1 className="font-display text-3xl sm:text-4xl text-ink-900 dark:text-ink-50">How did it go?</h1>
        <p className="text-sm text-ink-500">A line is enough. Skip if you'd rather just rest.</p>
      </div>

      {pom && (
        <div className="space-y-1 text-center">
          {project && <div className="flex justify-center"><ProjectChip project={project} /></div>}
          <div className="text-base text-ink-800 dark:text-ink-100 mt-2">{pom.task || 'Focus session'}</div>
          <div className="text-xs text-ink-500 tabular">
            {fmtDuration(pom.actualSeconds)} focused
            {pom.distractions ? <> · <span className="text-amber-600 dark:text-amber-400">{pom.distractions} distraction{pom.distractions === 1 ? '' : 's'}</span></> : null}
          </div>
          {pom.calendarSyncedAt && (
            <div className="pt-1 flex items-center justify-center gap-1.5 text-[11px] text-emerald-600 dark:text-emerald-400">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Added to Google Calendar
            </div>
          )}
          {linkedTask && (
            <div className="pt-2 flex items-center justify-center gap-2 text-xs text-ink-500">
              <span className="tabular">{linkedTaskCount}/{linkedTask.estPomodoros}🍅</span>
              {!linkedTask.completed && (
                <button
                  type="button"
                  onClick={() => void markTaskDone()}
                  className="text-accent hover:underline"
                >
                  Mark task done
                </button>
              )}
              {linkedTask.completed && <span className="text-accent">✓ Done</span>}
            </div>
          )}
        </div>
      )}

      <div className="space-y-4">
        <PromptInput label="What did you finish?" value={done} onChange={setDone} placeholder="Shipped the calendar week view" />

        <div className="space-y-1.5">
          <span className="text-[11px] font-medium uppercase tracking-[0.18em] text-ink-400">Tags (optional)</span>
          {tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pb-1">
              {tags.map(t => (
                <span
                  key={t}
                  className="inline-flex items-center gap-1 rounded-full bg-accent/10 text-accent px-2.5 py-0.5 text-[11px]"
                >
                  {t}
                  <button
                    type="button"
                    onClick={() => removeTag(t)}
                    className="hover:opacity-70 text-[14px] leading-none"
                    aria-label={`Remove ${t}`}
                  >×</button>
                </span>
              ))}
            </div>
          )}
          <input
            value={tagDraft}
            onChange={e => setTagDraft(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addTag(tagDraft) }
              else if (e.key === 'Backspace' && tagDraft === '' && tags.length) { removeTag(tags[tags.length - 1]) }
            }}
            onBlur={() => { if (tagDraft.trim()) addTag(tagDraft) }}
            placeholder="deep, admin, meeting…"
            className="w-full bg-transparent border-0 border-b border-ink-200 dark:border-ink-800 focus:border-accent focus:ring-0 outline-none text-sm text-ink-900 dark:text-ink-50 py-1.5 px-1 placeholder:text-ink-300 dark:placeholder:text-ink-700 transition-colors"
          />
          {recentTagOptions.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-2">
              {recentTagOptions.map(t => (
                <button
                  key={t}
                  type="button"
                  onClick={() => addTag(t)}
                  className="text-[11px] text-ink-500 hover:text-ink-800 dark:hover:text-ink-100 px-2.5 py-0.5 rounded-full border border-ink-200 dark:border-ink-800 hover:border-accent/40 transition"
                >
                  + {t}
                </button>
              ))}
            </div>
          )}
        </div>

        {!moreOpen ? (
          <button
            type="button"
            onClick={() => setMoreOpen(true)}
            className="text-xs text-ink-400 hover:text-ink-700 dark:hover:text-ink-200 transition"
          >
            + Add more detail
          </button>
        ) : (
          <>
            <PromptInput label="What's next?" value={next} onChange={setNext} placeholder="Day-axis colour pass" />
            <label className="block space-y-1.5">
              <span className="text-[11px] font-medium uppercase tracking-[0.18em] text-ink-400">Anything else (optional)</span>
              <textarea
                value={note} onChange={e => setNote(e.target.value)}
                rows={3}
                placeholder="A blocker, an idea, how it felt…"
                className="w-full rounded-xl border border-ink-200 bg-white px-3 py-2.5 text-sm dark:bg-ink-900 dark:border-ink-700 dark:text-ink-100 resize-none focus:border-accent focus:ring-0 outline-none transition-colors"
              />
            </label>
          </>
        )}
      </div>

      <div className="flex gap-3 max-w-md mx-auto">
        <Button variant="secondary" className="flex-1" onClick={() => dismissReflection()}>Skip</Button>
        <Button className="flex-1" onClick={() => void saveReflection({ note, done, next, tags })} disabled={!hasAny}>Save reflection</Button>
      </div>
    </div>
  )
}

function PromptInput({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-[11px] font-medium uppercase tracking-[0.18em] text-ink-400">{label}</span>
      <input
        value={value} onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-transparent border-0 border-b border-ink-200 dark:border-ink-800 focus:border-accent focus:ring-0 outline-none text-base text-ink-900 dark:text-ink-50 py-2 px-1 placeholder:text-ink-300 dark:placeholder:text-ink-700 transition-colors"
      />
    </label>
  )
}
