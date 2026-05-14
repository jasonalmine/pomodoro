import { Minus, Plus } from 'lucide-react'

type Props = {
  label: string
  value: number
  onChange: (v: number) => void
  min?: number
  max?: number
  step?: number
  suffix?: string
}

export function DurationStepper({
  label,
  value,
  onChange,
  min = 1,
  max = 240,
  step = 5,
  suffix = 'min',
}: Props) {
  const clamp = (n: number) => Math.max(min, Math.min(max, n))
  const dec = () => onChange(clamp(value - step))
  const inc = () => onChange(clamp(value + step))
  const canDec = value > min
  const canInc = value < max

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="text-[11px] font-medium uppercase tracking-[0.22em] text-ink-400">{label}</div>
      <div className="inline-flex items-center gap-3 rounded-full border border-ink-200 dark:border-ink-800 px-2 py-1.5">
        <button
          type="button"
          onClick={dec}
          disabled={!canDec}
          aria-label={`Decrease ${label}`}
          className="h-9 w-9 rounded-full flex items-center justify-center text-ink-600 dark:text-ink-300 hover:bg-ink-100 dark:hover:bg-ink-800 transition disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <Minus size={16} />
        </button>
        <div className="min-w-[5.5rem] text-center tabular">
          <span className="font-display text-2xl text-ink-900 dark:text-ink-50 leading-none">{value}</span>
          <span className="ml-1 text-xs text-ink-400">{suffix}</span>
        </div>
        <button
          type="button"
          onClick={inc}
          disabled={!canInc}
          aria-label={`Increase ${label}`}
          className="h-9 w-9 rounded-full flex items-center justify-center text-ink-600 dark:text-ink-300 hover:bg-ink-100 dark:hover:bg-ink-800 transition disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <Plus size={16} />
        </button>
      </div>
    </div>
  )
}
