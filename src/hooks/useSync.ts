import { useEffect, useState } from 'react'
import { db } from '../db'
import { supabase, supabaseEnabled } from '../lib/supabase'
import { syncNow, getCurrentUser, getLastSyncedAt } from '../lib/sync'
import type { User } from '@supabase/supabase-js'

export type SyncState = {
  enabled: boolean
  user: User | null
  syncing: boolean
  lastError: string | null
  lastSyncedAt: number
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
  const [lastSyncedAt, setLastSyncedAt] = useState<number>(() => getLastSyncedAt())

  useEffect(() => {
    if (!supabaseEnabled || !supabase) return

    void getCurrentUser().then(setUser)

    const runSync = () => {
      setSyncing(true)
      void syncNow()
        .then(() => { setLastError(null); setLastSyncedAt(getLastSyncedAt()) })
        .catch((e) => setLastError(e instanceof Error ? e.message : String(e)))
        .finally(() => setSyncing(false))
    }

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      if (session?.user) runSync()
    })

    // Push on local writes (debounced).
    const onWrite = (_pk: unknown) => { schedulePush() }
    db.projects.hook('creating', onWrite)
    db.projects.hook('updating', onWrite)
    db.projects.hook('deleting', onWrite)
    db.pomodoros.hook('creating', onWrite)
    db.pomodoros.hook('updating', onWrite)
    db.pomodoros.hook('deleting', onWrite)
    db.tasks.hook('creating', onWrite)
    db.tasks.hook('updating', onWrite)
    db.tasks.hook('deleting', onWrite)
    db.templates.hook('creating', onWrite)
    db.templates.hook('updating', onWrite)
    db.templates.hook('deleting', onWrite)
    db.dayShutdowns.hook('creating', onWrite)
    db.dayShutdowns.hook('updating', onWrite)
    db.dayShutdowns.hook('deleting', onWrite)

    // Periodic + connectivity-triggered sync.
    const interval = setInterval(() => {
      void syncNow()
        .then(() => setLastSyncedAt(getLastSyncedAt()))
        .catch(() => {})
    }, 60_000)
    const onOnline = () => {
      void syncNow()
        .then(() => setLastSyncedAt(getLastSyncedAt()))
        .catch(() => {})
    }
    window.addEventListener('online', onOnline)
    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        void syncNow()
          .then(() => setLastSyncedAt(getLastSyncedAt()))
          .catch(() => {})
      }
    }
    document.addEventListener('visibilitychange', onVisible)

    return () => {
      sub.subscription.unsubscribe()
      db.projects.hook('creating').unsubscribe(onWrite)
      db.projects.hook('updating').unsubscribe(onWrite)
      db.projects.hook('deleting').unsubscribe(onWrite)
      db.pomodoros.hook('creating').unsubscribe(onWrite)
      db.pomodoros.hook('updating').unsubscribe(onWrite)
      db.pomodoros.hook('deleting').unsubscribe(onWrite)
      db.tasks.hook('creating').unsubscribe(onWrite)
      db.tasks.hook('updating').unsubscribe(onWrite)
      db.tasks.hook('deleting').unsubscribe(onWrite)
      db.templates.hook('creating').unsubscribe(onWrite)
      db.templates.hook('updating').unsubscribe(onWrite)
      db.templates.hook('deleting').unsubscribe(onWrite)
      db.dayShutdowns.hook('creating').unsubscribe(onWrite)
      db.dayShutdowns.hook('updating').unsubscribe(onWrite)
      db.dayShutdowns.hook('deleting').unsubscribe(onWrite)
      clearInterval(interval)
      window.removeEventListener('online', onOnline)
      document.removeEventListener('visibilitychange', onVisible)
      if (debounce) { clearTimeout(debounce); debounce = null }
    }
  }, [])

  return { enabled: supabaseEnabled, user, syncing, lastError, lastSyncedAt }
}
