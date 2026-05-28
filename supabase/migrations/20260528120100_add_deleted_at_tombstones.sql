-- Soft-delete tombstones for cross-device propagation. A non-null
-- deleted_at means the row should be treated as gone on every device.
-- Existing rows keep null.
alter table pomodoros add column if not exists deleted_at bigint;
alter table tasks add column if not exists deleted_at bigint;
