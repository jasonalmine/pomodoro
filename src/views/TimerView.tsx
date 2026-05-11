import { useEffect, useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Pause, Play, SkipForward, X, Sparkles } from 'lucide-react'
import { useTimer, planFromSettings, remainingSec } from '../store/timer'
import { useSettings } from '../hooks/useSettings'
import { useTimerTick } from '../hooks/useTimerTick'
import { useWakeLock } from '../hooks/useWakeLock'
import { useNotificationRequest, requestNotificationPermission } from '../hooks/useNotifications'
import { useAudioEffects } from '../hooks/useAudioEffects'
import { db } from '../db'
import { Button } from '../components/Button'
import { TimerDisplay } from '../components/TimerDisplay'
import { BreathingCircle } from '../components/BreathingCircle'
import { ProjectChip } from '../components/ProjectChip'
import { fmtDuration } from '../lib/format'
import type { Phase } from '../types'

const PHASE_LABEL: Record<Phase, string> = {
  idle: 'Ready',
  breathing: 'Settle In',
  meditation: 'Meditation',
  work: 'Focus',
  shortBreak: 'Short Break',
  longBreak: 'Long Break',
  reflect: 'Reflect',
}

export function TimerView() {
  useTimerTick()
  useAudioEffects()

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
  const workCount = useTimer(s => s.workCount)

  const allProjects = useLiveQuery(() => db.projects.toArray(), [], [])
  const active = useMemo(() => (allProjects ?? []).filter(p => !p.archived), [allProjects])

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
      <div className="mx-auto w-full max-w-xl p-4 sm:p-6 space-y-6">
        <div className="space-y-1.5">
          <h1 className="font-display text-3xl sm:text-4xl text-ink-900 dark:text-ink-50">Start a Pomodoro</h1>
          <p className="text-sm text-ink-500">Choose a project, name the work, take a breath, focus.</p>
        </div>

        <Card>
          <Field label="Project">
            <select
              value={projectId}
              onChange={e => setProjectId(e.target.value)}
              className="w-full rounded-xl border border-ink-200 bg-white px-3 h-11 text-sm dark:bg-ink-900 dark:border-ink-700 dark:text-ink-100"
            >
              {(active ?? []).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </Field>

          <Field label="What are you working on?">
            <input
              value={task}
              onChange={e => setTask(e.target.value)}
              placeholder="Write the spec for the calendar view"
              className="w-full rounded-xl border border-ink-200 bg-white px-3 h-11 text-sm dark:bg-ink-900 dark:border-ink-700 dark:text-ink-100"
            />
          </Field>

          <div className="grid grid-cols-3 gap-3">
            <NumberField label="Work" value={workMinVal} onChange={setWorkMin} min={1} max={180} suffix="m" />
            <NumberField label="Short" value={shortMinVal} onChange={setShortMin} min={1} max={60} suffix="m" />
            <NumberField label="Long" value={longMinVal} onChange={setLongMin} min={1} max={120} suffix="m" />
          </div>

          <label className="flex items-center gap-3 text-sm text-ink-700 dark:text-ink-200 cursor-pointer">
            <input type="checkbox" checked={useRitualVal} onChange={e => setUseRitual(e.target.checked)} className="h-4 w-4 accent-ember-500" />
            <span className="flex items-center gap-1.5"><Sparkles size={14} className="text-ember-500" /> Pre-session breathing ritual</span>
          </label>
        </Card>

        <Button size="lg" className="w-full" onClick={onStart} disabled={!projectId || active.length === 0}>
          {useRitualVal ? 'Begin Ritual' : 'Start Focus'}
        </Button>

        {active.length === 0 && (
          <p className="text-center text-sm text-ink-500">Add a project from the Projects tab to get started.</p>
        )}
      </div>
    )
  }

  // Active phase
  return (
    <div className="mx-auto w-full max-w-2xl p-4 sm:p-8 flex flex-col items-center text-center gap-8">
      <div className="space-y-3">
        <div className="text-xs uppercase tracking-[0.18em] text-ink-400">{PHASE_LABEL[phase]}</div>
        {currentProject && <ProjectChip project={currentProject} />}
        <div className="text-sm text-ink-600 dark:text-ink-300 min-h-[1.25rem]">
          {useTimer.getState().plan?.task || (phase === 'work' ? 'Focus session' : '')}
        </div>
      </div>

      {phase === 'breathing' ? (
        <BreathingCircle />
      ) : (
        <TimerDisplay />
      )}

      {phase !== 'breathing' && breath == null && (
        <div className="text-xs text-ink-400">
          {phase === 'work' && <>Pomodoro {workCount + 1} · {fmtDuration(useTimer.getState().phaseDurationSec)} planned</>}
          {phase === 'meditation' && <>Sit · {fmtDuration(useTimer.getState().phaseDurationSec)}</>}
        </div>
      )}

      <div className="flex items-center gap-3">
        {isRunning ? (
          <Button variant="secondary" size="lg" onClick={pause}><Pause size={18} /> Pause</Button>
        ) : (
          <Button variant="primary" size="lg" onClick={resume}><Play size={18} /> Resume</Button>
        )}
        <Button variant="ghost" size="lg" onClick={skip}><SkipForward size={18} /> Skip</Button>
        <Button variant="ghost" size="lg" onClick={abort}><X size={18} /> End</Button>
      </div>

      <ProgressBar />
    </div>
  )
}

function ProgressBar() {
  const [, force] = useState(0)
  useEffect(() => {
    const id = setInterval(() => force(x => x + 1), 250)
    return () => clearInterval(id)
  }, [])
  const s = useTimer.getState()
  const percent = s.phaseDurationSec <= 0
    ? 0
    : Math.min(100, Math.max(0, (1 - remainingSec(s) / s.phaseDurationSec) * 100))
  return (
    <div className="w-full max-w-md h-1 rounded-full bg-ink-200 dark:bg-ink-800 overflow-hidden">
      <div className="h-full bg-ember-500 transition-all duration-100" style={{ width: `${percent}%` }} />
    </div>
  )
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl bg-white dark:bg-ink-900 border border-ink-200 dark:border-ink-800 p-5 space-y-4 shadow-sm">
      {children}
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-xs font-medium uppercase tracking-wider text-ink-500">{label}</span>
      {children}
    </label>
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
  const [note, setNote] = useState('')
  const pom = useLiveQuery(async () => (lastId ? await db.pomodoros.get(lastId) : undefined), [lastId])
  const projects = useLiveQuery(() => db.projects.toArray(), [], [])
  const project = pom ? (projects ?? []).find(p => p.id === pom.projectId) : null

  return (
    <div className="mx-auto w-full max-w-xl p-4 sm:p-6 space-y-6">
      <div className="space-y-1.5">
        <div className="text-xs uppercase tracking-[0.18em] text-ember-500">Nice work</div>
        <h1 className="font-display text-3xl sm:text-4xl text-ink-900 dark:text-ink-50">How did it go?</h1>
        <p className="text-sm text-ink-500">A line or two is plenty. You can skip and come back later.</p>
      </div>
      {pom && (
        <div className="rounded-2xl bg-white dark:bg-ink-900 border border-ink-200 dark:border-ink-800 p-5 space-y-3 shadow-sm">
          {project && <ProjectChip project={project} />}
          <div className="text-base text-ink-800 dark:text-ink-100">{pom.task}</div>
          <div className="text-xs text-ink-500">{fmtDuration(pom.actualSeconds)} focused</div>
          <textarea
            value={note} onChange={e => setNote(e.target.value)}
            rows={4} placeholder="What progressed? What blocked you? What's next?"
            className="w-full rounded-xl border border-ink-200 bg-white px-3 py-2.5 text-sm dark:bg-ink-900 dark:border-ink-700 dark:text-ink-100 resize-none"
          />
        </div>
      )}
      <div className="flex gap-3">
        <Button variant="secondary" className="flex-1" onClick={() => dismissReflection()}>Skip</Button>
        <Button className="flex-1" onClick={() => void saveReflection(note)} disabled={!note.trim()}>Save reflection</Button>
      </div>
    </div>
  )
}
