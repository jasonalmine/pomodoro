import type { AmbientId, AudioSettings } from '../types'

let ctx: AudioContext | null = null
let master: GainNode | null = null
let ambientNode: { source: AudioBufferSourceNode | null; gain: GainNode; buffer: AudioBuffer | null; id: AmbientId } | null = null
let breathOsc: { osc: OscillatorNode; gain: GainNode } | null = null

function ensureCtx(): AudioContext {
  if (ctx && ctx.state === 'closed') {
    ctx = null
    master = null
    ambientNode = null
    breathOsc = null
    keepAliveNode = null
  }
  if (!ctx) {
    ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)()
    master = ctx.createGain()
    master.gain.value = 0.7
    master.connect(ctx.destination)
  }
  if (ctx.state === 'suspended') {
    ctx.resume().catch(() => {/* requires user gesture */})
  }
  return ctx
}

// A suspended context has a frozen clock: tones scheduled on it play late
// (bunched together on the next user gesture) or never. WebKit suspends the
// context whenever it feels like it — especially with the window hidden,
// which is exactly when boundary cues fire in the menu-bar app. Resume
// first, then schedule against a fresh currentTime; drop the cue if the
// context won't resume within a beat (a stale chime minutes later is worse
// than a missed one — notifications cover that path).
function withRunningCtx(play: (c: AudioContext) => void) {
  const c = ensureCtx()
  if (c.state === 'running') {
    play(c)
    return
  }
  let expired = false
  const timeout = setTimeout(() => { expired = true }, 3000)
  c.resume().then(() => {
    clearTimeout(timeout)
    if (!expired && c.state === 'running') play(c)
  }).catch(() => clearTimeout(timeout))
}

export function unlockAudio() {
  ensureCtx()
}

let keepAliveNode: { src: ConstantSourceNode; gain: GainNode } | null = null

// Hold the context in the running state for the duration of a session so
// cues fired from a hidden window aren't scheduled on a suspended clock.
// Inaudible: a constant source into a zero gain.
export function setKeepAlive(on: boolean) {
  if (on) {
    const c = ensureCtx()
    if (keepAliveNode) return
    const src = c.createConstantSource()
    const gain = c.createGain()
    gain.gain.value = 0
    src.connect(gain).connect(c.destination)
    src.start()
    keepAliveNode = { src, gain }
  } else if (keepAliveNode) {
    try { keepAliveNode.src.stop() } catch { /* already stopped */ }
    keepAliveNode.gain.disconnect()
    keepAliveNode = null
  }
}

export function setMasterVolume(v: number, muted: boolean) {
  ensureCtx()
  if (master) master.gain.value = muted ? 0 : Math.max(0, Math.min(1, v))
}

// Boundary chimes fired from the timer store carry no explicit volume; they
// follow the Settings "Chime" slider via applySettings.
let chimeDefaultVolume = 0.8

export function applySettings(s: AudioSettings) {
  setMasterVolume(s.master, s.muted)
  if (ambientNode) ambientNode.gain.gain.value = s.ambientVolume
  chimeDefaultVolume = s.chimeVolume
}

export type ChimeKind = 'workEnd' | 'breakEnd' | 'start' | 'tick' | 'focusOvertime' | 'breakNudge'

export function chime(kind: ChimeKind = 'start', volume?: number) {
  const vol = volume ?? chimeDefaultVolume
  withRunningCtx(c => {
    if (!master) return
    const now = c.currentTime

    // Single soft bell, distinct pitch per meaning: E5 = focus ran past its
    // plan, D4 = a break is waiting or over. Slower attack/decay for a
    // subtler cue vs. the bigger workEnd/breakEnd arpeggios.
    if (kind === 'focusOvertime' || kind === 'breakNudge') {
      const f = kind === 'focusOvertime' ? 659.25 : 293.66 // E5 vs D4
      const o = c.createOscillator()
      const g = c.createGain()
      o.type = 'sine'
      o.frequency.value = f
      const dur = 0.85
      g.gain.setValueAtTime(0.0001, now)
      g.gain.exponentialRampToValueAtTime(vol * 0.3, now + 0.08)
      g.gain.exponentialRampToValueAtTime(0.0001, now + dur)
      o.connect(g).connect(master!)
      o.start(now)
      o.stop(now + dur + 0.05)
      return
    }

    const freqs =
      kind === 'workEnd' ? [880, 660, 523] :
      kind === 'breakEnd' ? [523, 660, 880] :
      kind === 'tick' ? [1320] :
      [660, 880]
    const dur = kind === 'tick' ? 0.05 : 0.35
    freqs.forEach((f, i) => {
      const o = c.createOscillator()
      const g = c.createGain()
      o.type = 'sine'
      o.frequency.value = f
      const start = now + i * (kind === 'tick' ? 0 : 0.08)
      g.gain.setValueAtTime(0.0001, start)
      g.gain.exponentialRampToValueAtTime(vol * 0.5, start + 0.02)
      g.gain.exponentialRampToValueAtTime(0.0001, start + dur)
      o.connect(g).connect(master!)
      o.start(start)
      o.stop(start + dur + 0.05)
    })
  })
}

export function breathCue(direction: 'in' | 'out' | 'hold', volume = 0.5) {
  if (direction === 'hold') return
  withRunningCtx(c => {
    if (!master) return
    const o = c.createOscillator()
    const g = c.createGain()
    o.type = 'sine'
    o.frequency.value = direction === 'in' ? 396 : 285
    const now = c.currentTime
    g.gain.setValueAtTime(0.0001, now)
    g.gain.exponentialRampToValueAtTime(volume * 0.35, now + 0.15)
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.9)
    o.connect(g).connect(master!)
    o.start(now)
    o.stop(now + 1)
  })
}

function makeNoiseBuffer(c: AudioContext, kind: 'rain' | 'brown'): AudioBuffer {
  const seconds = 4
  const buf = c.createBuffer(2, c.sampleRate * seconds, c.sampleRate)
  for (let ch = 0; ch < 2; ch++) {
    const data = buf.getChannelData(ch)
    if (kind === 'brown') {
      let last = 0
      for (let i = 0; i < data.length; i++) {
        const white = Math.random() * 2 - 1
        last = (last + 0.02 * white) / 1.02
        data[i] = last * 3.5
      }
    } else {
      // pink-ish "rain"
      let b0 = 0, b1 = 0, b2 = 0
      for (let i = 0; i < data.length; i++) {
        const w = Math.random() * 2 - 1
        b0 = 0.99765 * b0 + w * 0.099046
        b1 = 0.96300 * b1 + w * 0.2965164
        b2 = 0.57000 * b2 + w * 1.0526913
        data[i] = (b0 + b1 + b2 + w * 0.1848) * 0.18
      }
    }
  }
  return buf
}

// Procedural 1Hz tick-tock. Two slightly different pitches alternate so it
// reads as a real clock rather than a stuck metronome. Each click is a fast-
// decay percussion impulse: a high sine plus a thin noise transient.
function makeTickingBuffer(c: AudioContext): AudioBuffer {
  const seconds = 4 // loops cleanly: tick, tock, tick, tock
  const buf = c.createBuffer(2, c.sampleRate * seconds, c.sampleRate)
  const clickSamples = Math.floor(0.04 * c.sampleRate) // 40ms per click
  for (let ch = 0; ch < 2; ch++) {
    const data = buf.getChannelData(ch)
    data.fill(0)
    for (let beat = 0; beat < seconds; beat++) {
      const isTock = beat % 2 === 1
      const freq = isTock ? 2200 : 2800
      const startSample = Math.floor(beat * c.sampleRate)
      for (let i = 0; i < clickSamples; i++) {
        const t = i / c.sampleRate
        const env = Math.exp(-t * 90)
        const tone = Math.sin(2 * Math.PI * freq * t) * 0.55
        const noise = (Math.random() * 2 - 1) * 0.35
        data[startSample + i] = (tone + noise) * env * 0.22
      }
    }
  }
  return buf
}

function makeLofiBuffer(c: AudioContext): AudioBuffer {
  // procedural lo-fi loop: soft chord pad over filtered noise
  const seconds = 8
  const buf = c.createBuffer(2, c.sampleRate * seconds, c.sampleRate)
  const freqs = [220, 277.18, 329.63] // A minor-ish
  for (let ch = 0; ch < 2; ch++) {
    const data = buf.getChannelData(ch)
    for (let i = 0; i < data.length; i++) {
      const t = i / c.sampleRate
      let s = 0
      for (const f of freqs) s += Math.sin(2 * Math.PI * f * t) / freqs.length
      s *= 0.18 * (0.6 + 0.4 * Math.sin(2 * Math.PI * (t / seconds)))
      s += (Math.random() * 2 - 1) * 0.015
      data[i] = s
    }
  }
  return buf
}

export async function setAmbient(id: AmbientId, volume: number) {
  if (ambientNode?.id === id) {
    ambientNode.gain.gain.value = volume
    return
  }
  const c = ensureCtx()
  const fadeOutStart = c.currentTime
  const fadeOutEnd = fadeOutStart + 0.12
  if (ambientNode) {
    const old = ambientNode
    try {
      old.gain.gain.cancelScheduledValues(fadeOutStart)
      old.gain.gain.setValueAtTime(old.gain.gain.value, fadeOutStart)
      old.gain.gain.linearRampToValueAtTime(0.0001, fadeOutEnd)
      old.source?.stop(fadeOutEnd + 0.02)
    } catch {/* noop */}
    setTimeout(() => {
      try { old.source?.disconnect(); old.gain.disconnect() } catch {/* noop */}
    }, 200)
    ambientNode = null
  }
  if (id === 'none') return
  let buffer: AudioBuffer
  if (id === 'rain') buffer = makeNoiseBuffer(c, 'rain')
  else if (id === 'brown') buffer = makeNoiseBuffer(c, 'brown')
  else if (id === 'ticking') buffer = makeTickingBuffer(c)
  else buffer = makeLofiBuffer(c)
  const source = c.createBufferSource()
  source.buffer = buffer
  source.loop = true
  const gain = c.createGain()
  gain.gain.setValueAtTime(0.0001, fadeOutEnd)
  gain.gain.linearRampToValueAtTime(volume, fadeOutEnd + 0.18)
  source.connect(gain).connect(master!)
  source.start(fadeOutEnd)
  ambientNode = { source, gain, buffer, id }
}

export function setAmbientVolume(v: number) {
  if (ambientNode) ambientNode.gain.gain.value = v
}

export function startBreathTone(direction: 'in' | 'out', durationSec: number, volume: number) {
  stopBreathTone()
  const c = ensureCtx()
  if (!master) return
  const o = c.createOscillator()
  const g = c.createGain()
  o.type = 'sine'
  o.frequency.value = direction === 'in' ? 396 : 285
  const now = c.currentTime
  g.gain.setValueAtTime(0.0001, now)
  g.gain.exponentialRampToValueAtTime(volume * 0.3, now + 0.2)
  g.gain.setValueAtTime(volume * 0.3, now + durationSec - 0.25)
  g.gain.exponentialRampToValueAtTime(0.0001, now + durationSec)
  o.connect(g).connect(master!)
  o.start(now)
  o.stop(now + durationSec + 0.05)
  breathOsc = { osc: o, gain: g }
}

export function stopBreathTone() {
  if (!breathOsc) return
  try { breathOsc.osc.stop() } catch {/* noop */}
  breathOsc.osc.disconnect()
  breathOsc.gain.disconnect()
  breathOsc = null
}
