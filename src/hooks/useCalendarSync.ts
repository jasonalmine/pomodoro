import { useEffect } from 'react'
import { flushUnsyncedCalendar } from '../lib/calendar'

// Auto-retry for Google Calendar sync. A focus block finished while offline (or
// during a transient Maton/Google failure) is saved locally but not pushed; this
// flushes any such unsynced blocks when connectivity returns or the tab is
// refocused, and once on load. flushUnsyncedCalendar no-ops unless sync is
// enabled + connected, so this is cheap when the feature is off.
export function useCalendarSync() {
  useEffect(() => {
    const flush = () => { void flushUnsyncedCalendar().catch(() => { /* surfaced via getLastCalendarError */ }) }
    flush()
    const onVisible = () => { if (document.visibilityState === 'visible') flush() }
    window.addEventListener('online', flush)
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      window.removeEventListener('online', flush)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [])
}
