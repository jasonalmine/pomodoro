import { useEffect, useRef } from 'react'
import { useTimer } from '../store/timer'
import { useSettings } from './useSettings'
import { ensureNotificationPermission, sendNotification } from '../lib/notify'
import { isWorkWindowActive, reminderDue } from '../lib/workHours'
import { chime } from '../audio/engine'

// Persistent nudges to get you back into one of two tracked states (a focus
// block or a break) whenever you're idle. Defaults to always-on; a
// user-defined day/time window is available as an opt-in alternative
// (workHours.alwaysOn === false).

const CHECK_MS = 60_000

export function useWorkHoursReminder() {
  const s = useSettings()
  const wh = s.workHours
  const enabled = wh.enabled
  const alwaysOn = wh.alwaysOn
  const startMinutes = wh.startMinutes
  const endMinutes = wh.endMinutes
  const intervalMin = wh.reminderIntervalMin
  const daysKey = wh.days.join(',') // stable primitive dep for the boolean[]

  // Read the live audio settings inside the interval without making them deps
  // (so tweaking volume doesn't tear down and reset the reminder clock).
  const audioRef = useRef({ muted: s.audio.muted, chimeVolume: s.audio.chimeVolume })
  useEffect(() => {
    audioRef.current = { muted: s.audio.muted, chimeVolume: s.audio.chimeVolume }
  }, [s.audio.muted, s.audio.chimeVolume])

  // Epoch ms of the last nudge for the current idle-in-window stretch. 0 means
  // "not currently armed" — reset whenever we fall outside the window.
  const lastReminderRef = useRef(0)

  useEffect(() => {
    if (!enabled) {
      lastReminderRef.current = 0
      return
    }
    // Request permission here too (not only from the Settings toggle's
    // onChange), so a row that became enabled via a defaults migration still
    // gets prompted on next launch.
    void ensureNotificationPermission()

    const days = daysKey.split(',').map(v => v === 'true')

    const check = () => {
      const now = new Date()
      if (!isWorkWindowActive(now, days, startMinutes, endMinutes, alwaysOn)) {
        lastReminderRef.current = 0 // auto-deactivate outside hours / on off-days
        return
      }
      const phase = useTimer.getState().phase
      // idle and reflect both mean "not currently tracking a focus block or a
      // break" — reflect is a decision point, not a tracked state, so a
      // session left sitting there still counts as a gap.
      if (phase !== 'idle' && phase !== 'reflect') {
        // A session is engaged. Disarm so the grace interval restarts fresh when
        // the user next goes idle, rather than firing an "you're not tracking"
        // nudge the instant a just-finished session returns to idle.
        lastReminderRef.current = 0
        return
      }

      const nowTs = now.getTime()
      // Seed on the first idle-in-window tick so the first nudge lands ~one
      // interval later, not the instant the window opens.
      if (lastReminderRef.current === 0) {
        lastReminderRef.current = nowTs
        return
      }
      if (!reminderDue(lastReminderRef.current, nowTs, intervalMin)) return

      lastReminderRef.current = nowTs
      void sendNotification(
        'Still idle',
        "You're not tracking anything. Start a focus block or take a break?",
        { onlyWhenHidden: false },
      )
      const { muted, chimeVolume } = audioRef.current
      if (!muted) chime('breakNudge', chimeVolume * 0.6)
    }

    check()
    const id = setInterval(check, CHECK_MS)
    return () => clearInterval(id)
  }, [enabled, alwaysOn, startMinutes, endMinutes, intervalMin, daysKey])
}
