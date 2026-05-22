-- Per-day notes journal: free-form scratchpad text per calendar day,
-- separate from the structured day_shutdowns ritual.
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
