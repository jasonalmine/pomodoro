-- Soft-delete tombstone for projects, matching pomodoros/tasks. A non-null
-- deleted_at means the project should be treated as gone on every device,
-- which lets project deletions propagate through sync (previously projects
-- had no tombstone, so deletes never synced). Existing rows keep null.
alter table projects add column if not exists deleted_at bigint;
