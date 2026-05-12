-- Migration 009: Add 'waiting' status for matches about to start
-- Run this in Supabase SQL Editor

ALTER TABLE scheduled_matches
  DROP CONSTRAINT IF EXISTS scheduled_matches_status_check;

ALTER TABLE scheduled_matches
  ADD CONSTRAINT scheduled_matches_status_check
    CHECK (status IN ('pending', 'waiting', 'active', 'completed'));
