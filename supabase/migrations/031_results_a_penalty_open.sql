-- Migration 031: Remove fixed-value CHECK constraint on results_a.penalty
-- Now stores any non-negative integer as string (e.g. '0', '10', '30', '100')
-- plus the special values 'dnf' and 'disq'.
-- Reason: penalty is a free accumulation of +10s / +40s events; capping at '50'
-- was too restrictive for edge cases where multiple penalties stack.

DO $$
DECLARE
  con_name TEXT;
BEGIN
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
