-- Migration 022 — Per-team forfeit (no-show) flags for matches_d.
-- A forfeited team gets L+1, GF=0, GA=0 instead of the alliance result.

BEGIN;

ALTER TABLE matches_d
  ADD COLUMN IF NOT EXISTS team1_forfeit  BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS team1b_forfeit BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS team2_forfeit  BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS team2b_forfeit BOOLEAN NOT NULL DEFAULT false;

COMMIT;
