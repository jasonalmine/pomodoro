import { useEffect } from 'react'
import { deriveAccentTones } from '../lib/color'
import type { Palette, ThemeMode } from '../types'

const PALETTE_CLASSES = [
  'palette-blush', 'palette-coral', 'palette-amber', 'palette-citrine',
  'palette-sage', 'palette-teal', 'palette-sky', 'palette-denim',
  'palette-periwinkle', 'palette-lilac', 'palette-mauve', 'palette-slate',
  'palette-clay', 'palette-dune', 'palette-olive', 'palette-cocoa',
]

// Base accent CSS vars carried inline on <html> for the 'custom' palette. Named
// so we can cleanly remove them when switching back to a preset.
const CUSTOM_VARS = ['--accent-base', '--accent-soft-base', '--accent-strong-base']

export function useTheme(mode: ThemeMode, palette: Palette = 'coral', customAccent?: string) {
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
    root.classList.remove(...PALETTE_CLASSES)

    if (palette === 'custom') {
      const tones = customAccent ? deriveAccentTones(customAccent) : null
      if (tones) {
        root.style.setProperty('--accent-base', tones.base)
        root.style.setProperty('--accent-soft-base', tones.soft)
        root.style.setProperty('--accent-strong-base', tones.strong)
        return
      }
      // Malformed / missing custom hex → fall through to the default palette.
    }

    // Preset: drop any custom inline vars so the .palette-* class takes over.
    CUSTOM_VARS.forEach(v => root.style.removeProperty(v))
    root.classList.add(`palette-${palette === 'custom' ? 'coral' : palette}`)
  }, [palette, customAccent])
}
