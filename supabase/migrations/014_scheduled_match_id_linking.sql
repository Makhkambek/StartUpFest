-- Migration 014 — Link result tables to scheduled_matches via scheduled_match_id.
-- Without this, multiple result rows can have the same (team1_id, team2_id) pair
-- across different tournaments / re-generated schedules — causing old test results
-- to "stick" to newly generated scheduled matches.

BEGIN;

ALTER TABLE matches_b
  ADD COLUMN IF NOT EXISTS scheduled_match_id UUID REFERENCES scheduled_matches(id) ON DELETE SET NULL;

ALTER TABLE fights_c
  ADD COLUMN IF NOT EXISTS scheduled_match_id UUID REFERENCES scheduled_matches(id) ON DELETE SET NULL;

ALTER TABLE matches_d
  ADD COLUMN IF NOT EXISTS scheduled_match_id UUID REFERENCES scheduled_matches(id) ON DELETE SET NULL;

-- One result per scheduled match (when set). Allows NULL for legacy / direct entries.
CREATE UNIQUE INDEX IF NOT EXISTS matches_b_scheduled_match_id_uniq
  ON matches_b(scheduled_match_id) WHERE scheduled_match_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS fights_c_scheduled_match_id_uniq
  ON fights_c(scheduled_match_id) WHERE scheduled_match_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS matches_d_scheduled_match_id_uniq
  ON matches_d(scheduled_match_id) WHERE scheduled_match_id IS NOT NULL;

COMMIT;
