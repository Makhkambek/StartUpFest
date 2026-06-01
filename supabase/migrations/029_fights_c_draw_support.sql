-- Migration 029: Add Draw support to fights_c
-- winner: was 1|2 only, now 0 (draw) | 1 | 2
-- method: was KO|IMM|JD, now adds DRAW

DO $$
DECLARE con_name TEXT;
BEGIN
  -- Drop existing winner CHECK constraint if any
  SELECT c.conname INTO con_name
  FROM pg_constraint c
  JOIN pg_class t ON c.conrelid = t.oid
  JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY(c.conkey)
  WHERE t.relname = 'fights_c' AND c.contype = 'c' AND a.attname = 'winner'
  LIMIT 1;
  IF con_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE fights_c DROP CONSTRAINT %I', con_name);
  END IF;

  -- Drop existing method CHECK constraint if any
  SELECT c.conname INTO con_name
  FROM pg_constraint c
  JOIN pg_class t ON c.conrelid = t.oid
  JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY(c.conkey)
  WHERE t.relname = 'fights_c' AND c.contype = 'c' AND a.attname = 'method'
  LIMIT 1;
  IF con_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE fights_c DROP CONSTRAINT %I', con_name);
  END IF;
END $$;

ALTER TABLE fights_c
  ADD CONSTRAINT fights_c_winner_check CHECK (winner IN (0, 1, 2)),
  ADD CONSTRAINT fights_c_method_check CHECK (method IN ('KO', 'IMM', 'JD', 'DRAW'));
