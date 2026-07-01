import { useEffect, useRef } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useTimer, remainingSec } from '../store/timer'
import { listActiveProjects } from '../db'

const SIZE = 64
const STROKE = 8

function rgbFromHex(hex: string): { r: number; g: number; b: number } {
  const h = hex.replace('#', '')
  const v = h.length === 3 ? h.split('').map(c => c + c).join('') : h
  return { r: parseInt(v.slice(0, 2), 16), g: parseInt(v.slice(2, 4), 16), b: parseInt(v.slice(4, 6), 16) }
}

function ensureCanvas(): HTMLCanvasElement {
  let c = document.getElementById('favicon-canvas') as HTMLCanvasElement | null
  if (!c) {
    c = document.createElement('canvas')
    c.id = 'favicon-canvas'
    c.width = SIZE
    c.height = SIZE
    c.style.display = 'none'
    document.body.appendChild(c)
  }
  return c
}

function ensureLink(): HTMLLinkElement {
  let link = document.querySelector("link[rel='icon']") as HTMLLinkElement | null
  if (!link) {
    link = document.createElement('link')
    link.rel = 'icon'
    document.head.appendChild(link)
  }
  return link
}

let originalHref: string | null = null

function paint(progress: number, color: string) {
  const canvas = ensureCanvas()
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  ctx.clearRect(0, 0, SIZE, SIZE)

  const cx = SIZE / 2
  const cy = SIZE / 2
  const r = (SIZE - STROKE) / 2

  // background ring
  ctx.beginPath()
  ctx.arc(cx, cy, r, 0, Math.PI * 2)
  ctx.lineWidth = STROKE
  ctx.strokeStyle = 'rgba(0,0,0,0.12)'
  ctx.stroke()

  // progress ring
  const { r: red, g, b } = rgbFromHex(color)
  ctx.beginPath()
  ctx.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.min(1, Math.max(0, progress)))
  ctx.lineWidth = STROKE
  ctx.strokeStyle = `rgb(${red}, ${g}, ${b})`
  ctx.lineCap = 'round'
  ctx.stroke()

  const link = ensureLink()
  if (originalHref === null) originalHref = link.href
  link.href = canvas.toDataURL('image/png')
}

function reset() {
  const link = ensureLink()
  if (originalHref !== null) link.href = originalHref
}

export function useFaviconTimer() {
  const phase = useTimer(s => s.phase)
  const isRunning = useTimer(s => s.isRunning)
  const projects = useLiveQuery(() => listActiveProjects(), [], [])
  const ranOnceRef = useRef(false)

  useEffect(() => {
    if (phase === 'idle' || phase === 'reflect') {
      if (ranOnceRef.current) reset()
      return
    }
    ranOnceRef.current = true
    const planProjectId = useTimer.getState().plan?.projectId
    const project = (projects ?? []).find(p => p.id === planProjectId)
    const color = (phase === 'work' || phase === 'flow') ? (project?.color ?? '#ff6a37') : '#646473'

    function render() {
      const s = useTimer.getState()
      if (s.phase === 'idle' || s.phase === 'reflect') return
      const remaining = remainingSec(s)
      const total = s.phaseDurationSec || 1
      const progress = 1 - remaining / total
      paint(progress, color)
    }
    render()
    const id = setInterval(render, 5000)
    return () => clearInterval(id)
  }, [phase, isRunning, projects])
}
