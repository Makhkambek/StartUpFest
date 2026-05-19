-- Migration 015 — Alliance partners for category D (Robo Football).
-- Each scheduled match in cat D has 4 teams: red alliance (team1 + team1b),
-- blue alliance (team2 + team2b). For A/B/C these stay NULL.

BEGIN;

ALTER TABLE scheduled_matches
  ADD COLUMN IF NOT EXISTS team1b_id UUID REFERENCES teams(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS team2b_id UUID REFERENCES teams(id) ON DELETE SET NULL;

COMMIT;
