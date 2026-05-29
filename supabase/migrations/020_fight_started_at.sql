-- Migration 020: add fight_started_at to live_match_state
--
-- fight_started_at is set by the server the moment a run actually begins
-- (go_fight action). The elapsed time is then computed server-side as
-- (NOW() - fight_started_at) when finish_run arrives, eliminating any
-- dependency on browser clocks and removing clock-skew errors in Cat A results.
--
-- Apply in Supabase SQL Editor (postgres role).

ALTER TABLE live_match_state
  ADD COLUMN IF NOT EXISTS fight_started_at TIMESTAMPTZ NULL;
