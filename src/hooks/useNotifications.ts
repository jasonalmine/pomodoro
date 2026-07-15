import { useEffect } from 'react'
import { ensureNotificationPermission, sendNotification } from '../lib/notify'

// Thin, platform-agnostic wrapper. The real work (native Tauri plugin on the
// desktop, Web Notification API in the browser) lives in ../lib/notify.

export async function requestNotificationPermission(): Promise<boolean> {
  return ensureNotificationPermission()
}

/** Phase-transition notification: fires only when the tab is hidden (web app). */
export function notify(title: string, body?: string) {
  void sendNotification(title, body)
}

export function useNotificationRequest(enabled: boolean) {
  useEffect(() => {
    if (enabled) void ensureNotificationPermission()
  }, [enabled])
}
