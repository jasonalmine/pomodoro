import { useEffect } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Play, Pause, SkipForward, X, Maximize2, Coffee } from 'lucide-react'
import { useTimer, planFromSettings } from '../store/timer'
import { useSettings } from '../hooks/useSettings'
import { requestNotificationPermission } from '../hooks/useNotifications'
import { listActiveProjects } from '../db'
import { RingTimer } from './RingTimer'
import { Button } from './Button'

// Expand the popover into the full app window (handled in Rust).
function openFull() {
  if (typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window) {
    void import('@tauri-apps/api/core').then(({ invoke }) => invoke('open_full'))
  }
}

// Compact, flow.app-style menu-bar panel. Same webview / Zustand store as the
// full app, so the timer it drives is the one the tray countdown reflects.
export function MenuBarPanel() {
  const settings = useSettings()
  const phase = useTimer(s => s.phase)
  const isRunning = useTimer(s => s.isRunning)
  const planTask = useTimer(s => s.plan?.task)
  const prepare = useTimer(s => s.prepare)
  const start = useTimer(s => s.start)
  const pause = useTimer(s => s.pause)
  const resume = useTimer(s => s.resume)
  const skip = useTimer(s => s.skip)
  const abort = useTimer(s => s.abort)
  const startFlow = useTimer(s => s.startFlow)
  const dismissReflection = useTimer(s => s.dismissReflection)
  const selectedProjectId = useTimer(s => s.selectedProjectId)
  const setSelectedProjectId = useTimer(s => s.setSelectedProjectId)
  const storedTaskId = useTimer(s => s.selectedTaskId)

  const projects = useLiveQuery(() => listActiveProjects(), [], [])
  const active = (projects ?? []).filter(p => !p.archived)
  const projectId = selectedProjectId && active.some(p => p.id === selectedProjectId)
    ? selectedProjectId
    : active[0]?.id ?? ''

  useEffect(() => {
    if (!selectedProjectId && active[0]) setSelectedProjectId(active[0].id)
  }, [active, selectedProjectId, setSelectedProjectId])

  const idle = phase === 'idle'
  const reflect = phase === 'reflect'
  const inSession = !idle && !reflect
  const project = active.find(p => p.id === projectId)

  const beginFocus = async () => {
    if (!projectId) return
    if (settings.notifications) await requestNotificationPermission()
    const plan = planFromSettings(settings.timer, settings.ritual, {}, projectId, '', storedTaskId)
    prepare(plan)
    start()
  }

  return (
    <div className="h-screen w-screen flex flex-col bg-white dark:bg-ink-950 text-ink-900 dark:text-ink-50 overflow-hidden">
      {/* Drag handle (frameless window) + expand to full app. */}
      <div
        data-tauri-drag-region
        className="flex items-center justify-between px-3 h-11 border-b border-ink-100 dark:border-ink-900 select-none"
      >
        <span className="text-[11px] font-semibold tracking-[0.16em] text-ink-400">POMODORO</span>
        <button
          onClick={openFull}
          title="Open full app"
          className="p-1.5 rounded-lg text-ink-400 hover:text-ink-700 hover:bg-ink-100 dark:hover:text-ink-200 dark:hover:bg-ink-900"
        >
          <Maximize2 size={15} />
        </button>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center gap-4 px-4 pb-4">
        {inSession ? (
          <>
            <div className="scale-[0.8] origin-center">
              <RingTimer />
            </div>
            <div className="text-sm font-medium truncate max-w-[300px] text-center -mt-1">
              {planTask || project?.name || 'Focus'}
            </div>
            <div className="flex items-center gap-2">
              <Button onClick={() => (isRunning ? pause() : resume())} className="min-w-[112px]">
                {isRunning ? <><Pause size={16} /> Pause</> : <><Play size={16} /> Resume</>}
              </Button>
              <Button variant="secondary" onClick={skip} title="Skip / wrap up"><SkipForward size={16} /></Button>
              <Button variant="ghost" onClick={abort} title="End"><X size={16} /></Button>
            </div>
          </>
        ) : reflect ? (
          <div className="text-center space-y-4">
            <Coffee size={28} className="mx-auto text-accent" />
            <p className="text-sm text-ink-500">Session complete.</p>
            <div className="flex gap-2 justify-center">
              <Button onClick={openFull}>Log reflection</Button>
              <Button variant="ghost" onClick={() => dismissReflection()}>Skip</Button>
            </div>
          </div>
        ) : (
          <div className="w-full max-w-[320px] space-y-3">
            <div className="text-center text-sm text-ink-400">Ready to focus</div>
            {active.length > 0 ? (
              <>
                <select
                  value={projectId}
                  onChange={e => setSelectedProjectId(e.target.value)}
                  className="w-full rounded-xl border border-ink-200 bg-white px-3 h-11 text-sm dark:bg-ink-900 dark:border-ink-700 dark:text-ink-100"
                >
                  {active.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
                <Button className="w-full" size="lg" onClick={beginFocus} disabled={!projectId}>
                  <Play size={18} /> Start Focus
                </Button>
                <button
                  onClick={() => projectId && startFlow(projectId, storedTaskId, '', settings.timer)}
                  disabled={!projectId}
                  className="w-full text-xs text-ink-400 hover:text-ink-600 dark:hover:text-ink-300 disabled:opacity-40"
                >
                  or start a Flow session
                </button>
              </>
            ) : (
              <button onClick={openFull} className="w-full text-sm text-accent hover:underline">
                Create a project in the full app →
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
