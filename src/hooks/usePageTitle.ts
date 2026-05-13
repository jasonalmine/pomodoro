import { useEffect } from 'react'
import { useTimer, remainingSec, overflowSec } from '../store/timer'
import { fmtTime } from '../lib/format'

const DEFAULT = 'Pomodoro'

function phaseLabel(phase: string): string {
  switch (phase) {
    case 'work': return 'Focus'
    case 'shortBreak': return 'Short break'
    case 'longBreak': return 'Long break'
    case 'breathing': return 'Breathe'
    case 'meditation': return 'Sit'
    case 'reflect': return 'Reflect'
    default: return 'Pomodoro'
  }
}

export function usePageTitle() {
  const phase = useTimer(s => s.phase)
  const isRunning = useTimer(s => s.isRunning)
  const isOverflow = useTimer(s => s.isOverflow)

  useEffect(() => {
    if (phase === 'idle' || phase === 'reflect') {
      document.title = DEFAULT
      return
    }
    let cancelled = false
    function tick() {
      if (cancelled) return
      const s = useTimer.getState()
      const remaining = remainingSec(s)
      const over = overflowSec(s)
      const label = phaseLabel(s.phase)
      const time = over > 0 ? `+${fmtTime(over)}` : fmtTime(remaining)
      document.title = `${time} · ${label}`
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => {
      cancelled = true
      clearInterval(id)
      document.title = DEFAULT
    }
  }, [phase, isRunning, isOverflow])
}
