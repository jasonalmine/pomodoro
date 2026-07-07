import { useEffect, useState } from 'react'
// vite-plugin-pwa virtual module — typed via the `vite-plugin-pwa/client` reference in vite-env.d.ts.
import { useRegisterSW } from 'virtual:pwa-register/react'
import { RefreshCw, X } from 'lucide-react'

export function PWAUpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    offlineReady: [offlineReady, setOfflineReady],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW() { /* registered */ },
    onRegisterError(error) { console.error('[PWA] SW register error:', error) },
  })

  const [hideOffline, setHideOffline] = useState(false)
  useEffect(() => {
    if (!offlineReady) return
    const t = setTimeout(() => setHideOffline(true), 4000)
    return () => clearTimeout(t)
  }, [offlineReady])

  if (needRefresh) {
    return (
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 flex items-center gap-2 rounded-full border border-ink-200 dark:border-ink-800 bg-white dark:bg-ink-900 shadow-lg px-3 py-2 text-xs">
        <RefreshCw size={14} className="text-accent" />
        <span className="text-ink-700 dark:text-ink-200">New version available.</span>
        <button
          type="button"
          onClick={() => void updateServiceWorker(true)}
          className="text-accent font-medium hover:underline px-1"
        >
          Reload
        </button>
        <button
          type="button"
          onClick={() => setNeedRefresh(false)}
          className="text-ink-400 hover:text-ink-700 dark:hover:text-ink-200"
          aria-label="Dismiss"
        >
          <X size={14} />
        </button>
      </div>
    )
  }

  if (offlineReady && !hideOffline) {
    return (
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 flex items-center gap-2 rounded-full border border-ink-200 dark:border-ink-800 bg-white dark:bg-ink-900 shadow px-3 py-2 text-xs text-ink-600 dark:text-ink-300">
        Ready to work offline.
        <button
          type="button"
          onClick={() => setOfflineReady(false)}
          className="text-ink-400 hover:text-ink-700 dark:hover:text-ink-200"
          aria-label="Dismiss"
        >
          <X size={14} />
        </button>
      </div>
    )
  }

  return null
}
