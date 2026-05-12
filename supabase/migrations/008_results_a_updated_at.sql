-- Migration 008: Ensure results_a has updated_at column
-- The API sets updated_at on every upsert; if the column is missing the save fails silently.
-- Also ensure scheduled_match_id is indexed for upsert performance.

ALTER TABLE results_a
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
