-- Per-project weekly Pomodoro goal in seconds. Null/0 means no goal.
-- Optional, nullable; legacy rows keep null.
alter table projects add column if not exists weekly_goal_seconds bigint;
