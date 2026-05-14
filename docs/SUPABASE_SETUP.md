# Supabase setup

Cloud sync is optional. Without it, the app works fully local (IndexedDB only). With it, your projects and Pomodoros sync across every device you sign in on.

## One-time setup

### 1. Create a Supabase project

1. Go to https://supabase.com → New project.
2. Pick a name (e.g. `pomodoro`) and a region close to you.
3. Save the database password somewhere safe (you won't need it again for this app, just for the dashboard).

### 2. Run the schema

Open the SQL Editor in the Supabase dashboard and paste the contents of [`docs/supabase-schema.sql`](./supabase-schema.sql).

That file creates four tables — `projects`, `pomodoros`, `tasks`, `templates` — each gated by row-level security (`auth.uid() = user_id`). It's idempotent: every statement uses `IF NOT EXISTS` / `IF NOT EXISTS` policies / `ADD COLUMN IF NOT EXISTS`, so you can also rerun it on an existing project to bring it up to date.

If you set up the database before tasks/templates landed, the same file will patch your existing tables in place (it adds `task_id`, `note_done`, `note_next` to `pomodoros`, and creates the missing tables).

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
