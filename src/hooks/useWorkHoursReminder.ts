import { useEffect, useRef } from 'react'
import { useTimer } from '../store/timer'
import { useSettings } from './useSettings'
import { sendNotification } from '../lib/notify'
import { isWorkWindowActive, reminderDue } from '../lib/workHours'
import { chime } from '../audio/engine'

// Persistent "start a Pomodoro" nudges during a user-defined work-hours window.
// Fires only when idle inside the window; goes fully silent outside it (nights,
// weekends, disabled days) — so a MacBook used after hours gets nothing.

const CHECK_MS = 60_000

export function useWorkHoursReminder() {
  const s = useSettings()
  const wh = s.workHours
  const enabled = wh.enabled
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
    const days = daysKey.split(',').map(v => v === 'true')

    const check = () => {
      const now = new Date()
      if (!isWorkWindowActive(now, days, startMinutes, endMinutes)) {
        lastReminderRef.current = 0 // auto-deactivate outside hours / on off-days
        return
      }
      if (useTimer.getState().phase !== 'idle') {
        // A session is engaged. Disarm so the grace interval restarts fresh when
        // the user next goes idle, rather than firing an "you haven't started"
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
        'Time to focus',
        "You haven't started a Pomodoro yet. Start a focus block?",
        { onlyWhenHidden: false },
      )
      const { muted, chimeVolume } = audioRef.current
      if (!muted) chime('breakNudge', chimeVolume * 0.6)
    }

    check()
    const id = setInterval(check, CHECK_MS)
    return () => clearInterval(id)
  }, [enabled, startMinutes, endMinutes, intervalMin, daysKey])
}
