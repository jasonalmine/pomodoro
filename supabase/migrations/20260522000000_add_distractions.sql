-- Distraction tap counter: per-session count of "got distracted" presses.
-- Optional, nullable; legacy rows keep null.
alter table pomodoros add column if not exists distractions int;
