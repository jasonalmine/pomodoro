import { useEffect, useRef, useState } from 'react'

// Lightweight cross-tab presence detection. Every open tab broadcasts its
// current phase via BroadcastChannel; if another tab is mid-session we surface
// a banner so the user doesn't end up with two timers running and duplicate
// Pomodoros saved. We deliberately do NOT try to synchronize timer state —
// that's a much larger problem; this just informs.

const CHANNEL = 'pomodoro-tabs'
const HEARTBEAT_MS = 4000
const STALE_MS = 12000

type Msg = { tabId: string; phase: string; ts: number }

function isActivePhase(phase: string): boolean {
  return phase !== 'idle' && phase !== 'reflect'
}

export function useTabPresence(currentPhase: string): { otherTabsActive: boolean } {
  const phaseRef = useRef(currentPhase)
  useEffect(() => { phaseRef.current = currentPhase }, [currentPhase])

  const [otherTabsActive, setOtherTabsActive] = useState(false)

  useEffect(() => {
    if (typeof BroadcastChannel === 'undefined') return
    const tabId = crypto.randomUUID()
    const bc = new BroadcastChannel(CHANNEL)
    const known = new Map<string, Msg>()

    const announce = () => {
      try { bc.postMessage({ tabId, phase: phaseRef.current, ts: Date.now() }) } catch { /* channel closed */ }
    }
    const recompute = () => {
      const now = Date.now()
      let other = false
      for (const [id, t] of [...known]) {
        if (now - t.ts > STALE_MS) { known.delete(id); continue }
        if (id !== tabId && isActivePhase(t.phase)) other = true
      }
      setOtherTabsActive(other)
    }

    bc.onmessage = (e) => {
      const data = e.data as Msg
      if (!data || data.tabId === tabId) return
      known.set(data.tabId, data)
      recompute()
    }

    // Announce immediately and on a heartbeat. Also re-emit when this tab
    // becomes visible so other tabs notice fast after a switch.
    announce()
    const onVisible = () => { if (document.visibilityState === 'visible') announce() }
    document.addEventListener('visibilitychange', onVisible)
    const a = setInterval(announce, HEARTBEAT_MS)
    const r = setInterval(recompute, HEARTBEAT_MS / 2)

    return () => {
      clearInterval(a)
      clearInterval(r)
      document.removeEventListener('visibilitychange', onVisible)
      bc.close()
    }
  }, [])

  return { otherTabsActive }
}
