-- Google Calendar (Maton) sync bookkeeping on pomodoros.
-- `calendar_event_id` is the Google Calendar event id for a synced focus block;
-- its presence means the block is on the calendar (idempotency + lets a delete
-- on one device remove the event). `calendar_synced_at` is the sync timestamp.
-- Both null on existing rows. The Maton API key itself is never synced — it
-- lives only in on-device settings.
alter table pomodoros add column if not exists calendar_event_id text;
alter table pomodoros add column if not exists calendar_synced_at bigint;
