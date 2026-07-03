import { useEffect, useRef } from 'react'
import { overflowSec, useTimer } from '../store/timer'
import { useSettings } from './useSettings'
import { applySettings, breathCue, chime, setAmbient, setAmbientVolume, setKeepAlive, setMasterVolume, unlockAudio } from '../audio/engine'
import { notify } from './useNotifications'
import type { Phase } from '../types'

export function useAudioEffects() {
  const phase = useTimer(s => s.phase)
  const breath = useTimer(s => s.breath)
  const isOverflow = useTimer(s => s.isOverflow)
  const settings = useSettings()
  const prevPhase = useRef(phase)
  const prevBreathStage = useRef<string | null>(null)
  const prevOverflow = useRef(false)

  // master volume + mute reactive
  useEffect(() => {
    setMasterVolume(settings.audio.master, settings.audio.muted)
    setAmbientVolume(settings.audio.ambientVolume)
    applySettings(settings.audio)
  }, [settings.audio])

  // Switch ambient track only when phase, track id, or mute state changes.
  useEffect(() => {
    const active = (phase === 'work' || phase === 'flow') && settings.audio.ambient !== 'none' && !settings.audio.muted
    setAmbient(active ? settings.audio.ambient : 'none', settings.audio.ambientVolume)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, settings.audio.ambient, settings.audio.muted])

  // Volume slider updates the live gain without rebuilding the buffer.
  useEffect(() => {
    setAmbientVolume(settings.audio.ambientVolume)
  }, [settings.audio.ambientVolume])

  // notifications on phase transitions
  useEffect(() => {
    const prev = prevPhase.current
    if (prev !== phase) {
      if (settings.notifications) {
        if (phase === 'shortBreak' || phase === 'longBreak') notify('Work session done', 'Take a breather.')
        else if (phase === 'work' && prev !== 'idle') notify('Break over', 'Back to focus.')
        else if (phase === 'reflect') notify('Pomodoro complete', 'Capture a quick reflection.')
      }
      prevPhase.current = phase
    }
  }, [phase, settings.notifications])

  // notification at overflow boundary (false → true) for hidden tabs
  useEffect(() => {
    if (!prevOverflow.current && isOverflow && settings.notifications) {
      if (phase === 'work') notify('Planned focus complete', 'In overtime. End or extend when ready.')
      else if (phase === 'shortBreak' || phase === 'longBreak') notify('Break over', 'In overtime. Get back to it when ready.')
    }
    prevOverflow.current = isOverflow
  }, [isOverflow, phase, settings.notifications])

  // breath cue on inhale/exhale start
  useEffect(() => {
    if (!breath || !settings.ritual.breathCues || settings.audio.muted) {
      prevBreathStage.current = null
      return
    }
    const key = `${breath.cycle}-${breath.stage}`
    if (prevBreathStage.current !== key) {
      if (breath.stage === 'inhale') breathCue('in', settings.audio.breathCueVolume)
      else if (breath.stage === 'exhale') breathCue('out', settings.audio.breathCueVolume)
      prevBreathStage.current = key
    }
  }, [breath, settings.ritual.breathCues, settings.audio.breathCueVolume, settings.audio.muted])

  // unlock audio on first user gesture
  useEffect(() => {
    const onGesture = () => { unlockAudio() }
    window.addEventListener('pointerdown', onGesture, { once: true })
    window.addEventListener('keydown', onGesture, { once: true })
    return () => {
      window.removeEventListener('pointerdown', onGesture)
      window.removeEventListener('keydown', onGesture)
    }
  }, [])

  // Keep the AudioContext running for the whole session so boundary cues
  // fired while the window is hidden (menu-bar popover closed) aren't
  // scheduled on a suspended clock. Also re-resume whenever the window
  // becomes visible or focused.
  useEffect(() => {
    setKeepAlive(phase !== 'idle')
    return () => setKeepAlive(false)
  }, [phase])

  useEffect(() => {
    const onVisible = () => { if (!document.hidden) unlockAudio() }
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', onVisible)
    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', onVisible)
    }
  }, [])

  // Gentle repeating cues, quieter than boundary chimes:
  // - E5 bell every 2 minutes while a focus block runs in overtime.
  // - D4 nudge (up to 3, 2 minutes apart) while a queued break sits
  //   unstarted, or after a break ended and nothing was started.
  const isRunning = useTimer(s => s.isRunning)
  const overtimeBucketRef = useRef(0)
  const nudgeKindRef = useRef<'queuedBreak' | 'postBreak' | null>(null)
  const nudgeSinceRef = useRef(0)
  const nudgeFiredRef = useRef(0)
  const prevReminderPhaseRef = useRef<Phase>(phase)

  useEffect(() => {
    const prev = prevReminderPhaseRef.current
    prevReminderPhaseRef.current = phase
    const s = useTimer.getState()
    const isBreak = phase === 'shortBreak' || phase === 'longBreak'
    const queuedBreak = isBreak && !isRunning && s.phaseStartedAt === null && s.phaseElapsedSec === 0
    const endedIntoIdle = phase === 'idle' && (prev === 'shortBreak' || prev === 'longBreak')
    if (queuedBreak && nudgeKindRef.current !== 'queuedBreak') {
      nudgeKindRef.current = 'queuedBreak'
      nudgeSinceRef.current = Date.now()
      nudgeFiredRef.current = 0
    } else if (endedIntoIdle) {
      nudgeKindRef.current = 'postBreak'
      nudgeSinceRef.current = Date.now()
      nudgeFiredRef.current = 0
    } else if (!queuedBreak && !(phase === 'idle' && nudgeKindRef.current === 'postBreak')) {
      nudgeKindRef.current = null
    }
  }, [phase, isRunning])

  useEffect(() => {
    const REMIND_EVERY_MS = 2 * 60 * 1000
    const id = setInterval(() => {
      if (settings.audio.muted) return
      const s = useTimer.getState()
      const vol = settings.audio.chimeVolume * 0.6
      if (s.phase === 'work' && s.isOverflow && s.isRunning) {
        const bucket = Math.floor((overflowSec(s) * 1000) / REMIND_EVERY_MS)
        if (bucket >= 1 && bucket > overtimeBucketRef.current) {
          overtimeBucketRef.current = bucket
          chime('focusOvertime', vol)
        }
      } else {
        overtimeBucketRef.current = 0
      }
      if (nudgeKindRef.current) {
        const bucket = Math.floor((Date.now() - nudgeSinceRef.current) / REMIND_EVERY_MS)
        if (bucket >= 1 && bucket > nudgeFiredRef.current && nudgeFiredRef.current < 3) {
          nudgeFiredRef.current = bucket
          chime('breakNudge', vol)
        }
      }
    }, 15000)
    return () => clearInterval(id)
  }, [settings.audio.muted, settings.audio.chimeVolume])
}
