-- Migration 006: Allow team2_id to be null (Cat A solo runs, tie-break extra runs)
-- Run this in Supabase SQL Editor

ALTER TABLE scheduled_matches
  ALTER COLUMN team2_id DROP NOT NULL;
