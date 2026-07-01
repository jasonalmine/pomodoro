# Supabase setup

Cloud sync is optional. Without it, the app works fully local (IndexedDB only). With it, your projects and Pomodoros sync across every device you sign in on.

## One-time setup

### 1. Create a Supabase project

1. Go to https://supabase.com → New project.
2. Pick a name (e.g. `pomodoro`) and a region close to you.
3. Save the database password somewhere safe (you won't need it again for this app, just for the dashboard).

### 2. Apply the schema (CLI migrations — no dashboard paste)

Schema lives as version-controlled migrations in `supabase/migrations/`.
You apply them with one command instead of pasting SQL into the dashboard.

**One-time setup:**

```bash
# Install the CLI (macOS)
brew install supabase/tap/supabase

# Authenticate (opens a browser — no token pasting)
supabase login

# Link this repo to the remote project. Prompts for the DB password
# in YOUR terminal — never paste it into chat or commit it.
supabase link --project-ref wuwegfuxsbcuhmtkugfs
```

**Apply pending migrations (now and after every future schema change):**

```bash
npm run db:push        # supabase db push --linked
```

That applies any migration files the remote DB hasn't seen yet. The
baseline migration is idempotent, so the first push is safe even though
the database was originally bootstrapped by hand.

**Adding a schema change later:**

```bash
npm run db:new add_some_column      # creates a timestamped empty migration
# edit the new file in supabase/migrations/, then:
npm run db:push
npm run db:status                   # shows applied vs pending
```

The old single-file [`docs/supabase-schema.sql`](./supabase-schema.sql)
is kept only as a dashboard fallback / reference snapshot. The
migrations directory is the source of truth.

**Credential hygiene:** `supabase login` stores its token locally
(`~/.supabase`), and the DB password is entered interactively by
`supabase link`. Never paste either into chat, code, or commits.

### 3. Allow magic-link logins

In **Authentication → Providers → Email**:
- Enable Email provider
- Enable "Email OTP" / "Magic link"
- Disable "Confirm email" if you want first-time sign-ins to land directly in the app (optional)

In **Authentication → URL Configuration**:
- Add your site URL: `https://pomodoro.jasonalmine.dev`
- For local dev also add `http://localhost:5173`

**Desktop (Tauri) app:** the magic *link* can't round-trip into the desktop app
(its origin is `tauri://localhost`, which a browser can't open). Instead, **copy
the login link from the email and paste it into the app** — it extracts the
one-time token and signs you in. No email-template change is needed. (Optionally,
if you add `{{ .Token }}` to the Magic Link template, the email also carries a
6-digit code you can type instead.)

### 4. Grab the credentials

In **Project Settings → API**:
- Copy `URL`
- Copy `anon public` key (NOT the service role key)

### 5. Wire env vars

Create `.env.local` in the project root:

```
VITE_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOi...
```

For production (Vercel), add the same two variables under Project → Settings → Environment Variables.

### 6. Run

```
npm run dev
```

Open Settings, scroll to **Cloud sync**, enter your email, click "Send code".
On the web, click the link in your email. In the desktop app, copy the login
link from the email, paste it into the field, and click "Sign in". You're synced.

## Desktop app (Tauri menu bar)

The desktop shell reuses the exact same web app and sync engine, so your data
flows across web and desktop automatically once both sign into the same Supabase
project.

- **Env at build time.** `npm run tauri:dev` / `tauri:build` run `vite`, which
  reads `.env` / `.env.local`. Copy `.env.example` to `.env` and fill in the same
  `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` your web app uses. Without
  them the desktop app runs local-only (Cloud sync shows "not configured").
- **Sign in by pasting the login link** from the email (see section 3 above) — the
  link can't complete by clicking, but the app reads the token out of it.
- **Google Calendar export.** The Maton API key is an on-device secret (stored in
  this app's IndexedDB, never synced), so re-enter it once in the desktop app's
  Settings → Calendar. Focus blocks already exported from the web carry their
  `calendarEventId` through Supabase sync, so the desktop won't create duplicate
  calendar events — only new blocks are pushed.

## How it works

- Dexie (IndexedDB) is still the primary store. Reads are instant and offline-friendly.
- Every write to Dexie is followed by a debounced push to Supabase (1.5s delay).
- Every 60s + on tab visibility/online events, a `syncNow()` runs which pushes dirty rows then pulls remote changes.
- Conflict resolution: last-write-wins via `updatedAt` timestamps.
- Sync covers `projects`, `pomodoros`, `tasks`, and `templates`. Settings stay device-local on purpose (a different audio preference per device is sometimes useful).

## Notes

- The app reports "Cloud sync not configured" in Settings when env vars are missing — totally fine for offline-only use.
- If you sign out, the local cache stays intact. Sign back in and sync continues.
