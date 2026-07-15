import { useEffect } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import { useTimer } from '../store/timer'
import { deriveAccentTones } from '../lib/color'

// While a work or flow block runs, tint the UI accent with that project's color
// by setting the dynamic accent layer (`--accent-*-dyn`), which index.css
// resolves on top of the chosen base palette. Cleared on break/idle so the
// user's selected palette returns. Breaks keep their own rest hue.

const DYN_VARS = ['--accent-dyn', '--accent-soft-dyn', '--accent-strong-dyn']

export function useAccentFromFocus() {
  const phase = useTimer(s => s.phase)
  const projectId = useTimer(s => s.plan?.projectId ?? null)
  const active = phase === 'work' || phase === 'flow'

  const project = useLiveQuery(
    () => (active && projectId ? db.projects.get(projectId) : undefined),
    [active, projectId],
  )
  const color = active ? project?.color : undefined

  useEffect(() => {
    const root = document.documentElement
    const clear = () => DYN_VARS.forEach(v => root.style.removeProperty(v))
    const tones = color ? deriveAccentTones(color) : null
    if (!tones) {
      clear()
      return
    }
    root.style.setProperty('--accent-dyn', tones.base)
    root.style.setProperty('--accent-soft-dyn', tones.soft)
    root.style.setProperty('--accent-strong-dyn', tones.strong)
    return clear
  }, [color])
}
