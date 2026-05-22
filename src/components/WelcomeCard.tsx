import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Sparkles, X } from 'lucide-react'
import { db } from '../db'

const DISMISSED_KEY = 'pomodoro.welcomeDismissed'

// Soft first-run welcome shown on the idle Timer screen when zero Pomodoros
// have been logged AND the user hasn't dismissed it. Disappears naturally
// after the first saved session.
export function WelcomeCard() {
  const pomCount = useLiveQuery(() => db.pomodoros.count(), [], 0)
  const [dismissed, setDismissed] = useState<boolean>(() => {
    try { return localStorage.getItem(DISMISSED_KEY) === '1' } catch { return false }
  })

  useEffect(() => {
    if (dismissed) {
      try { localStorage.setItem(DISMISSED_KEY, '1') } catch { /* ignore */ }
    }
  }, [dismissed])

  if (dismissed) return null
  if (pomCount > 0) return null

  return (
    <div className="relative rounded-2xl border border-accent/30 bg-accent/5 dark:bg-accent/10 p-5 space-y-2.5">
      <button
        type="button"
        onClick={() => setDismissed(true)}
        aria-label="Dismiss"
        className="absolute top-3 right-3 h-7 w-7 rounded-full flex items-center justify-center text-ink-400 hover:text-ink-800 dark:hover:text-ink-100 hover:bg-ink-100 dark:hover:bg-ink-800 transition"
      >
        <X size={14} />
      </button>
      <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.22em] text-accent">
        <Sparkles size={12} /> Welcome
      </div>
      <h2 className="font-display text-2xl sm:text-3xl text-ink-900 dark:text-ink-50 leading-tight">
        A focus timer with room to reflect.
      </h2>
      <p className="text-sm text-ink-600 dark:text-ink-300 leading-relaxed">
        Pick a project, name what you're working on, breathe in for a moment, then start. After each session you'll have a chance to capture what you finished and what's next — that's where the real value compounds.
      </p>
      <p className="text-xs text-ink-500 pt-1">
        Everything lives in your browser. Optional cloud sync, AI weekly review, and an "Add to Home Screen" install are all in <a href="/settings" className="underline decoration-dotted hover:text-ink-800 dark:hover:text-ink-100">Settings</a>.
      </p>
    </div>
  )
}
