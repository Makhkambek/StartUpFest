-- Add finals_visible flag to live_match_state.
-- Judges toggle this per-category to show the finals bracket on /field/[cat].
ALTER TABLE live_match_state
  ADD COLUMN IF NOT EXISTS finals_visible BOOLEAN NOT NULL DEFAULT false;
