-- Migration 007: Fix results_a primary key
-- Original PK was on team_id — fails when the same team has multiple scheduled matches.
-- New PK: scheduled_match_id (one result per scheduled match).
-- Also ensures run1/run2/total are DOUBLE PRECISION (decimals).

BEGIN;

-- Drop any rows that can't be migrated
DELETE FROM results_a WHERE scheduled_match_id IS NULL;

-- Drop old constraints
ALTER TABLE results_a DROP CONSTRAINT IF EXISTS results_a_pkey;
ALTER TABLE results_a DROP CONSTRAINT IF EXISTS results_a_scheduled_match_id_key;

-- Enforce NOT NULL and set new PK
ALTER TABLE results_a ALTER COLUMN scheduled_match_id SET NOT NULL;
ALTER TABLE results_a ADD PRIMARY KEY (scheduled_match_id);

-- Make sure run columns are floats (in case they were INT originally)
ALTER TABLE results_a
  ALTER COLUMN run1 TYPE DOUBLE PRECISION USING run1::double precision,
  ALTER COLUMN run2 TYPE DOUBLE PRECISION USING run2::double precision,
  ALTER COLUMN total TYPE DOUBLE PRECISION USING total::double precision;

COMMIT;
