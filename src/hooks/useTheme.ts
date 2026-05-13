import { useEffect } from 'react'
import type { Palette, ThemeMode } from '../types'

export function useTheme(mode: ThemeMode, palette: Palette = 'ember') {
  useEffect(() => {
    const root = document.documentElement
    const apply = () => {
      const sysDark = window.matchMedia('(prefers-color-scheme: dark)').matches
      const dark = mode === 'dark' || (mode === 'system' && sysDark)
      root.classList.toggle('dark', dark)
    }
    apply()
    if (mode === 'system') {
      const mq = window.matchMedia('(prefers-color-scheme: dark)')
      mq.addEventListener('change', apply)
      return () => mq.removeEventListener('change', apply)
    }
  }, [mode])

  useEffect(() => {
    const root = document.documentElement
    root.classList.remove('palette-ember', 'palette-pine', 'palette-slate')
    root.classList.add(`palette-${palette}`)
  }, [palette])
}
