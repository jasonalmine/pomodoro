import { useEffect, useState } from 'react'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { ensureSeed } from './db'
import { useSettings } from './hooks/useSettings'
import { useTheme } from './hooks/useTheme'
import { useSync } from './hooks/useSync'
import { usePageTitle } from './hooks/usePageTitle'
import { useFaviconTimer } from './hooks/useFaviconTimer'
import { useTrayTimer } from './hooks/useTrayTimer'
import { useTimerTick } from './hooks/useTimerTick'
import { useAudioEffects } from './hooks/useAudioEffects'
import { useTimer } from './store/timer'
import { Nav } from './components/Nav'
import { PWAUpdatePrompt } from './components/PWAUpdatePrompt'
import { MenuBarPanel } from './components/MenuBarPanel'
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
  useTheme(settings.theme, settings.palette ?? 'ember')
  useSync()
  usePageTitle()
  useFaviconTimer()
  useTrayTimer()
  // Owns the single 250ms tick + audio/notification effects for the whole app so
  // the timer runs and chimes in both the compact panel and the full window.
  useTimerTick()
  useAudioEffects()
  useEffect(() => { void ensureSeed() }, [])

  // In the desktop shell the one window doubles as a menu-bar popover. Rust
  // emits 'app-mode' ('panel' | 'full') as it resizes/repositions the window.
  // On the web there's no Tauri, so we always render the full app.
  const [mode, setMode] = useState<'panel' | 'full'>(isTauri() ? 'panel' : 'full')
  useEffect(() => {
    if (!isTauri()) return
    let un: (() => void) | undefined
    let cancelled = false
    void import('@tauri-apps/api/event').then(({ listen }) =>
      listen<string>('app-mode', e => setMode(e.payload === 'full' ? 'full' : 'panel')).then(f => {
        if (cancelled) f()
        else un = f
      }),
    )
    return () => { cancelled = true; un?.() }
  }, [])

  return mode === 'panel' ? <MenuBarPanel /> : <FullApp />
}

export default function App() {
  return (
    <BrowserRouter>
      <Shell />
    </BrowserRouter>
  )
}
