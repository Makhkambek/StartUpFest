-- Migration 013 — Ensure existing match/result tables are in realtime publication
-- so field/* and public displays receive postgres_changes events.
-- Skips tables that don't exist in this database.

DO $$
DECLARE tbl text;
BEGIN
  FOREACH tbl IN ARRAY ARRAY['teams','scheduled_matches','results_a','matches_b','fights_c','matches_d','live_match_state']
  LOOP
    IF to_regclass('public.' || tbl) IS NULL THEN
      CONTINUE;
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND tablename = tbl
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE %I', tbl);
    END IF;
  END LOOP;
END $$;
