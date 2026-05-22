import { useEffect } from 'react'
import { useTimer } from '../store/timer'

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  const tag = target.tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true
  if (target.isContentEditable) return true
  return false
}

export function useKeyboardShortcuts() {
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey || e.altKey) return
      if (isTypingTarget(e.target)) return
      const shift = e.shiftKey

      const state = useTimer.getState()
      const { phase, isRunning, pause, resume, skip, abort, extend, adjustPhase } = state

      // Only act during an active session (not idle, not reflect, not breathing prep)
      const active = phase === 'work' || phase === 'shortBreak' || phase === 'longBreak' || phase === 'meditation'
      if (!active) return

      const key = e.key
      if (key === ' ' || key === 'Spacebar') {
        e.preventDefault()
        if (isRunning) pause(); else resume()
      } else if (key === 's' || key === 'S') {
        e.preventDefault()
        skip()
      } else if (key === 'e' || key === 'E') {
        const inMeteredPhase = phase === 'work' || phase === 'shortBreak' || phase === 'longBreak'
        const allowOvertime = state.plan?.allowOvertime ?? true
        if (!inMeteredPhase || !allowOvertime) return
        e.preventDefault()
        if (shift) adjustPhase(-5 * 60)
        else extend(5 * 60)
      } else if (key === 'Escape') {
        e.preventDefault()
        abort()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])
}
