// Boot breadcrumbs in localStorage. The desktop WKWebView has no reachable
// console, but its localStorage is a sqlite file on disk, so this is the one
// place a crash at startup can be read back from.
export function crumb(key: string, value: string) {
  try {
    localStorage.setItem(`pomodoro:${key}`, `${new Date().toISOString()} ${value}`)
  } catch {
    /* storage unavailable */
  }
}

export function installErrorCrumbs() {
  window.addEventListener('error', e => {
    const err = e.error as { name?: string; stack?: string } | undefined
    crumb('lastError', `${e.message} @ ${e.filename}:${e.lineno} ${err?.name ?? ''} ${err?.stack ?? ''}`)
  })
  window.addEventListener('unhandledrejection', e => {
    const r = e.reason as { stack?: string } | undefined
    crumb('lastRejection', String(r?.stack ?? e.reason))
  })
}
