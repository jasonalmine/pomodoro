type Props = {
  current: number
  goal: number
  size?: number
  showLabel?: boolean
  className?: string
}

export function GoalRing({ current, goal, size = 44, showLabel = false, className = '' }: Props) {
  const r = (size - 6) / 2
  const c = 2 * Math.PI * r
  const safeGoal = Math.max(1, goal)
  const progress = Math.min(1, current / safeGoal)
  const offset = c * (1 - progress)
  const hit = current >= safeGoal
  const color = hit ? '#10b981' : '#ff6a37'

  return (
    <div className={`inline-flex items-center gap-2 ${className}`}>
      <div className="relative" style={{ width: size, height: size }}>
        <svg
          viewBox={`0 0 ${size} ${size}`}
          className="-rotate-90"
          width={size}
          height={size}
        >
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            className="text-ink-200 dark:text-ink-800"
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={color}
            strokeWidth="3"
            strokeLinecap="round"
            strokeDasharray={c}
            strokeDashoffset={offset}
            style={{ transition: 'stroke-dashoffset 350ms ease-out' }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center text-[10px] font-semibold tabular text-ink-700 dark:text-ink-200">
          {current}/{safeGoal}
        </div>
      </div>
      {showLabel && (
        <span className="text-xs text-ink-500">
          {hit ? 'Goal hit' : `${safeGoal - current} to go`}
        </span>
      )}
    </div>
  )
}
