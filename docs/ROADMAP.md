# Pomodoro roadmap

Living checklist of improvements. Check items off as they ship. Add new ones at the bottom of the relevant tier — keep the doc honest, don't let ideas pile up forever without revisiting.

Last updated: 2026-05-29 (Google Calendar sync via Maton — focus blocks auto-logged as calendar events)

---

## Shipped

- [x] v1: timer, ritual, calendar, projects, settings
- [x] Deploy to Vercel + custom domain `pomodoro.jasonalmine.dev`
- [x] v2: Insights tab (today / week / all-time, daily goal ring, weekly bars, project breakdown, streak, completion rate)
- [x] Day / Week toggle in Insights with vertical timeline + stacked-by-project bars
- [x] Ring timer (replaces thin progress bar)
- [x] +5 min mid-session extend
- [x] Daily goal (default 6 Pomodoros) with `GoalRing`
- [x] Dexie schema v2 migration (safe upgrade)
- [x] Overtime mode: timer keeps counting past planned duration
- [x] CSV export of all sessions
- [x] JSON export + import (Replace All with confirm)
- [x] Per-project totals on Projects page (last 30d, all-time, session count)
- [x] Web Notification at overflow boundary if tab is hidden
- [x] Keyboard shortcuts: Space = pause/resume, S = skip, E = +5min, Esc = end
- [x] Focus-mode UI: hide nav + center timer during active sessions
- [x] Manual break controls: idle-screen mode picker (Focus / Short / Long) + queued-break CTA after work
- [x] Cloud sync via Supabase (magic-link auth, Dexie-first with last-write-wins push/pull on projects + pomodoros)
- [x] End-of-work auto-saves the Pomodoro and rolls into a running break
- [x] Page-title countdown (`24:58 · Focus`) and dynamic favicon progress ring
- [x] Theme palettes: Ember / Pine / Slate (CSS vars, runtime swap)
- [x] Idle screen redesign: Session-style intention hero (project chip + serif focus input + recent-task chips)
- [x] Active phase choreography: intention restated on the ring, ringIn/fadeIn transitions
- [x] Reflection panel with structured prompts (`What did you finish?` / `What's next?` / freeform)
- [x] Session templates: save current combo as a one-tap template; manage in Settings
- [x] Insights tabs: Today / Week / All-time / Year, with lifetime stat cards and GitHub-style year heatmap
- [x] Idle screen: +/- duration steppers for focus / short / long break (no Settings round-trip)
- [x] Mid-session project switcher (chip → dropdown)
- [x] Persist selected project across navigation + reload (localStorage-backed in timer store)
- [x] Edit task mid-session (click intention text to rename in place)
- [x] ±5 min during active phase (shorten or extend), `Shift+E` shortcut for −5
- [x] Resume last session card on idle (prefills project + task + duration)
- [x] Tasks under projects (Dexie v5): inline list per project with add / edit / check / delete, estimated Pomodoros, derived progress, archive-on-complete check
- [x] Idle task picker: tap a task to load it as the focus; finish-time estimate from remaining Pomodoros
- [x] Reflection panel surfaces task progress + "Mark task done" CTA when the session was linked to one
- [x] JSON export/import includes tasks
- [x] Day-shutdown ritual: end-of-day reflection (wins / blockers / tomorrow's first Pomodoro). Surfaces on idle next morning as "Yesterday's plan" prefill. Syncs via Supabase.
- [x] Flowtime / stopwatch mode: count-up sessions with no target. Idle picker adds a Flow tab (4-up). Wrapping up proposes a proportional break (1/5 of focus, clamped 5–30 min). Pomodoros saved with `flowMode: true`.
- [x] AI weekly review: bring-your-own-key; coach-style 200-word summary from last 7 days of sessions, reflections, and day-shutdowns. Caches per ISO week locally; never synced or exported. Provider-agnostic: Anthropic / OpenAI / Gemini (Gemini has a free tier), model field overridable.
- [x] Overtime ring shows total elapsed focus time (planned + overshoot), not just the overshoot. "Overtime · Focus" label still flags the state.
- [x] Manual entry: log a past session (project, task, date, start time, duration) from Insights → Today. Saved as a normal Pomodoro with `manual: true`; flows through analytics, export, and Supabase sync.
- [x] PWA install + service worker (vite-plugin-pwa): web manifest, iOS Safari "Add to Home Screen" meta tags, offline precache of app assets + Google Fonts, "Reload for new version" prompt when a deploy is detected.
- [x] Mid-session task switcher: chips under the editable intention let you swap the linked task to any open task in the current project, or tap-again to unlink.
- [x] Multi-tab presence: BroadcastChannel heartbeat surfaces a soft amber banner when another tab has an active session, so you don't end up running two timers and saving duplicate Pomodoros.
- [x] Distraction tap counter: one-tap "Distracted" during work/flow. Count persists on the Pomodoro (`distractions` column), shows in the reflection panel. Resets at the start of each work/flow session.
- [x] Distinct overtime boundary chimes: subtle single-bell tones at the planned-time crossing — warm high E5 for focus, cool low D4 for break. Existing 3-note workEnd/breakEnd arpeggios still fire at actual completion.
- [x] Ticking clock ambient option (procedural 1Hz tick-tock), plays during focus + flow phases only.
- [x] "Allow overtime" toggle in Settings: when off, sessions auto-advance at the planned boundary and the ±5 controls / E shortcut disable. Strict-Pomodoro mode.
- [x] Tags per session: free-form labels (`deep`, `admin`, `meeting`…) captured in the reflection panel with recent-tag chips. Stored as `tags text[]` in Supabase. AI weekly review prompt includes tag totals so it can spot tag-level patterns.
- [x] Per-day notes journal: free-form scratchpad note per calendar day, separate from per-session reflections and day-shutdowns. Auto-saves on debounce + blur. New `day_notes` table syncs via Supabase.
- [x] Onboarding empty state: soft welcome card on the idle Timer screen for first-time visitors (zero pomodoros), dismissable. Disappears naturally after the first saved session.
- [x] Edit past sessions: click any session card in Insights → Today timeline or the Calendar day view to open a full edit modal — project, linked task, task text, date/start/duration, distractions, tags, reflection notes, completed flag. Delete also fans out to Supabase (best-effort; cross-device delete-tombstones tracked as a follow-up).
- [x] Cross-device delete tombstones: `deletedAt` column on pomodoros + tasks (Dexie v9, Supabase migration). Deleting a session or task on device A propagates to device B via the normal sync pull. All read sites filter out tombstoned rows. Hard-delete is replaced by `update(id, { deletedAt, updatedAt })` so the row survives long enough to teach the other devices.
- [x] Per-project weekly goals: optional `weeklyGoalSeconds` per Project (Dexie v9, Supabase migration). Set hours/week in the project edit form; Insights → Today renders a small "Weekly goals" section with horizontal progress bars (ISO Mon-Sun). Hides itself when no projects have goals set.
- [x] Per-task drill-in / detail view: new `TaskDetailPanel` modal opens from clicking a task name in the Projects view. Shows project chip, est/done counts, total focus time, all linked sessions (newest first, click to open SessionEditPanel), and a Mark complete / Reopen action.
- [x] Drag-reorder tasks: dnd-kit-powered grip handle on each open task in the Projects view. Reordering re-sequences `order` (evenly-spaced multiples of 1000), bumps `updatedAt`, syncs via the existing tasks push path. Keyboard accessible.
- [x] Remove meditation phase from the ritual. Breathing flows straight into focus. `meditationSeconds` is dropped from the Settings type and SettingsView; existing rows can keep the column.
- [x] **Google Calendar sync (via Maton API).** Every finished focus / flow block is auto-logged as a Google Calendar event on `primary` (or a chosen calendar), titled `Project — task` with the reflection folded into the description. Bring-your-own Maton API key (stored on-device only, never synced or exported, same posture as the AI key); Maton holds the Google OAuth token so the app never touches Google credentials, and `api.maton.ai` serves open CORS so it runs entirely from the browser — no server. Settings → Google Calendar handles the one-time connect flow (create connection → authorize in a popped tab → poll until active), per-type toggles (focus / flow), Busy-vs-Free, a min-minutes filter, reflection-in-description, and a "Sync the last 7 days" backfill. `calendarEventId`/`calendarSyncedAt` live on the Pomodoro (Supabase columns added) for idempotency + cross-device dedupe; deleting a session removes its calendar event best-effort; the reflection screen and the session-edit modal show sync status. New `src/lib/calendar.ts`.

## QA gaps to verify

- [x] Pause-during-overflow holds state correctly on resume
- [x] Overflow → +5 min → reaches new boundary → re-enters overflow (chime fires again)
- [ ] iOS Safari "Add to Home Screen" PWA flow — audio, wake lock, notifications
- [x] Multiple-tab behavior — banner warns when another tab has an active session (cross-tab timer sync deliberately not attempted)
- [x] Daylight savings boundary — does a session that crosses 2am→3am break the calendar? Traced the bucketing math: `db.pomodoros.where('startedAt').between(...)` uses UTC ms ranges from date-fns `startOfDay`/`endOfDay` (which respect local time correctly across DST), `byDay` keys are local `yyyy-MM-dd`, and `actualSeconds` is `(endedAt - startedAt)/1000` so wall-clock duration is exact. Calendar week/day rails use `getHours()` and `getMinutes()` which return local-time values, so a 1:30am session on spring-forward day still positions at 1:30am even though wall-clock skips 2-3am. Only soft spot was `DailyTimeline`'s "% of day" tooltip, which divided by a hard-coded `24h` rather than the actual local-day length (23h on spring-forward, 25h on fall-back). Fixed: now computes `dayLengthMs` from local midnight to next local midnight. The user is in Manila (no local DST), so this only affects users browsing from DST zones.

## Open follow-ups for tasks
- [x] Cloud sync (Supabase) for tasks + templates + new reflection fields + pomodoro.taskId
- [x] Mid-session task switcher in active screen
- [x] Per-task drill-in / detail view
- [x] Drag-reorder tasks (currently `order` is set to createdAt; no UI to change)

## Tier B — useful, build after Tier A

- [ ] **Session queue** — plan next 2-3 Pomodoros up front, auto-advance through them

## Tier C — polish

- [ ] Visual polish for overflow ring (second ring growing outward instead of fade)
- [ ] Auto-archive projects with no sessions in 90 days
- [ ] Sound profiles per project (different chime / ambient defaults)
- [ ] Project comparison view (side-by-side bars over time)

## Tier D — big swings, defer until they're worth it

- [ ] **Mobile native app** wrapping the PWA (Capacitor or similar) for richer notifications and lock-screen timer
- [x] **Calendar integration** — finished focus blocks land on Google Calendar via the Maton gateway. See Shipped. Editing a synced session PUTs the existing event (no stale entries), deleting removes it. Now also: **live blocks** (opt-in — a tentative event at focus start, finalized on completion, so the calendar shows "in focus" live; fixed-duration focus only), **per-project Google `colorId`** (events tinted to the nearest Google colour for their project), and **offline auto-retry** (blocks finished offline / through a transient failure flush to the calendar when connectivity returns or the tab refocuses). Remaining follow-up: dedupe-by-`pomodoroId` via `privateExtendedProperty` query as a belt-and-suspenders guard, and cleanup of orphaned tentative events if the app closes mid-session.
- [ ] **Slack / status integration** — auto-set status to "in focus" during sessions (Maton supports Slack too, so the same gateway client could drive it)

## Recurring practices

- Keep `package.json` and `package-lock.json` in sync (run `npm install` after dep changes)
- Run `npm run build` before every commit to catch TS errors
- Manual smoke test in Playwright after meaningful timer state changes
- Update this file when shipping or adding new ideas
