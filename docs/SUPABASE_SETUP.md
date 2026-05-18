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

Open Settings, scroll to **Cloud sync**, enter your email, click "Send magic link". Click the link in your email. You're synced.

## How it works

- Dexie (IndexedDB) is still the primary store. Reads are instant and offline-friendly.
- Every write to Dexie is followed by a debounced push to Supabase (1.5s delay).
- Every 60s + on tab visibility/online events, a `syncNow()` runs which pushes dirty rows then pulls remote changes.
- Conflict resolution: last-write-wins via `updatedAt` timestamps.
- Sync covers `projects`, `pomodoros`, `tasks`, and `templates`. Settings stay device-local on purpose (a different audio preference per device is sometimes useful).

## Notes

- The app reports "Cloud sync not configured" in Settings when env vars are missing — totally fine for offline-only use.
- If you sign out, the local cache stays intact. Sign back in and sync continues.
