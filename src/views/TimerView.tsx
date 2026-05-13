import { useEffect, useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Pause, Play, Plus, SkipForward, X, Coffee, Moon } from 'lucide-react'
import { useTimer, planFromSettings } from '../store/timer'
import { useSettings } from '../hooks/useSettings'
import { useTimerTick } from '../hooks/useTimerTick'
import { useWakeLock } from '../hooks/useWakeLock'
import { useNotificationRequest, requestNotificationPermission } from '../hooks/useNotifications'
import { useAudioEffects } from '../hooks/useAudioEffects'
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts'
import { db } from '../db'
import { Button } from '../components/Button'
import { RingTimer } from '../components/RingTimer'
import { GoalRing } from '../components/GoalRing'
import { BreathingCircle } from '../components/BreathingCircle'
import { ProjectChip } from '../components/ProjectChip'
import { fmtDuration } from '../lib/format'
import { todayBounds, totalsInWindow, recentTasks } from '../lib/stats'
import type { Project, Template } from '../types'
import { Bookmark } from 'lucide-react'

export function TimerView() {
  useTimerTick()
  useAudioEffects()
  useKeyboardShortcuts()

  const settings = useSettings()
  const phase = useTimer(s => s.phase)
  const isRunning = useTimer(s => s.isRunning)
  const breath = useTimer(s => s.breath)
  const prepare = useTimer(s => s.prepare)
  const start = useTimer(s => s.start)
  const pause = useTimer(s => s.pause)
  const resume = useTimer(s => s.resume)
  const skip = useTimer(s => s.skip)
  const abort = useTimer(s => s.abort)
  const extend = useTimer(s => s.extend)
  const workCount = useTimer(s => s.workCount)
  const startStandaloneBreak = useTimer(s => s.startStandaloneBreak)
  const phaseElapsedSec = useTimer(s => s.phaseElapsedSec)
  const phaseStartedAt = useTimer(s => s.phaseStartedAt)
  const phaseDurationSec = useTimer(s => s.phaseDurationSec)

  const [mode, setMode] = useState<'focus' | 'short' | 'long'>('focus')

  const allProjects = useLiveQuery(() => db.projects.toArray(), [], [])
  const active = useMemo(() => (allProjects ?? []).filter(p => !p.archived), [allProjects])

  const today = todayBounds()
  const todaysPoms = useLiveQuery(
    () => db.pomodoros.where('startedAt').between(today.start, today.end, true, true).toArray(),
    [today.start, today.end],
    [],
  )
  const todayCount = useMemo(() => totalsInWindow(todaysPoms ?? [], today.start, today.end).count, [todaysPoms, today.start, today.end])

  const recent = useLiveQuery(
    () => db.pomodoros.orderBy('startedAt').reverse().limit(30).toArray(),
    [],
    [],
  )
  const recentChips = useMemo(() => recentTasks(recent ?? [], 3), [recent])

  const templates = useLiveQuery(() => db.templates.orderBy('createdAt').toArray(), [], [])

  const applyTemplate = (t: Template) => {
    setWorkMin(t.workMinutes)
    setShortMin(t.shortBreakMinutes)
    setLongMin(t.longBreakMinutes)
    setUseRitual(t.useRitual)
    if (t.projectId && active.some(p => p.id === t.projectId)) setProjectId(t.projectId)
  }


  const [projectId, setProjectId] = useState<string>('')
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
  useEffect(() => { if (!projectId && active.length) setProjectId(active[0].id) }, [active, projectId])

  const workMinVal = workMin ?? settings.timer.workMinutes
  const shortMinVal = shortMin ?? settings.timer.shortBreakMinutes
  const longMinVal = longMin ?? settings.timer.longBreakMinutes
  const useRitualVal = useRitual ?? settings.ritual.enabled

  useNotificationRequest(settings.notifications)
  const wakeActive = isRunning && (phase === 'work' || phase === 'shortBreak' || phase === 'longBreak')
  useWakeLock(wakeActive, settings.wakeLock)

  const currentProject = (allProjects ?? []).find(p => p.id === projectId) ?? null

  const onStart = async () => {
    if (!projectId) return
    if (settings.notifications) await requestNotificationPermission()
    const plan = planFromSettings(
      settings.timer,
      settings.ritual,
      { workMinutes: workMinVal, shortBreakMinutes: shortMinVal, longBreakMinutes: longMinVal, useRitual: useRitualVal },
      projectId,
      task.trim(),
    )
    prepare(plan)
    start()
  }

  if (phase === 'reflect') return <ReflectionPanel />

  if (phase === 'idle') {
    return (
      <div className="mx-auto w-full max-w-2xl px-4 sm:px-6 pt-10 sm:pt-20 pb-12 space-y-10">
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
                  onChange={e => setTask(e.target.value)}
                  placeholder="Say what matters"
                  autoFocus
                  onKeyDown={e => { if (e.key === 'Enter' && projectId) void onStart() }}
                  className="w-full bg-transparent border-0 border-b border-ink-200 dark:border-ink-800 focus:border-accent focus:ring-0 outline-none font-display text-3xl sm:text-5xl text-center text-ink-900 dark:text-ink-50 placeholder:italic placeholder:text-ink-300 dark:placeholder:text-ink-700 py-3 px-2 transition-colors"
                />
              </div>
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

            <Button size="lg" className="w-full max-w-sm mx-auto flex" onClick={onStart} disabled={!projectId || active.length === 0}>
              {useRitualVal ? 'Begin Ritual' : 'Start Focus'}
            </Button>

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
              {workMinVal}m focus · adjust defaults in <a href="/settings" className="underline decoration-dotted hover:text-ink-700 dark:hover:text-ink-200">Settings</a>
            </p>
          </>
        ) : (
          <div className="space-y-8 text-center">
            <div className="space-y-2">
              <h1 className="font-display text-3xl sm:text-4xl text-ink-900 dark:text-ink-50">
                {mode === 'short' ? 'Take a short break' : 'Take a long break'}
              </h1>
              <p className="text-sm text-ink-500">Step away. The timer will let you know when time is up.</p>
            </div>

            <div className="max-w-xs mx-auto">
              {mode === 'short' ? (
                <NumberField label="Short break" value={shortMinVal} onChange={setShortMin} min={1} max={60} suffix="m" />
              ) : (
                <NumberField label="Long break" value={longMinVal} onChange={setLongMin} min={1} max={120} suffix="m" />
              )}
            </div>

            <Button
              size="lg"
              className="w-full max-w-sm mx-auto flex"
              onClick={() => startStandaloneBreak(mode === 'short' ? 'short' : 'long', mode === 'short' ? shortMinVal : longMinVal)}
            >
              {mode === 'short' ? 'Start Short Break' : 'Start Long Break'}
            </Button>
          </div>
        )}
      </div>
    )
  }

  // Active phase
  const canExtend = phase === 'work' || phase === 'shortBreak' || phase === 'longBreak'
  const isBreakPhase = phase === 'shortBreak' || phase === 'longBreak'
  const queuedBreak = isBreakPhase && !isRunning && phaseElapsedSec === 0 && phaseStartedAt === null
  const breakLabel = phase === 'longBreak' ? 'Long Break' : 'Short Break'

  const intentionText = queuedBreak
    ? `Time for a ${phase === 'longBreak' ? 'long' : 'short'} break`
    : isBreakPhase
      ? `On a ${phase === 'longBreak' ? 'long' : 'short'} break`
      : (useTimer.getState().plan?.task || (phase === 'work' ? 'Focus session' : phase === 'breathing' ? 'Breathe' : phase === 'meditation' ? 'Sit' : ''))

  return (
    <div className="mx-auto w-full max-w-2xl min-h-screen p-4 sm:p-8 flex flex-col items-center justify-center text-center gap-8 relative">
      <div className="absolute top-4 right-4 sm:top-6 sm:right-6">
        <GoalRing current={todayCount} goal={settings.dailyGoalPomodoros} size={44} />
      </div>

      <div key={phase} className="space-y-2 animate-[fadeIn_300ms_ease-out]">
        {currentProject && phase === 'work' && (
          <div className="flex justify-center"><ProjectChip project={currentProject} /></div>
        )}
        <div className="font-display text-2xl sm:text-3xl text-ink-900 dark:text-ink-50 px-6 max-w-xl mx-auto leading-tight">
          {intentionText}
        </div>
      </div>

      <div key={`ring-${phase}`} className="animate-[ringIn_400ms_ease-out]">
        {phase === 'breathing' ? <BreathingCircle /> : <RingTimer />}
      </div>

      {phase !== 'breathing' && breath == null && (
        <div className="text-[11px] uppercase tracking-[0.18em] text-ink-400">
          {phase === 'work' && <>Pomodoro {workCount + 1} · {fmtDuration(phaseDurationSec)} planned</>}
          {phase === 'meditation' && <>Sit · {fmtDuration(phaseDurationSec)}</>}
          {isBreakPhase && !queuedBreak && <>{breakLabel} · {fmtDuration(phaseDurationSec)}</>}
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
          <Button variant="ghost" size="lg" onClick={() => extend(5 * 60)}><Plus size={18} /> 5 min</Button>
        )}
        <Button variant="ghost" size="lg" onClick={skip}><SkipForward size={18} /> {queuedBreak ? 'Skip Break' : 'Skip'}</Button>
        <Button variant="ghost" size="lg" onClick={abort}><X size={18} /> End</Button>
      </div>

      {phase !== 'breathing' && (
        <div className="hidden sm:flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-[11px] text-ink-400">
          <span><Kbd>Space</Kbd> {queuedBreak ? 'start' : isRunning ? 'pause' : 'resume'}</span>
          {canExtend && !queuedBreak && <span><Kbd>E</Kbd> +5 min</span>}
          <span><Kbd>S</Kbd> skip</span>
          <span><Kbd>Esc</Kbd> end</span>
        </div>
      )}
    </div>
  )
}

function ProjectPicker({ projects, value, onChange }: { projects: Project[]; value: string; onChange: (id: string) => void }) {
  if (projects.length === 0) return null
  // Inline chip picker for ≤5; styled select for more.
  if (projects.length <= 5) {
    return (
      <div className="flex flex-wrap justify-center gap-2">
        {projects.map(p => {
          const selected = p.id === value
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => onChange(p.id)}
              className={
                'inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-sm transition ' +
                (selected
                  ? 'border-transparent text-white shadow-sm'
                  : 'border-ink-200 dark:border-ink-800 text-ink-600 dark:text-ink-300 hover:border-ink-300 dark:hover:border-ink-700')
              }
              style={selected ? { backgroundColor: p.color } : undefined}
            >
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: selected ? 'rgba(255,255,255,0.85)' : p.color }} />
              {p.name}
            </button>
          )
        })}
      </div>
    )
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

function ModePicker({ mode, onChange }: { mode: 'focus' | 'short' | 'long'; onChange: (m: 'focus' | 'short' | 'long') => void }) {
  const tabs: Array<{ key: 'focus' | 'short' | 'long'; label: string }> = [
    { key: 'focus', label: 'Focus' },
    { key: 'short', label: 'Short Break' },
    { key: 'long', label: 'Long Break' },
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

function NumberField({ label, value, onChange, min, max, suffix }: { label: string; value: number; onChange: (v: number) => void; min: number; max: number; suffix?: string }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-xs font-medium uppercase tracking-wider text-ink-500">{label}</span>
      <div className="relative">
        <input
          type="number" inputMode="numeric" min={min} max={max} value={value}
          onChange={e => onChange(Math.max(min, Math.min(max, Number(e.target.value) || min)))}
          className="w-full rounded-xl border border-ink-200 bg-white px-3 h-11 text-sm tabular dark:bg-ink-900 dark:border-ink-700 dark:text-ink-100 pr-7"
        />
        {suffix && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-ink-400">{suffix}</span>}
      </div>
    </label>
  )
}

function ReflectionPanel() {
  const saveReflection = useTimer(s => s.saveReflection)
  const dismissReflection = useTimer(s => s.dismissReflection)
  const lastId = useTimer(s => s.lastCompletedPomodoroId)
  const [done, setDone] = useState('')
  const [next, setNext] = useState('')
  const [note, setNote] = useState('')
  const pom = useLiveQuery(async () => (lastId ? await db.pomodoros.get(lastId) : undefined), [lastId])
  const projects = useLiveQuery(() => db.projects.toArray(), [], [])
  const project = pom ? (projects ?? []).find(p => p.id === pom.projectId) : null

  const hasAny = done.trim() || next.trim() || note.trim()

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
          <div className="text-xs text-ink-500 tabular">{fmtDuration(pom.actualSeconds)} focused</div>
        </div>
      )}

      <div className="space-y-4">
        <PromptInput label="What did you finish?" value={done} onChange={setDone} placeholder="Shipped the calendar week view" />
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
      </div>

      <div className="flex gap-3 max-w-md mx-auto">
        <Button variant="secondary" className="flex-1" onClick={() => dismissReflection()}>Skip</Button>
        <Button className="flex-1" onClick={() => void saveReflection({ note, done, next })} disabled={!hasAny}>Save reflection</Button>
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
