# Supabase setup

Cloud sync is optional. Without it, the app works fully local (IndexedDB only). With it, your projects and Pomodoros sync across every device you sign in on.

## One-time setup

### 1. Create a Supabase project

1. Go to https://supabase.com → New project.
2. Pick a name (e.g. `pomodoro`) and a region close to you.
3. Save the database password somewhere safe (you won't need it again for this app, just for the dashboard).

### 2. Run the schema

Open the SQL Editor in the Supabase dashboard and paste this:

```sql
create table projects (
  id text primary key,
  user_id uuid references auth.users not null,
  name text not null,
  color text,
  description text,
  archived boolean default false,
  created_at bigint not null,
  updated_at bigint not null
);

create table pomodoros (
  id text primary key,
  user_id uuid references auth.users not null,
  project_id text,
  task text,
  started_at bigint not null,
  ended_at bigint,
  planned_seconds int,
  actual_seconds int,
  completed boolean,
  note text,
  ritual_used boolean,
  updated_at bigint not null
);

-- Row level security
alter table projects enable row level security;
alter table pomodoros enable row level security;

create policy "Users manage their own projects" on projects
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "Users manage their own pomodoros" on pomodoros
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Helpful indexes for incremental sync
create index projects_user_updated on projects (user_id, updated_at);
create index pomodoros_user_updated on pomodoros (user_id, updated_at);
```

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
- Settings stay device-local in v1 (sync only covers projects + pomodoros).

## Notes

- The app reports "Cloud sync not configured" in Settings when env vars are missing — totally fine for offline-only use.
- If you sign out, the local cache stays intact. Sign back in and sync continues.
