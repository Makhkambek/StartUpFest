-- Migration 021 — Alliance partner columns for matches_d (Robo Football).
-- Stores the second team in each alliance so standings can credit all 4 teams.

BEGIN;

ALTER TABLE matches_d
  ADD COLUMN IF NOT EXISTS team1b_id UUID REFERENCES teams(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS team2b_id UUID REFERENCES teams(id) ON DELETE SET NULL;

COMMIT;
