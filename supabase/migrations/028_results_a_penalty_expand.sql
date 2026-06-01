-- Migration 028: Expand results_a penalty column to include +10s and +50s values
-- Old allowed values: '0', '20', '40', 'dnf', 'disq'
-- New allowed values: '0', '10', '20', '40', '50', 'dnf', 'disq'
--
-- Reason: rulebook specifies +10s penalty (off-track >3s / participant touch),
-- and +50s is the combination of +40s beam-not-crossed with one +10s event.
-- +20s now means two stacked +10s events (no longer an invalid value).

DO $$
DECLARE
  con_name TEXT;
BEGIN
  -- Find and drop any existing CHECK constraint on the penalty column of results_a
  SELECT c.conname INTO con_name
  FROM pg_constraint c
  JOIN pg_class t ON c.conrelid = t.oid
  JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY(c.conkey)
  WHERE t.relname = 'results_a'
    AND c.contype = 'c'
    AND a.attname = 'penalty'
  LIMIT 1;

  IF con_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE results_a DROP CONSTRAINT %I', con_name);
  END IF;
END $$;

-- Add updated CHECK constraint
ALTER TABLE results_a
  ADD CONSTRAINT results_a_penalty_check
  CHECK (penalty IN ('0', '10', '20', '40', '50', 'dnf', 'disq'));
