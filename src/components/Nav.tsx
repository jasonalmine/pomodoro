import { NavLink } from 'react-router-dom'
import { BarChart3, CalendarDays, FolderKanban, Settings, Timer } from 'lucide-react'
import clsx from 'clsx'

const items = [
  { to: '/', label: 'Timer', Icon: Timer, end: true },
  { to: '/insights', label: 'Insights', Icon: BarChart3 },
  { to: '/calendar', label: 'Calendar', Icon: CalendarDays },
  { to: '/projects', label: 'Projects', Icon: FolderKanban },
  { to: '/settings', label: 'Settings', Icon: Settings },
]

export function Nav() {
  return (
    <>
      <aside className="hidden lg:flex flex-col w-56 shrink-0 border-r border-ink-200 dark:border-ink-800 p-4 gap-1">
        <div className="px-3 py-4">
          <div className="font-display text-2xl font-medium text-ink-900 dark:text-ink-50">Pomodoro</div>
          <div className="text-xs text-ink-500">focus, with care</div>
        </div>
        {items.map(({ to, label, Icon, end }) => (
          <NavLink key={to} to={to} end={end}
            className={({ isActive }) => clsx(
              'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition',
              isActive
                ? 'bg-accent/10 text-accent-strong dark:text-accent-soft font-medium'
                : 'text-ink-600 dark:text-ink-300 hover:bg-ink-100 dark:hover:bg-ink-900'
            )}
          >
            <Icon size={18} />
            {label}
          </NavLink>
        ))}
      </aside>

      <nav className="lg:hidden fixed bottom-0 inset-x-0 z-30 bg-white/95 dark:bg-ink-950/95 backdrop-blur border-t border-ink-200 dark:border-ink-800 safe-bottom">
        <div className="grid grid-cols-5 max-w-md mx-auto">
          {items.map(({ to, label, Icon, end }) => (
            <NavLink key={to} to={to} end={end}
              className={({ isActive }) => clsx(
                'flex flex-col items-center gap-0.5 py-2.5 text-[10px] uppercase tracking-wider transition',
                isActive ? 'text-accent' : 'text-ink-500'
              )}
            >
              <Icon size={20} />
              {label}
            </NavLink>
          ))}
        </div>
      </nav>
    </>
  )
}
