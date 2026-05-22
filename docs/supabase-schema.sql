-- Pomodoro Supabase schema
--
-- Paste this whole file into the Supabase SQL Editor on a fresh project,
-- or rerun it on an existing one: every statement is idempotent.
-- Tables/columns/indexes use IF NOT EXISTS; policies are dropped then
-- recreated (Postgres has no CREATE POLICY IF NOT EXISTS).
--
-- Tables: projects, pomodoros, tasks, templates, day_shutdowns.
-- Settings + AI keys stay device-local (never synced).
-- Row-level security: every row is scoped to auth.uid().

------------------------------------------------------------
-- projects
------------------------------------------------------------
create table if not exists projects (
  id text primary key,
  user_id uuid references auth.users not null,
  name text not null,
  color text,
  description text,
  archived boolean default false,
  created_at bigint not null,
  updated_at bigint not null
);

alter table projects enable row level security;

drop policy if exists "Users manage their own projects" on projects;
create policy "Users manage their own projects" on projects
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index if not exists projects_user_updated on projects (user_id, updated_at);

------------------------------------------------------------
-- pomodoros
------------------------------------------------------------
create table if not exists pomodoros (
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

-- Columns added after the original schema. These are no-ops on a fresh table.
alter table pomodoros add column if not exists task_id text;
alter table pomodoros add column if not exists note_done text;
alter table pomodoros add column if not exists note_next text;
alter table pomodoros add column if not exists flow_mode boolean;
alter table pomodoros add column if not exists manual boolean;
alter table pomodoros add column if not exists distractions int;
alter table pomodoros add column if not exists tags text[];

alter table pomodoros enable row level security;

drop policy if exists "Users manage their own pomodoros" on pomodoros;
create policy "Users manage their own pomodoros" on pomodoros
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index if not exists pomodoros_user_updated on pomodoros (user_id, updated_at);
create index if not exists pomodoros_task on pomodoros (task_id);

------------------------------------------------------------
-- tasks
------------------------------------------------------------
create table if not exists tasks (
  id text primary key,
  user_id uuid references auth.users not null,
  project_id text not null,
  name text not null,
  est_pomodoros int not null default 1,
  completed boolean not null default false,
  completed_at bigint,
  archived_at bigint,
  "order" bigint not null,
  created_at bigint not null,
  updated_at bigint not null
);

alter table tasks enable row level security;

drop policy if exists "Users manage their own tasks" on tasks;
create policy "Users manage their own tasks" on tasks
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index if not exists tasks_user_updated on tasks (user_id, updated_at);
create index if not exists tasks_project on tasks (project_id);

------------------------------------------------------------
-- templates
------------------------------------------------------------
create table if not exists templates (
  id text primary key,
  user_id uuid references auth.users not null,
  name text not null,
  project_id text,
  work_minutes int not null,
  short_break_minutes int not null,
  long_break_minutes int not null,
  use_ritual boolean not null,
  created_at bigint not null,
  updated_at bigint not null
);

alter table templates enable row level security;

drop policy if exists "Users manage their own templates" on templates;
create policy "Users manage their own templates" on templates
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index if not exists templates_user_updated on templates (user_id, updated_at);

------------------------------------------------------------
-- day_shutdowns (one row per local calendar day)
------------------------------------------------------------
create table if not exists day_shutdowns (
  id text primary key,
  user_id uuid references auth.users not null,
  date bigint not null,
  wins text,
  blockers text,
  tomorrow_project_id text,
  tomorrow_task text,
  tomorrow_minutes int,
  created_at bigint not null,
  updated_at bigint not null
);

alter table day_shutdowns enable row level security;

drop policy if exists "Users manage their own day_shutdowns" on day_shutdowns;
create policy "Users manage their own day_shutdowns" on day_shutdowns
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index if not exists day_shutdowns_user_updated on day_shutdowns (user_id, updated_at);

------------------------------------------------------------
-- day_notes (free-form journal text per calendar day)
------------------------------------------------------------
create table if not exists day_notes (
  id text primary key,
  user_id uuid references auth.users not null,
  date bigint not null,
  content text not null default '',
  created_at bigint not null,
  updated_at bigint not null
);

alter table day_notes enable row level security;

drop policy if exists "Users manage their own day_notes" on day_notes;
create policy "Users manage their own day_notes" on day_notes
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index if not exists day_notes_user_updated on day_notes (user_id, updated_at);
