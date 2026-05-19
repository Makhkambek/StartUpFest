-- Migration 012 — Live match state for field displays.
-- One row per category. Judge UI updates it; field displays subscribe via Realtime.

BEGIN;

CREATE TABLE IF NOT EXISTS live_match_state (
  category text PRIMARY KEY CHECK (category IN ('a', 'b', 'c', 'd')),
  active_match_id uuid REFERENCES scheduled_matches(id) ON DELETE SET NULL,
  phase text NOT NULL DEFAULT 'idle'
    CHECK (phase IN ('idle','waiting','positioning','countdown','fighting','round_result','match_result')),
  round_number int NOT NULL DEFAULT 1,
  wins_red int NOT NULL DEFAULT 0,
  wins_white int NOT NULL DEFAULT 0,
  starting_position text CHECK (starting_position IN ('face','side','back')),
  last_round_winner text CHECK (last_round_winner IN ('red','white','draw')),
  match_winner int CHECK (match_winner IN (0,1,2)),
  countdown_started_at timestamptz,
  fouls_red int NOT NULL DEFAULT 0,
  fouls_white int NOT NULL DEFAULT 0,
  round_history jsonb NOT NULL DEFAULT '[]'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Seed one row per category if missing
INSERT INTO live_match_state (category) VALUES ('a'), ('b'), ('c'), ('d')
ON CONFLICT (category) DO NOTHING;

-- Touch updated_at on every update
CREATE OR REPLACE FUNCTION live_match_state_touch() RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS live_match_state_touch_trg ON live_match_state;
CREATE TRIGGER live_match_state_touch_trg
  BEFORE UPDATE ON live_match_state
  FOR EACH ROW EXECUTE FUNCTION live_match_state_touch();

-- RLS: public reads (field displays are anon), authenticated writes (judges)
ALTER TABLE live_match_state ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "live_match_state_public_read" ON live_match_state;
DROP POLICY IF EXISTS "live_match_state_auth_write"  ON live_match_state;
CREATE POLICY "live_match_state_public_read" ON live_match_state FOR SELECT USING (true);
CREATE POLICY "live_match_state_auth_write"  ON live_match_state FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Add to realtime publication so field displays can subscribe
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'live_match_state'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE live_match_state;
  END IF;
END $$;

COMMIT;
