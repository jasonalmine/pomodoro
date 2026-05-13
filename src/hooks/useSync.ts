import { useEffect, useState } from 'react'
import { db } from '../db'
import { supabase, supabaseEnabled } from '../lib/supabase'
import { syncNow, getCurrentUser } from '../lib/sync'
import type { User } from '@supabase/supabase-js'

export type SyncState = {
  enabled: boolean
  user: User | null
  syncing: boolean
  lastError: string | null
}

let debounce: ReturnType<typeof setTimeout> | null = null

function schedulePush() {
  if (!supabaseEnabled) return
  if (debounce) clearTimeout(debounce)
  debounce = setTimeout(() => {
    void syncNow().catch(() => {/* surfaced via state */})
  }, 1500)
}

export function useSync(): SyncState {
  const [user, setUser] = useState<User | null>(null)
  const [syncing, setSyncing] = useState(false)
  const [lastError, setLastError] = useState<string | null>(null)

  useEffect(() => {
    if (!supabaseEnabled || !supabase) return

    void getCurrentUser().then(setUser)

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      if (session?.user) {
        setSyncing(true)
        void syncNow()
          .then(() => setLastError(null))
          .catch((e) => setLastError(e instanceof Error ? e.message : String(e)))
          .finally(() => setSyncing(false))
      }
    })

    // Push on local writes (debounced).
    const projectHook = (_pk: unknown) => { schedulePush() }
    const pomodoroHook = (_pk: unknown) => { schedulePush() }
    db.projects.hook('creating', projectHook)
    db.projects.hook('updating', projectHook)
    db.projects.hook('deleting', projectHook)
    db.pomodoros.hook('creating', pomodoroHook)
    db.pomodoros.hook('updating', pomodoroHook)
    db.pomodoros.hook('deleting', pomodoroHook)

    // Periodic + connectivity-triggered sync.
    const interval = setInterval(() => { void syncNow().catch(() => {}) }, 60_000)
    const onOnline = () => { void syncNow().catch(() => {}) }
    window.addEventListener('online', onOnline)
    const onVisible = () => { if (document.visibilityState === 'visible') void syncNow().catch(() => {}) }
    document.addEventListener('visibilitychange', onVisible)

    return () => {
      sub.subscription.unsubscribe()
      db.projects.hook('creating').unsubscribe(projectHook)
      db.projects.hook('updating').unsubscribe(projectHook)
      db.projects.hook('deleting').unsubscribe(projectHook)
      db.pomodoros.hook('creating').unsubscribe(pomodoroHook)
      db.pomodoros.hook('updating').unsubscribe(pomodoroHook)
      db.pomodoros.hook('deleting').unsubscribe(pomodoroHook)
      clearInterval(interval)
      window.removeEventListener('online', onOnline)
      document.removeEventListener('visibilitychange', onVisible)
      if (debounce) { clearTimeout(debounce); debounce = null }
    }
  }, [])

  return { enabled: supabaseEnabled, user, syncing, lastError }
}
