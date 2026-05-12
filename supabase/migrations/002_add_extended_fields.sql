-- Migration 002: Add extended fields to all result tables
-- Run this in Supabase SQL Editor

-- results_a: add run_phase and notes
ALTER TABLE results_a
  ADD COLUMN IF NOT EXISTS run_phase TEXT NOT NULL DEFAULT 'qualification'
    CHECK (run_phase IN ('qualification', 'final')),
  ADD COLUMN IF NOT EXISTS notes TEXT;

-- matches_b: add match_number, starting_position, notes
ALTER TABLE matches_b
  ADD COLUMN IF NOT EXISTS match_number INTEGER,
  ADD COLUMN IF NOT EXISTS starting_position TEXT NOT NULL DEFAULT 'face'
    CHECK (starting_position IN ('face', 'side', 'back')),
  ADD COLUMN IF NOT EXISTS notes TEXT;

-- fights_c: add fight_number, notes
ALTER TABLE fights_c
  ADD COLUMN IF NOT EXISTS fight_number INTEGER,
  ADD COLUMN IF NOT EXISTS notes TEXT;

-- matches_d: add match_number, match_phase, notes
ALTER TABLE matches_d
  ADD COLUMN IF NOT EXISTS match_number INTEGER,
  ADD COLUMN IF NOT EXISTS match_phase TEXT NOT NULL DEFAULT 'group'
    CHECK (match_phase IN ('group', 'extra', 'penalties')),
  ADD COLUMN IF NOT EXISTS notes TEXT;
