import { useEffect } from 'react'
import { useTimer, remainingSec, overflowSec } from '../store/timer'
import { fmtTime } from '../lib/format'

// Bridge between the ephemeral Zustand timer store (this webview) and the native
// macOS menu-bar tray title. Only active inside the Tauri shell; a no-op in the
// browser / PWA build so nothing changes for the plain web app.

function isTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window
}

// Title string shown next to the tray icon. Empty string clears it (icon only).
function trayTitle(): string {
  const s = useTimer.getState()
  if (s.phase === 'idle' || s.phase === 'reflect') return ''
  if (s.isOverflow) return `+${fmtTime(overflowSec(s))}`
  return fmtTime(remainingSec(s))
}

export function useTrayTimer() {
  useEffect(() => {
    if (!isTauri()) return

    let cancelled = false
    let lastTitle: string | null = null
    let unlisten: (() => void) | undefined

    void (async () => {
      const [{ invoke }, { listen }] = await Promise.all([
        import('@tauri-apps/api/core'),
        import('@tauri-apps/api/event'),
      ])
      if (cancelled) return

      // Push the countdown up to the tray, deduped so we only cross the IPC
      // boundary when the visible string actually changes (~1/sec, not every tick).
      const push = () => {
        const title = trayTitle()
        if (title === lastTitle) return
        lastTitle = title
        void invoke('set_tray_title', { title })
      }
      push()
      const interval = setInterval(push, 250)

      // Native tray menu items drive the same store actions as the in-app buttons.
      const stop = await listen<string>('tray://action', (event) => {
        const t = useTimer.getState()
        switch (event.payload) {
          case 'startPause':
            if (t.isRunning) t.pause()
            else t.resume()
            break
          case 'skip':
            t.skip()
            break
        }
      })

      if (cancelled) {
        clearInterval(interval)
        stop()
        return
      }
      unlisten = () => {
        clearInterval(interval)
        stop()
      }
    })()

    return () => {
      cancelled = true
      unlisten?.()
    }
  }, [])
}
