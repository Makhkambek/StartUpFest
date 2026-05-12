-- Migration 003: Create scheduled_matches table
-- Run this in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS scheduled_matches (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category    TEXT NOT NULL CHECK (category IN ('a', 'b', 'c', 'd')),
  match_id    TEXT NOT NULL,
  team1_id    UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  team2_id    UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  status      TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed')),
  result_id   UUID,
  notes       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS scheduled_matches_category_idx ON scheduled_matches(category);
