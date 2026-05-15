# Tier 1: Day-shutdown + Flowtime + AI weekly review

Three features, three commits, in order.

## Commit 1 — Day-shutdown ritual
- [ ] Type `DayShutdown` { id (yyyy-mm-dd), date, wins, blockers, tomorrowProjectId?, tomorrowTask?, tomorrowMinutes?, createdAt, updatedAt }
- [ ] Dexie v6: `dayShutdowns` table
- [ ] Supabase: add `day_shutdowns` table to schema file + sync.ts mapping
- [ ] Insights → "Wrap up day" button on Today tab → opens panel
- [ ] Panel: wins, blockers, tomorrow's first focus (project + task + duration)
- [ ] Idle screen next morning: card showing yesterday's plan with one-tap apply
- [ ] Export/import includes shutdowns

## Commit 2 — Flowtime mode
- [ ] New `'flow'` phase
- [ ] Add Flow tab to idle ModePicker (4-up)
- [ ] Idle flow screen: project + task picker, no duration; "Start flowing" CTA
- [ ] Active flow screen: count UP from 0, no overflow concept
- [ ] Stop button proposes a proportional break: floor(flow_minutes / 5), min 5, max 20
- [ ] Save Pomodoro with `plannedSeconds: 0`, `actualSeconds: elapsed`, plus a new `flowMode: true` flag
- [ ] Type/schema bump for Pomodoro.flowMode
- [ ] Insights stays correct (treat as completed when ended deliberately)

## Commit 3 — AI weekly review
- [ ] Settings: BYO Anthropic API key field (stored in Settings table; not synced)
- [ ] Settings: model select (haiku-4-5 / sonnet-4-6 / opus-4-7)
- [ ] lib/ai.ts: build prompt from last 7 days of pomodoros (+ reflections + shutdowns + tasks)
- [ ] Call Anthropic Messages API using SDK with dangerouslyAllowBrowser
- [ ] Insights → Week tab: "Generate weekly review" button; show streaming or non-streaming result
- [ ] Save review to local `weeklyReviews` table keyed by ISO week
- [ ] Skip Supabase sync for reviews v1 (local cache only)

## Build discipline
- Run `npm run build` after each commit
- Update ROADMAP.md after each
- Keep scratchpad updated
