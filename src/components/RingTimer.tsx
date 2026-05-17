import { useEffect, useState } from 'react'
import { useTimer, remainingSec, overflowSec } from '../store/timer'
import { fmtTime } from '../lib/format'
import type { Phase } from '../types'

const PHASE_LABEL: Record<Phase, string> = {
  idle: 'Ready',
  breathing: 'Settle In',
  meditation: 'Meditation',
  work: 'Focus',
  flow: 'Flowing',
  shortBreak: 'Short Break',
  longBreak: 'Long Break',
  reflect: 'Reflect',
}

// Resolves to a CSS rgb() expression that respects the active palette.
function accentColor(opacity = 1): string {
  return `rgb(var(--accent) / ${opacity})`
}

// Distinct hue for breaks so work and rest read differently.
const BREAK_COLOR = '#10b981'

function phaseRingColor(phase: Phase): string {
  switch (phase) {
    case 'shortBreak':
    case 'longBreak':
      return BREAK_COLOR
    case 'work':
    case 'flow':
    case 'breathing':
    case 'meditation':
      return accentColor()
    default:
      return 'rgb(100 100 115)'
  }
}

const R = 90
const STROKE = 8
const C = 2 * Math.PI * R

export function RingTimer() {
  const phase = useTimer(s => s.phase)
  const phaseDurationSec = useTimer(s => s.phaseDurationSec)
  const isOverflow = useTimer(s => s.isOverflow)
  const [, force] = useState(0)
  useEffect(() => {
    const id = setInterval(() => force(x => x + 1), 250)
    return () => clearInterval(id)
  }, [])

  const s = useTimer.getState()
  const remaining = remainingSec(s)
  const overflow = overflowSec(s)
  const isFlow = phase === 'flow'
  const elapsed = isFlow
    ? s.phaseElapsedSec + (s.isRunning && s.phaseStartedAt != null ? Date.now() / 1000 - s.phaseStartedAt : 0)
    : 0
  // Flow gets a slow-sweeping wedge so the ring still has motion without implying a deadline.
  const flowSweep = isFlow ? ((elapsed % 600) / 600) : 0
  const progress = isFlow
    ? flowSweep
    : (phaseDurationSec > 0 ? Math.min(1, Math.max(0, 1 - remaining / phaseDurationSec)) : 0)
  const offset = C * (1 - progress)
  const color = phaseRingColor(phase)

  // In overtime, show the TOTAL elapsed focus time (planned + overshoot),
  // not just the overshoot. The label still flags the overtime state.
  const displayTime = isFlow
    ? fmtTime(Math.round(elapsed))
    : (isOverflow ? fmtTime(phaseDurationSec + overflow) : fmtTime(remaining))
  const label = isOverflow ? `Overtime · ${PHASE_LABEL[phase]}` : PHASE_LABEL[phase]

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
          style={{
            transition: 'stroke-dashoffset 250ms linear',
            opacity: isOverflow ? 0.45 : 1,
          }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
        <div
          className={`font-mono text-5xl sm:text-6xl font-bold tabular tracking-tight ${isOverflow ? 'text-accent' : 'text-ink-900 dark:text-ink-50'}`}
          style={isOverflow ? { animation: 'pulse 2s ease-in-out infinite' } : undefined}
        >
          {displayTime}
        </div>
        <div className={`mt-2 text-[11px] font-medium uppercase tracking-[0.18em] ${isOverflow ? 'text-accent' : 'text-ink-400'}`}>
          {label}
        </div>
      </div>
    </div>
  )
}
