import { useEffect } from 'react'
import { useTimer } from '../store/timer'

export function useTimerTick() {
  const isRunning = useTimer(s => s.isRunning)
  const tick = useTimer(s => s.tick)
  useEffect(() => {
    if (!isRunning) return
    const id = setInterval(() => tick(), 250)
    return () => clearInterval(id)
  }, [isRunning, tick])
}
