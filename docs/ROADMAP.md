# Pomodoro roadmap

Living checklist of improvements. Check items off as they ship. Add new ones at the bottom of the relevant tier — keep the doc honest, don't let ideas pile up forever without revisiting.

Last updated: 2026-05-12

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

## In progress (Tier A bundle)

- [ ] CSV export of all sessions
- [ ] JSON export + import (full backup/restore, gitignored .env style)
- [ ] Per-project totals on Projects page (this month, all-time)
- [ ] Web Notification at overflow boundary if tab is hidden

## QA gaps to verify

- [ ] iOS Safari "Add to Home Screen" PWA flow — audio, wake lock, notifications
- [ ] Pause-during-overflow holds state correctly on resume
- [ ] Overflow → +5 min → reaches new boundary → re-enters overflow (chime fires again)
- [ ] Multiple-tab behavior — what happens if app is open in two tabs and timer running in one?
- [ ] Daylight savings boundary — does a session that crosses 2am→3am break the calendar?

## Tier B — useful, build after Tier A

- [ ] **Edit task mid-session** — click the task text to rename in place
- [ ] **"Resume last session"** button on idle screen — prefills last project + task
- [ ] **Keyboard shortcuts** — space = pause/resume, S = skip, E = +5min, Esc = end
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

- [ ] **Cloud sync** via self-hosted PocketBase on Contabo VPS — multi-device, the big one
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
