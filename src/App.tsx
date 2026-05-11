import { useEffect } from 'react'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { ensureSeed } from './db'
import { useSettings } from './hooks/useSettings'
import { useTheme } from './hooks/useTheme'
import { Nav } from './components/Nav'
import { TimerView } from './views/TimerView'
import { CalendarView } from './views/CalendarView'
import { ProjectsView } from './views/ProjectsView'
import { SettingsView } from './views/SettingsView'

function Shell() {
  const settings = useSettings()
  useTheme(settings.theme)
  useEffect(() => { void ensureSeed() }, [])

  return (
    <div className="min-h-full flex">
      <Nav />
      <main className="flex-1 min-w-0 pb-24 lg:pb-0">
        <Routes>
          <Route path="/" element={<TimerView />} />
          <Route path="/calendar" element={<CalendarView />} />
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
