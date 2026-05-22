-- Per-session tags: free-form short labels like "deep", "admin", "meeting".
-- Stored as a text array; null on legacy rows, empty array means explicitly no tags.
alter table pomodoros add column if not exists tags text[];
