-- Track which team slots in a Cat D alliance match are "surrogate"
-- (they play to fill the schedule but their result does not count for standings).
ALTER TABLE scheduled_matches
  ADD COLUMN IF NOT EXISTS surrogate_team_ids UUID[] NOT NULL DEFAULT '{}';
