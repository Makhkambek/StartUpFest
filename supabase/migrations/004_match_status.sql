-- Migration 004: Add 'active' status for in-progress matches
-- Run this in Supabase SQL Editor

ALTER TABLE scheduled_matches
  DROP CONSTRAINT IF EXISTS scheduled_matches_status_check;

ALTER TABLE scheduled_matches
  ADD CONSTRAINT scheduled_matches_status_check
    CHECK (status IN ('pending', 'active', 'completed'));
