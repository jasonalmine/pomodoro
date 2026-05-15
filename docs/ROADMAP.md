# Pomodoro roadmap

Living checklist of improvements. Check items off as they ship. Add new ones at the bottom of the relevant tier — keep the doc honest, don't let ideas pile up forever without revisiting.

Last updated: 2026-05-15 (Tier 1: day-shutdown ritual, Flowtime mode, AI weekly review)

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
- [x] AI weekly review: bring-your-own-Anthropic-key; coach-style 200-word summary from last 7 days of sessions, reflections, and day-shutdowns. Caches per ISO week locally; never synced. Haiku / Sonnet / Opus selectable in Settings.

## QA gaps to verify

- [x] Pause-during-overflow holds state correctly on resume
- [x] Overflow → +5 min → reaches new boundary → re-enters overflow (chime fires again)
- [ ] iOS Safari "Add to Home Screen" PWA flow — audio, wake lock, notifications
- [ ] Multiple-tab behavior — what happens if app is open in two tabs and timer running in one?
- [ ] Daylight savings boundary — does a session that crosses 2am→3am break the calendar?

## Open follow-ups for tasks
- [x] Cloud sync (Supabase) for tasks + templates + new reflection fields + pomodoro.taskId
- [ ] Mid-session task switcher in active screen (today only the project chip is interactive)
- [ ] Per-task drill-in / detail view
- [ ] Drag-reorder tasks (currently `order` is set to createdAt; no UI to change)

## Tier B — useful, build after Tier A

- [ ] **"Allow overtime" toggle** in Settings (default on, off = strict 25m)
- [ ] **Tags** — multi-label per session beyond project (e.g. `deep`, `admin`, `meeting`, `learning`)
- [ ] **Distraction tap counter** — single button during focus to log "got distracted"; visible in session detail
- [ ] **Session queue** — plan next 2-3 Pomodoros up front, auto-advance through them

## Tier C — polish

- [ ] Onboarding empty state for first-time users (nudge to create project, set goal)
- [ ] Visual polish for overflow ring (second ring growing outward instead of fade)
- [ ] Notes journal per day (free-form text per date, separate from per-session reflections)
- [ ] Per-project goals / quotas (e.g. "5h/week on Ventryx ops")
- [ ] Auto-archive projects with no sessions in 90 days
- [ ] Sound profiles per project (different chime / ambient defaults)
- [ ] Yearly heatmap (GitHub contributions style)
- [ ] Project comparison view (side-by-side bars over time)

## Tier D — big swings, defer until they're worth it

- [ ] **PWA install + service worker** — offline support, install on iOS / Android home screen
- [ ] **Mobile native app** wrapping the PWA (Capacitor or similar) for richer notifications and lock-screen timer
- [ ] **AI weekly summary** — "Here's where your focus went, here's a pattern" once per week via Anthropic API
- [ ] **Calendar integration** — block focus time on Google Calendar automatically while a session runs
- [ ] **Slack / status integration** — auto-set status to "in focus" during sessions

## Recurring practices

- Keep `package.json` and `package-lock.json` in sync (run `npm install` after dep changes)
- Run `npm run build` before every commit to catch TS errors
- Manual smoke test in Playwright after meaningful timer state changes
- Update this file when shipping or adding new ideas
