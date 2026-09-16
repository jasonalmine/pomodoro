import { useEffect, useState } from 'react'
import { BrowserRouter, Route, Routes, useNavigate } from 'react-router-dom'
import { ensureSeed } from './db'
import { crumb } from './lib/breadcrumb'
import { useSettings } from './hooks/useSettings'
import { useTheme } from './hooks/useTheme'
import { useSync } from './hooks/useSync'
import { usePageTitle } from './hooks/usePageTitle'
import { useFaviconTimer } from './hooks/useFaviconTimer'
import { useTrayTimer } from './hooks/useTrayTimer'
import { useTimerTick } from './hooks/useTimerTick'
import { useAudioEffects } from './hooks/useAudioEffects'
import { useWorkHoursReminder } from './hooks/useWorkHoursReminder'
import { useAccentFromFocus } from './hooks/useAccentFromFocus'
import { useTimer } from './store/timer'
import { Nav } from './components/Nav'
import { PWAUpdatePrompt } from './components/PWAUpdatePrompt'
import { MenuBarPanel } from './components/MenuBarPanel'
import { ConfirmHost } from './components/ConfirmDialog'
import { TimerView } from './views/TimerView'
import { CalendarView } from './views/CalendarView'
import { InsightsView } from './views/InsightsView'
import { ProjectsView } from './views/ProjectsView'
import { SettingsView } from './views/SettingsView'

function isTauri() {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window
}

function FullApp() {
  const phase = useTimer(s => s.phase)
  const inSession = phase !== 'idle' && phase !== 'reflect'
  return (
    <div className="min-h-full flex">
      <Nav collapsed={inSession} />
      <main className="flex-1 min-w-0 pb-24 lg:pb-0">
        <Routes>
          <Route path="/" element={<TimerView />} />
          <Route path="/calendar" element={<CalendarView />} />
          <Route path="/insights" element={<InsightsView />} />
          <Route path="/projects" element={<ProjectsView />} />
          <Route path="/settings" element={<SettingsView />} />
        </Routes>
      </main>
      <PWAUpdatePrompt />
    </div>
  )
}

function Shell() {
  const settings = useSettings()
  useTheme(settings.theme, settings.palette ?? 'coral', settings.customAccent)
  useSync()
  usePageTitle()
  useFaviconTimer()
  useTrayTimer()
  // Owns the single 250ms tick + audio/notification effects for the whole app so
  // the timer runs and chimes in both the compact panel and the full window.
  useTimerTick()
  useAudioEffects()
  useWorkHoursReminder()
  useAccentFromFocus()
  useEffect(() => {
    ensureSeed().then(() => crumb('seed', 'ok'), (e: unknown) => crumb('seed', `err ${String(e)}`))
  }, [])

  // In the desktop shell the one window doubles as a menu-bar popover. Rust
  // emits 'app-mode' ('panel' | 'full') as it resizes/repositions the window.
  // On the web there's no Tauri, so we always render the full app.
  const [mode, setMode] = useState<'panel' | 'full'>(isTauri() ? 'panel' : 'full')
  // In the desktop full window, shrinking it narrow also shows the compact
  // timer view; widening it brings the full layout back. Web keeps the full
  // app (it has its own mobile layout).
  const [narrow, setNarrow] = useState(false)
  useEffect(() => {
    if (!isTauri()) return
    const mq = window.matchMedia('(max-width: 520px)')
    const apply = () => setNarrow(mq.matches)
    apply()
    mq.addEventListener('change', apply)
    return () => mq.removeEventListener('change', apply)
  }, [])
  const navigate = useNavigate()
  useEffect(() => {
    if (!isTauri()) return
    const uns: Array<() => void> = []
    let cancelled = false
    void import('@tauri-apps/api/event').then(async ({ listen }) => {
      const a = await listen<string>('app-mode', e => setMode(e.payload === 'full' ? 'full' : 'panel'))
      // Rust emits this right after 'app-mode: full' to deep-link a page
      // (tray "Settings…", panel gear).
      const b = await listen<string>('app-route', e => navigate(e.payload))
      if (cancelled) { a(); b() } else uns.push(a, b)
    })
    return () => { cancelled = true; uns.forEach(f => f()) }
  }, [navigate])

  return (
    <>
      {mode === 'panel' || narrow ? <MenuBarPanel /> : <FullApp />}
      <ConfirmHost />
    </>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <Shell />
    </BrowserRouter>
  )
}
