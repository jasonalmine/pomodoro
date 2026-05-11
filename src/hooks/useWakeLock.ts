import { useEffect, useRef } from 'react'

type WakeLockSentinel = { release: () => Promise<void>; released: boolean }
type WakeLockAPI = { request: (type: 'screen') => Promise<WakeLockSentinel> }

export function useWakeLock(active: boolean, enabled: boolean) {
  const sentinelRef = useRef<WakeLockSentinel | null>(null)

  useEffect(() => {
    if (!enabled || !active) {
      sentinelRef.current?.release().catch(() => {/* noop */})
      sentinelRef.current = null
      return
    }
    let cancelled = false
    const wl = (navigator as unknown as { wakeLock?: WakeLockAPI }).wakeLock
    if (!wl) return
    const acquire = async () => {
      try {
        const s = await wl.request('screen')
        if (cancelled) { s.release(); return }
        sentinelRef.current = s
      } catch {/* user gesture may be required */}
    }
    void acquire()
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return
      const cur = sentinelRef.current
      if (cur && !cur.released) return // already held
      sentinelRef.current = null
      void acquire()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', onVisible)
      sentinelRef.current?.release().catch(() => {/* noop */})
      sentinelRef.current = null
    }
  }, [active, enabled])
}
