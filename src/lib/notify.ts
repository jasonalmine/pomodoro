// Platform-aware desktop notifications.
//
// In the Tauri menu-bar app the Web Notification API is unavailable (WKWebView
// doesn't implement it), so we route through tauri-plugin-notification. In the
// browser / PWA we fall back to the Web Notification API. Callers use the same
// two functions regardless of surface.

function isTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window
}

// Lazy-load the Tauri plugin so the browser bundle never evaluates it.
type TauriNotif = typeof import('@tauri-apps/plugin-notification')
let tauriNotifPromise: Promise<TauriNotif> | null = null
function loadTauriNotif(): Promise<TauriNotif> {
  if (!tauriNotifPromise) tauriNotifPromise = import('@tauri-apps/plugin-notification')
  return tauriNotifPromise
}

/** Ensure we can post notifications, requesting permission once if needed. */
export async function ensureNotificationPermission(): Promise<boolean> {
  if (isTauri()) {
    try {
      const n = await loadTauriNotif()
      if (await n.isPermissionGranted()) return true
      return (await n.requestPermission()) === 'granted'
    } catch {
      return false
    }
  }
  if (!('Notification' in window)) return false
  if (Notification.permission === 'granted') return true
  if (Notification.permission === 'default') return (await Notification.requestPermission()) === 'granted'
  return false
}

/**
 * Post a notification.
 *
 * `onlyWhenHidden` (default true) preserves the web app's behavior of only
 * notifying when the tab is backgrounded — pointless to interrupt someone
 * looking right at the app. The desktop menu-bar app ignores it: its popover is
 * hidden by design, so a native notification is exactly what's wanted.
 */
export async function sendNotification(
  title: string,
  body?: string,
  opts?: { onlyWhenHidden?: boolean },
): Promise<void> {
  if (isTauri()) {
    try {
      const n = await loadTauriNotif()
      if (!(await n.isPermissionGranted())) return
      await n.sendNotification({ title, body })
    } catch {
      /* noop */
    }
    return
  }
  if (!('Notification' in window)) return
  if (Notification.permission !== 'granted') return
  if ((opts?.onlyWhenHidden ?? true) && !document.hidden) return
  try {
    new Notification(title, { body, icon: '/favicon.svg', silent: false })
  } catch {
    /* noop */
  }
}
