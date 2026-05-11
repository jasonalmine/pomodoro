# Pomodoro

Local-first Pomodoro web app with a calm pre-session ritual, flexible timing, project tracking, and a calendar of your past sessions. Works on desktop and mobile browsers.

## Features (v1)

- Flexible timer: customize work / short break / long break per session, with a long-break cadence.
- Pre-session ritual: configurable breathing pattern (Box, 4-7-8, Coherent, Energize) for N cycles, followed by an optional silent meditation block. Soft breath cue tones.
- Project + task tracking: pick a project, name the work, hit start.
- Calendar view: month heatmap colored by focus minutes, per-day timeline drilldown, per-Pomodoro detail + reflection notes.
- Audio: chime on phase transitions, ambient focus sounds (rain / brown noise / lo-fi pad), all WebAudio-generated.
- Browser notifications when the tab is hidden + Screen Wake Lock during active sessions.
- Light / dark / system theme.

## Stack

- Vite + React 19 + TypeScript + Tailwind CSS v3
- Zustand for timer state, Dexie for IndexedDB persistence
- React Router v6
- WebAudio API for all sound (no audio assets, all procedural)
- PocketBase sync stub at `src/lib/sync.ts`, wire up when ready to self-host

## Develop

```bash
npm install
npm run dev
```

App runs on http://localhost:5173/.

## Build

```bash
npm run build
npm run preview
```

## Project layout

```
src/
  audio/        WebAudio engine (chimes, ambient, breath cues)
  components/   Reusable UI (Button, ProjectChip, BreathingCircle, TimerDisplay, Nav)
  db/           Dexie schema, default settings, seed
  hooks/        useSettings, useTheme, useTimerTick, useWakeLock, useAudioEffects, useNotifications
  lib/          format helpers, sync adapter stub
  store/        Zustand timer state machine
  types/        Shared TS types
  views/        Timer, Calendar, Projects, Settings
  App.tsx       Router + shell
```

## Roadmap

- Wire PocketBase sync against a Contabo VPS deployment for multi-device.
- Weekly / yearly heatmap variants and per-project stats.
- Streak / quota goals.
- PWA install + service worker.
