// Pure color helpers for the accent system. Used by the dynamic focus-block
// accent and the custom-palette picker to turn any hex into the three tones the
// theme expects (`--accent-base`, `--accent-soft-base`, `--accent-strong-base`),
// each as a space-separated "r g b" triple for `rgb(var(--x) / <alpha>)`.

type Rgb = { r: number; g: number; b: number }
type Hsl = { h: number; s: number; l: number }

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n))
}

/** Parse #rgb / #rrggbb into 0–255 channels. Returns null on malformed input. */
export function parseHex(hex: string): Rgb | null {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim())
  if (!m) return null
  let h = m[1]
  if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2]
  return { r: parseInt(h.slice(0, 2), 16), g: parseInt(h.slice(2, 4), 16), b: parseInt(h.slice(4, 6), 16) }
}

function rgbToHsl({ r, g, b }: Rgb): Hsl {
  r /= 255; g /= 255; b /= 255
  const max = Math.max(r, g, b), min = Math.min(r, g, b)
  const d = max - min
  let h = 0
  if (d !== 0) {
    if (max === r) h = ((g - b) / d) % 6
    else if (max === g) h = (b - r) / d + 2
    else h = (r - g) / d + 4
    h *= 60
    if (h < 0) h += 360
  }
  const l = (max + min) / 2
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1))
  return { h, s, l }
}

function hslToRgb({ h, s, l }: Hsl): Rgb {
  const c = (1 - Math.abs(2 * l - 1)) * s
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
  const m = l - c / 2
  const [r, g, b] =
    h < 60 ? [c, x, 0] :
    h < 120 ? [x, c, 0] :
    h < 180 ? [0, c, x] :
    h < 240 ? [0, x, c] :
    h < 300 ? [x, 0, c] :
    [c, 0, x]
  return { r: Math.round((r + m) * 255), g: Math.round((g + m) * 255), b: Math.round((b + m) * 255) }
}

const triple = ({ r, g, b }: Rgb): string => `${r} ${g} ${b}`

function linChan(c: number): number {
  c /= 255
  return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
}
function relLuminance({ r, g, b }: Rgb): number {
  return 0.2126 * linChan(r) + 0.7152 * linChan(g) + 0.0722 * linChan(b)
}

// The `strong` tone (accent text, ring stroke, hover) must read on both the
// light and dark grounds. Green/yellow hues are perceptually far brighter than
// blue/violet at the same HSL lightness, so instead of a fixed lightness we
// binary-search the lightness that lands the color near a target luminance
// band (~0.19) — the band the hand-tuned presets occupy, which clears 3:1 on
// light and ~4:1 on dark for every hue.
function strongForHue(h: number, s: number, targetLum = 0.19): Rgb {
  let lo = 0.18, hi = 0.6, out = hslToRgb({ h, s, l: 0.4 })
  for (let i = 0; i < 18; i++) {
    const mid = (lo + hi) / 2
    out = hslToRgb({ h, s, l: mid })
    if (relLuminance(out) > targetLum) hi = mid
    else lo = mid
  }
  return out
}

export type AccentTones = { base: string; soft: string; strong: string }

/**
 * Normalize any hex into the app's muted-pastel band and derive the three tones.
 * Pastelizing here means the custom picker and per-project focus colors stay
 * legible (dark ink text on the fill) and harmonize with the curated palettes,
 * regardless of how saturated or dark the input is.
 */
export function deriveAccentTones(hex: string): AccentTones | null {
  const rgb = parseHex(hex)
  if (!rgb) return null
  const { h, s } = rgbToHsl(rgb)
  const baseS = clamp(s, 0.42, 0.62)
  const base = hslToRgb({ h, s: baseS, l: 0.72 })
  const soft = hslToRgb({ h, s: clamp(baseS * 0.7, 0.25, 0.5), l: 0.9 })
  const strong = strongForHue(h, clamp(baseS + 0.05, 0.45, 0.7))
  return { base: triple(base), soft: triple(soft), strong: triple(strong) }
}
