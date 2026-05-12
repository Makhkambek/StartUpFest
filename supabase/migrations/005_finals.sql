-- Migration 005: Add phase and round fields for FINALS bracket
-- Run this in Supabase SQL Editor

ALTER TABLE scheduled_matches
  ADD COLUMN IF NOT EXISTS phase TEXT NOT NULL DEFAULT 'qualification'
    CHECK (phase IN ('qualification', 'finals')),
  ADD COLUMN IF NOT EXISTS round TEXT
    CHECK (round IS NULL OR round IN ('group', 'r1', 'r2', 'quarter', 'semi', 'third_place', 'final', 'triangle'));

CREATE INDEX IF NOT EXISTS scheduled_matches_phase_idx ON scheduled_matches(category, phase);
