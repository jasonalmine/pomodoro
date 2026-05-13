import { useEffect } from 'react'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { ensureSeed } from './db'
import { useSettings } from './hooks/useSettings'
import { useTheme } from './hooks/useTheme'
import { useSync } from './hooks/useSync'
import { usePageTitle } from './hooks/usePageTitle'
import { useFaviconTimer } from './hooks/useFaviconTimer'
import { useTimer } from './store/timer'
import { Nav } from './components/Nav'
import { TimerView } from './views/TimerView'
import { CalendarView } from './views/CalendarView'
import { InsightsView } from './views/InsightsView'
import { ProjectsView } from './views/ProjectsView'
import { SettingsView } from './views/SettingsView'

function Shell() {
  const settings = useSettings()
  useTheme(settings.theme, settings.palette ?? 'ember')
  useSync()
  usePageTitle()
  useFaviconTimer()
  useEffect(() => { void ensureSeed() }, [])

  const phase = useTimer(s => s.phase)
  const inSession = phase !== 'idle' && phase !== 'reflect'

  return (
    <div className="min-h-full flex">
      {!inSession && <Nav />}
      <main className={`flex-1 min-w-0 ${inSession ? '' : 'pb-24 lg:pb-0'}`}>
        <Routes>
          <Route path="/" element={<TimerView />} />
          <Route path="/calendar" element={<CalendarView />} />
          <Route path="/insights" element={<InsightsView />} />
          <Route path="/projects" element={<ProjectsView />} />
          <Route path="/settings" element={<SettingsView />} />
        </Routes>
      </main>
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <Shell />
    </BrowserRouter>
  )
}
