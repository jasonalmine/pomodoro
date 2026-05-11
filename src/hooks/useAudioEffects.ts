import { useEffect, useRef } from 'react'
import { useTimer } from '../store/timer'
import { useSettings } from './useSettings'
import { applySettings, breathCue, setAmbient, setAmbientVolume, setMasterVolume, unlockAudio } from '../audio/engine'
import { notify } from './useNotifications'

export function useAudioEffects() {
  const phase = useTimer(s => s.phase)
  const breath = useTimer(s => s.breath)
  const settings = useSettings()
  const prevPhase = useRef(phase)
  const prevBreathStage = useRef<string | null>(null)

  // master volume + mute reactive
  useEffect(() => {
    setMasterVolume(settings.audio.master, settings.audio.muted)
    setAmbientVolume(settings.audio.ambientVolume)
    applySettings(settings.audio)
  }, [settings.audio])

  // Switch ambient track only when phase, track id, or mute state changes.
  useEffect(() => {
    const active = phase === 'work' && settings.audio.ambient !== 'none' && !settings.audio.muted
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
}
