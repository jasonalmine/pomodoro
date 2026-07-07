# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

A local-first Pomodoro web app: a calm pre-session breathing ritual, flexible timing, project/task tracking, a calendar of past sessions, and optional cloud sync + Google Calendar export. Static SPA, no backend of its own.

## Commands

```bash
npm run dev        # Vite dev server on http://localhost:5173/
npm run build      # tsc -b (typecheck) then vite build → dist/
npm run preview    # serve the production build locally
npm run lint       # eslint . (flat config in eslint.config.js)

# Supabase schema (requires `supabase` CLI linked to the project)
npm run db:new <name>   # scaffold a new timestamped migration
npm run db:push         # apply pending migrations to the linked DB
npm run db:status       # list local vs remote migration state
```

There is no test runner. "Verify" means `npm run build` (it typechecks) plus `npm run lint`, then exercising the change in `npm run dev`.

## Architecture

**Local-first, cloud-optional.** IndexedDB (via Dexie) is the working store and the source of truth offline. Supabase is an optional sync layer on top. The app is fully functional with no Supabase configured.

### State lives in two places, by lifetime
- **Ephemeral timer state** → Zustand store in `src/store/timer.ts`. The active phase, elapsed seconds, breathing sub-state, etc. This is NOT persisted; a reload ends the in-progress session. The store is the single owner of the phase machine.
- **Durable data** → Dexie tables in `src/db/index.ts`, read in components via `useLiveQuery` (dexie-react-hooks) so the UI reacts to writes automatically. `src/hooks/useSettings.ts` is the canonical settings accessor; mutate settings only through `updateSettings` / `updateCalendarSync` there.

### The timer phase machine (`src/store/timer.ts`)
Phases: `idle → breathing → work → reflect → shortBreak|longBreak → …`, plus a count-up `flow` mode. This file holds most of the app's behavioral complexity. Things to know before editing it:
- A finished work/flow block is written with `db.pomodoros.put(...)` and then `calendarSync(id)` is fired and forgotten (never await it into the timer flow).
- **Overflow vs strict mode.** With `allowOvertime: true` (default), a phase does not auto-advance at its boundary — it enters `isOverflow` and counts up until the user acts. With `allowOvertime: false` (Strict-Pomodoro), it auto-advances at the boundary. Boundary chimes are deduped so completion doesn't double-chime; preserve that when touching `tick`/`completeWork`/`advancePhase`.
- "Skip" on a flow session means "wrap up now"; "abort" during work/flow saves the partial block and rolls into a proportional break. These are separate code paths (`completeFlow`, `endWorkIntoBreak`, `endFlowIntoBreak`) — keep them in sync if you change the Pomodoro shape.

### Sync model (`src/lib/sync.ts`, `src/hooks/useSync.ts`)
- **Last-write-wins on `updatedAt`** (epoch ms). Every mutation to a synced row MUST bump `updatedAt`, or the change never propagates. This is the single most common sync bug.
- **Soft deletes only.** Never hard-delete a synced row. Set `deletedAt` (tombstone) and bump `updatedAt` (`deletePomodoroEverywhere` / `deleteTaskEverywhere`). Every read surface must treat `deletedAt != null` as gone.
- **Synced tables:** projects, pomodoros, tasks, templates, day_shutdowns, day_notes. **Settings are deliberately NOT synced** (they hold device-local secrets).
- `useSync` pushes on local Dexie writes (debounced 1.5s), and pulls on auth change, a 60s interval, `online`, and tab `visibilitychange`. Push happens before pull so a fresh device doesn't look like it wiped data.
- camelCase (TS) ↔ snake_case (Postgres) conversion is manual in `*ToRow` / `rowTo*` mappers. Supabase/PostgREST errors are plain objects, not `Error`s — always funnel them through `toError()` so they don't render as `[object Object]`.

### On-device secrets
`matonApiKey` (Google Calendar via Maton) and `aiApiKey` (weekly AI review) live only in this browser's IndexedDB. They are never synced and are stripped from JSON exports (`src/lib/exportImport.ts`). Keep that posture for any new credential.

### Google Calendar export (`src/lib/calendar.ts`)
Runs entirely client-side through the Maton gateway (`api.maton.ai/google-calendar/...`, open CORS, bring-your-own Maton key). The app never sees Google credentials. Completed focus/flow blocks store their `calendarEventId` for idempotency and deletion.

## Changing the data model (the three-file rule)

Adding or changing a field on a synced entity touches three places, and missing one silently breaks sync:
1. **`src/types/index.ts`** — the TS type.
2. **`src/lib/sync.ts`** — the row type plus both `*ToRow` and `rowTo*` mappers.
3. **`supabase/migrations/`** — a new migration (`npm run db:new`), then `npm run db:push`.

If the field needs to be queried/indexed in IndexedDB, also bump the Dexie schema: add a new `this.version(N)` block in `src/db/index.ts` with an `.upgrade()` for any backfill. Existing versions are immutable — never edit a past `version()` block. `docs/supabase-schema.sql` is the full reference snapshot.

## Conventions

- Vite + React 19 + TypeScript + Tailwind v3. Routing via React Router v6 (`src/App.tsx`). Views in `src/views/`, reusable pieces in `src/components/`, side-effecting logic in `src/hooks/`, pure logic in `src/lib/`.
- All audio is procedural WebAudio (`src/audio/engine.ts`) — there are no sound assets. Drag-reorder uses `@dnd-kit`. Dates use `date-fns`.
- Supabase is gated on `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` (`.env`); absent → `supabaseEnabled` is false and all sync paths no-op. See `docs/SUPABASE_SETUP.md`.
- Deploy is a static SPA (Vercel via `vercel.json`, or `./deploy.sh` to a Caddy VPS). HTTPS is required outside localhost for `crypto.randomUUID`, Notifications, and Wake Lock.
