# Feature research: what to build next

Comparative scan of leading Pomodoro / focus apps, mapped against what's already shipped. Goal: pick the next 12-18 features with the best ROI.

Last updated: 2026-05-12

## Apps surveyed

Forest, Focus Bear, Bear Focus Timer, Focus Keeper, Be Focused, Pomofocus.io, Focus To-Do, TickTick, Session (macOS), Flow (macOS/iOS), Kofe Flow, Marinara (Chrome), Toggl Track, Centered, Sunsama, Habitica, Focumon, Social Pomodoro, Llama Life, Habi, Pomodo.io, Pomodoro Tracker, plus the Flowtime-school apps (Taskade, Flowmo, Timely).

---

## Feature inventory by theme

| Theme | Common features (with example app) | Status |
|---|---|---|
| **Focus integrity** | Website / app blocker (Session, Flow, Centered, Freedom), face-down phone lock (Bear Focus Timer), commitment mode / "tree dies if you leave" (Forest, Flow), Do-Not-Disturb sync, grayscale nudge | Mostly missing on web |
| **Task management** | Tasks per session with estimated Pomodoros (Pomofocus, Focus To-Do), templates (Pomofocus), subtasks (Focus To-Do), priorities, recurring tasks, estimated finish time (Pomofocus, Pomodo.io) | Partial — projects exist, no tasks |
| **Analytics** | Daily/weekly trend charts, Gantt of focus time (Focus To-Do), week-over-week deltas (TickTick), heatmap, project breakdown, "most focused hour" | Shipped (rich) |
| **Motivation / gamification** | Streaks (everyone), trees / forests (Forest), pets / RPG (Habitica, Focus Friend), praise cards (Bear Focus), badges, daily quote (Flow), level-ups, virtual currency | Partial — streak only |
| **Social / accountability** | Co-focus rooms (Focumon, Academync, Social Pomodoro), shared trees (Forest), Slack status sync (Session, Sunsama), party play | Missing |
| **Audio / sensory** | Ambient sounds (TickTick, Bear), binaural / flow music (Brain.fm, Centered), ticking sound, custom chime, end-of-session bell, metronome (Flow) | Shipped (ambient + ritual) |
| **Personalization** | Themes / colour, custom durations, per-project chime (rare), auto-start next session (Pomofocus, Focus Keeper), strict 25/flexible toggle | Partial |
| **Integrations** | Calendar sync (Flow, Session, Sunsama), Slack status (Session, Sunsama), Todoist/Notion timers (Toggl), Apple Health, Shortcuts/AppleScript, Live Activities, Widgets | Missing |
| **Accessibility** | Disappearing pie / ring visualizer for ADHD, large type mode, screen-reader announcements, reduced-motion, voice coach (Centered) | Ring shipped; rest missing |
| **Flowtime / hybrid** | Stopwatch mode that lets focus run until it fades (Toggl, TickTick, Flowmo), proportional breaks (5/8/10) | Missing |
| **Reflection** | Per-session note (rare — Sunsama), end-of-day shutdown ritual (Sunsama), daily intention | Shipped (unique edge) |

---

## What I already have vs. what's commodity

**Shipped & competitive:** ring timer, daily goal, weekly/calendar/insights, streak, CSV+JSON export, ambient audio, web notifications, wake-lock, +5min, overtime, manual breaks, focus mode, cloud sync, keyboard shortcuts.

**My differentiators (most apps don't have these):** pre-session breathing ritual, per-session reflection note, project structure with per-project totals, JSON import/export with replace-all.

**Commodity table-stakes I'm missing:**
- Tasks with estimated Pomodoros + estimated finish time
- Auto-start next session (work → break → work)
- Strict-mode toggle (no overtime, no pause abuse)
- Long-break interval setting (every 4 Pomodoros)
- Per-app theme / colour
- Stopwatch / Flowtime mode

**Differentiators worth borrowing:**
- Distraction blocker (Forest commitment mode, Session blocker)
- Calendar sync (Flow, Session)
- Body-doubling co-focus room (Focumon, Social Pomodoro)
- Disappearing ring / pie for ADHD time-perception
- Slack/status integration (already in my Tier D — leave)

---

## Shortlist (prioritized)

| # | Feature | One-liner | Impact | Effort | Leverages strengths? | Notes / risk |
|---|---|---|---|---|---|---|
| 1 | **Tasks + estimated Pomodoros** | Add lightweight tasks under a project with `est` count; show "estimated finish time" on idle screen | High — biggest commodity gap; unlocks deeper analytics | M | Yes (slots under projects) | Dexie schema v3 migration. Don't build a full todo app — keep it 1 level deep |
| 2 | **Auto-start next session** | Setting: auto-roll work→break→work without tapping. Already partial: end-of-work transitions to break | High — removes the #1 friction in real Pomodoro flow | S | Yes | Pair with audible cue. Off by default for ritual users |
| 3 | **Flowtime / stopwatch mode** | New session type: count up, no target, proportional break suggested at stop | High — flow-state crowd is underserved by every Pomodoro app | M | Yes (your reflection note + overtime logic already accept open-ended durations) | Real differentiator vs Pomofocus/Focus Keeper |
| 4 | **Site blocker (soft, browser-side)** | Settings list of distracting hosts; during a session, opening one shows a full-page "Are you sure?" overlay (no extension required) | High — closes biggest functional gap vs Session/Forest | M | Generic, but core to Pomodoro | Web-only soft block; not as strong as native, but cheap and on-brand. Could later evolve into a real extension |
| 5 | **Day-shutdown ritual** | End-of-day prompt: "Wins / blockers / tomorrow's first Pomodoro." Stored per day, surfaced on idle next morning | High — natural extension of your reflection note; very Sunsama | S | **Strongly** (reflection is your edge) | Pure DB + form. Cheap and very on-brand |
| 6 | **Yearly heatmap** | GitHub-style 365-day grid of focus minutes | Med — high "wow", low cost | S | Yes | Already in Tier C — promote it; reuses Dexie aggregates |
| 7 | **Per-task / per-session distraction tap** | One-tap "got distracted" counter during focus; surfaces in session detail + weekly view | Med — concrete behavior data, very ADHD-friendly | S | Yes (you already store reflections) | Tier B item — promote. Pair with #4 |
| 8 | **Edit task / project mid-session** | Click the current task label to rename in place | Med | S | Yes | Already in Tier B. Bundle with #1 |
| 9 | **Strict / flexible mode toggle** | "Strict" = no +5min, no pause-during-overflow, no overtime. Used by hardcore Pomodoro users | Med | S | Yes | Tier B item — promote. Settings only |
| 10 | **Long-break interval setting** | Every N Pomodoros, long break (default 4 → 15min). Currently fixed | Med | S | Yes | Commodity. 1-day fix |
| 11 | **Resume last session** | Idle-screen button: "Resume last (Project / task / duration)" | Med | S | Yes | Tier B — promote |
| 12 | **AI weekly review** | Sunday digest: "You did 24 Pomodoros, 70% on Ventryx, longest streak Wed, dropped focus Fri afternoon. Try X." Anthropic API | Med — high delight, repeated touchpoint | M | **Strongly** (reflection notes feed the prompt) | Tier D — promote. Costs ~$0.01/user/wk. Differentiator |
| 13 | **PWA install + offline service worker** | Real installability, offline sessions, lock-screen progress on Android | Med — fixes the iOS gap that's already a QA item | M | Generic | Tier D — promote because cloud sync is now done and the mobile story is the obvious next gap |
| 14 | **Co-focus room (lightweight)** | Share a short URL; anyone with it joins a synced timer + sees count of others. No chat, no login | Med — strong differentiator if you have any audience; cheap MVP | M | Generic | Supabase Realtime channel; no new infra. Risk: empty rooms feel sad. Build invite-only |
| 15 | **Calendar sync (Google read-only first)** | Show next meeting on idle screen; block focus suggestions around meetings | Med | M | Generic | Google OAuth scope, server endpoint. Skip iCal/Outlook v1 |
| 16 | **ADHD time-perception ring** | Option to show ring as a "draining" pie (filled wedge shrinks) instead of progress arc — research-backed for ADHD | Low–Med | S | Yes | Visual variant of existing component. Cheap and meaningful |
| 17 | **Custom chime / per-project sound** | Upload or pick chime per project | Low | S | Yes | Tier C item — promote only if asked |
| 18 | **Themes (3-4 presets)** | Light / dark / sepia / high-contrast | Low | S | Generic | Tailwind tokens. Brings perceived polish |

---

## Buckets

### Next sprint — high ROI, low effort
1. **Tasks + estimated Pomodoros** (#1) — biggest commodity gap, schema work pays back across analytics, finish-time, and the AI weekly review
2. **Auto-start next session** (#2)
3. **Day-shutdown ritual** (#5) — leverages your unique reflection edge
4. **Long-break interval setting** (#10)
5. **Resume last session** (#11)
6. **Strict / flexible mode toggle** (#9)
7. **Distraction tap counter** (#7)
8. **Yearly heatmap** (#6)

This is one ~2-week sprint and closes most table-stakes gaps while doubling down on your reflection-first identity.

### Worth doing — medium effort
9. **Flowtime / stopwatch mode** (#3) — real differentiator vs every named competitor
10. **Site blocker (soft web-side)** (#4)
11. **AI weekly review** (#12) — distinctive, recurring touchpoint
12. **PWA install + offline** (#13) — needed before any serious mobile push
13. **Edit task mid-session** (#8) — pair with #1
14. **ADHD draining-pie option** (#16)

### Defer / be skeptical
- **Co-focus rooms** (#14) — cool, but needs an audience first; build later
- **Calendar sync** (#15) — OAuth complexity, low return until tasks land
- **Themes / per-project chimes** (#17, #18) — only when users actually ask
- **Forest-style real-tree gamification** — off-brand; you're a reflection tool, not a guilt tool
- **Habitica-style RPG** — opposite of minimalist Pomodoro
- **Native mobile wrapper** (Tier D) — PWA first, native only if install rates justify it

---

## Notes on strategic positioning

Your edge isn't "another Pomodoro timer" — it's **"reflective focus with a ritual."** The breathing intro and per-session note are unusual; nobody in the inventory (except Sunsama, which costs $20/mo) treats reflection as core. Lean into that:

- The shortlist's top picks (#1, #2, #5, #12) all reinforce reflection / ritual.
- Avoid feature creep toward gamification (Forest / Habitica territory) — it dilutes the calm tone.
- Avoid trying to out-block Session or out-task Focus To-Do; build the *quiet* version of those features (soft blocker, lightweight tasks).

Sources scanned: Forest (App Store, Product Hunt, Google Play), Pomofocus.io, Focus To-Do, Session (stayinsession.com), TickTick blog + help, Flow (flow.app, Kofe Flow), Centered, Sunsama help docs, Marinara (Chrome Web Store), Toggl Track, Bear Focus Timer, Focus Keeper, Habitica, Focumon, Social Pomodoro, Academync, Habi, Reclaim's 2026 top-11 list, Mindful Suite ADHD list, Smart Remote Gigs 2026 ranking.
