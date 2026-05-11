import { useEffect, useState } from 'react'
import { useTimer, remainingSec } from '../store/timer'
import { fmtTime } from '../lib/format'
import type { Phase } from '../types'

const PHASE_LABEL: Record<Phase, string> = {
  idle: 'Ready',
  breathing: 'Settle In',
  meditation: 'Meditation',
  work: 'Focus',
  shortBreak: 'Short Break',
  longBreak: 'Long Break',
  reflect: 'Reflect',
}

const PHASE_COLOR: Record<Phase, string> = {
  idle: '#646473',
  breathing: '#818cf8',
  meditation: '#818cf8',
  work: '#ff6a37',
  shortBreak: '#10b981',
  longBreak: '#10b981',
  reflect: '#646473',
}

const R = 90
const STROKE = 8
const C = 2 * Math.PI * R

export function RingTimer() {
  const phase = useTimer(s => s.phase)
  const phaseDurationSec = useTimer(s => s.phaseDurationSec)
  const [, force] = useState(0)
  useEffect(() => {
    const id = setInterval(() => force(x => x + 1), 250)
    return () => clearInterval(id)
  }, [])

  const s = useTimer.getState()
  const remaining = remainingSec(s)
  const progress = phaseDurationSec > 0 ? Math.min(1, Math.max(0, 1 - remaining / phaseDurationSec)) : 0
  const offset = C * (1 - progress)
  const color = PHASE_COLOR[phase]

  return (
    <div className="relative flex items-center justify-center select-none">
      <svg
        viewBox="0 0 200 200"
        className="w-72 h-72 sm:w-80 sm:h-80 -rotate-90"
        aria-hidden="true"
      >
        <circle
          cx="100" cy="100" r={R}
          fill="none"
          stroke="currentColor"
          strokeWidth={STROKE}
          className="text-ink-200 dark:text-ink-800"
        />
        <circle
          cx="100" cy="100" r={R}
          fill="none"
          stroke={color}
          strokeWidth={STROKE}
          strokeLinecap="round"
          strokeDasharray={C}
          strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 250ms linear' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
        <div className="font-mono text-5xl sm:text-6xl font-bold tabular tracking-tight text-ink-900 dark:text-ink-50">
          {fmtTime(remaining)}
        </div>
        <div className="mt-2 text-[11px] font-medium uppercase tracking-[0.18em] text-ink-400">
          {PHASE_LABEL[phase]}
        </div>
      </div>
    </div>
  )
}
