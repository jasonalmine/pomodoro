import { useEffect, useState } from 'react'
import { useTimer, remainingSec } from '../store/timer'
import { fmtTime } from '../lib/format'

export function TimerDisplay({ className = '' }: { className?: string }) {
  const state = useTimer()
  const [, force] = useState(0)
  useEffect(() => {
    const id = setInterval(() => force(x => x + 1), 250)
    return () => clearInterval(id)
  }, [])
  return (
    <div className={`tabular font-mono text-7xl sm:text-8xl font-bold tracking-tight ${className}`}>
      {fmtTime(remainingSec(state))}
    </div>
  )
}
