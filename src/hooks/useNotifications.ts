import { useEffect } from 'react'

export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!('Notification' in window)) return 'denied'
  if (Notification.permission === 'default') {
    return await Notification.requestPermission()
  }
  return Notification.permission
}

export function notify(title: string, body?: string) {
  if (!('Notification' in window)) return
  if (Notification.permission !== 'granted') return
  if (!document.hidden) return
  try {
    new Notification(title, { body, icon: '/favicon.svg', silent: false })
  } catch {/* noop */}
}

export function useNotificationRequest(enabled: boolean) {
  useEffect(() => {
    if (enabled) void requestNotificationPermission()
  }, [enabled])
}
