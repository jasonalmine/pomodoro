# Contributing

Thanks for your interest in Pomodoro. This is a small, local-first app; contributions that keep it calm and dependency-light are welcome.

## Prerequisites

- Node 22+ and npm
- For the macOS desktop app: the Rust toolchain (`rustup`) and Xcode Command Line Tools (`xcode-select --install`)

## Develop

```bash
npm install
npm run dev        # web app on http://localhost:5173
```

## Verify before opening a PR

There is no test runner. "Verify" means all three pass, plus exercising your change in the running app:

```bash
npm run build      # tsc typecheck + production build
npm run lint
npm run tauri:build # only if you touched the desktop shell (src-tauri/)
```

## Desktop app (Tauri v2)

```bash
npm run tauri:dev    # menu-bar app against the dev server
npm run tauri:build  # bundles Pomodoro.app + .dmg into src-tauri/target/release/bundle/
```

## Data model changes (the three-file rule)

Adding or changing a field on a synced entity (projects, pomodoros, tasks, templates, day_shutdowns, day_notes) touches three places, or sync silently breaks:

1. `src/types/index.ts` — the TS type
2. `src/lib/sync.ts` — the row type plus both `*ToRow` and `rowTo*` mappers
3. `supabase/migrations/` — a new migration (`npm run db:new`)

If the field must be queried/indexed in IndexedDB, also add a new `this.version(N)` block in `src/db/index.ts` (never edit an existing version block). Every mutation to a synced row must bump `updatedAt`, and deletes are soft (set `deletedAt`).

## Conventions

- Vite + React 19 + TypeScript + Tailwind v3. Views in `src/views/`, reusable UI in `src/components/`, side effects in `src/hooks/`, pure logic in `src/lib/`.
- All audio is procedural WebAudio — no sound assets.
- Grep for an existing util/component before creating a new one. No `-v2`/`-new`/`-copy` files.
- On-device secrets (Maton, AI keys) are never synced and are stripped from exports — keep that posture for any new credential.

## License

By contributing, you agree your contributions are licensed under the [MIT License](LICENSE).
