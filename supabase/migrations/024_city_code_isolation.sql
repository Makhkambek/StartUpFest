-- Migration 024 — Per-region data isolation.
-- SFRC runs 14 events across Uzbekistan in sequence. Each event's teams,
-- results, matches and schedule are tagged with the active city_code so
-- switching regions in event_settings shows only that region's data.
--
-- Default 'TSH' tags all existing rows as Tashkent data.

BEGIN;

-- ── Data tables ────────────────────────────────────────────────────────────────
ALTER TABLE teams             ADD COLUMN IF NOT EXISTS city_code TEXT NOT NULL DEFAULT 'TSH';
ALTER TABLE results_a         ADD COLUMN IF NOT EXISTS city_code TEXT NOT NULL DEFAULT 'TSH';
ALTER TABLE matches_b         ADD COLUMN IF NOT EXISTS city_code TEXT NOT NULL DEFAULT 'TSH';
ALTER TABLE fights_c          ADD COLUMN IF NOT EXISTS city_code TEXT NOT NULL DEFAULT 'TSH';
ALTER TABLE matches_d         ADD COLUMN IF NOT EXISTS city_code TEXT NOT NULL DEFAULT 'TSH';
ALTER TABLE scheduled_matches ADD COLUMN IF NOT EXISTS city_code TEXT NOT NULL DEFAULT 'TSH';

-- ── live_match_state: change PK from (category) to (city_code, category) ──────
ALTER TABLE live_match_state ADD COLUMN IF NOT EXISTS city_code TEXT NOT NULL DEFAULT 'TSH';
ALTER TABLE live_match_state DROP CONSTRAINT IF EXISTS live_match_state_pkey;
ALTER TABLE live_match_state ADD PRIMARY KEY (city_code, category);

-- Re-seed missing city+category combos for the default city so new regions
-- get rows on first access (the API self-heals too, but this is cleaner).
INSERT INTO live_match_state (city_code, category)
VALUES
  ('TSH','a'),('TSH','b'),('TSH','c'),('TSH','d')
ON CONFLICT (city_code, category) DO NOTHING;

-- ── Indexes for common filter pattern ─────────────────────────────────────────
CREATE INDEX IF NOT EXISTS teams_city_cat_idx             ON teams(city_code, category);
CREATE INDEX IF NOT EXISTS results_a_city_idx             ON results_a(city_code);
CREATE INDEX IF NOT EXISTS matches_b_city_idx             ON matches_b(city_code);
CREATE INDEX IF NOT EXISTS fights_c_city_idx              ON fights_c(city_code);
CREATE INDEX IF NOT EXISTS matches_d_city_idx             ON matches_d(city_code);
CREATE INDEX IF NOT EXISTS scheduled_matches_city_cat_idx ON scheduled_matches(city_code, category);

COMMIT;
