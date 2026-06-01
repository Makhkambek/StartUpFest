-- Migration 027: Add standby_mode flag to live_match_state
-- Run this in Supabase SQL Editor

ALTER TABLE live_match_state
  ADD COLUMN IF NOT EXISTS standby_mode BOOLEAN NOT NULL DEFAULT false;
