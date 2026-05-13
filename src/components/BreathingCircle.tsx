import { useTimer } from '../store/timer'

const LABELS: Record<string, string> = {
  inhale: 'Inhale',
  holdIn: 'Hold',
  exhale: 'Exhale',
  holdOut: 'Hold',
}

export function BreathingCircle() {
  const breath = useTimer(s => s.breath)
  if (!breath) return null
  const scaleClass =
    breath.stage === 'inhale' ? 'scale-100' :
    breath.stage === 'exhale' ? 'scale-50' :
    breath.stage === 'holdIn' ? 'scale-100' :
    'scale-50'
  const duration = breath.stageDurationSec
  return (
    <div className="flex flex-col items-center gap-8">
      <div className="relative h-72 w-72 sm:h-80 sm:w-80 flex items-center justify-center">
        <div className="absolute inset-0 rounded-full bg-gradient-to-br from-accent-soft/20 via-accent/10 to-transparent blur-2xl" />
        <div
          className={`rounded-full bg-gradient-to-br from-accent-soft to-accent-strong shadow-2xl shadow-accent/30 transition-transform ease-in-out ${scaleClass}`}
          style={{ width: '70%', height: '70%', transitionDuration: `${duration * 1000}ms` }}
        />
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="text-center">
            <div className="text-xl font-display font-medium text-ink-900 dark:text-ink-50">
              {LABELS[breath.stage]}
            </div>
            <div className="mt-1 text-sm text-ink-500">
              Cycle {breath.cycle} of {breath.totalCycles}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
