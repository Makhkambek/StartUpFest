-- Migration 011 — Fix scheduled_matches.status CHECK constraint
-- Bug: после миграции 009 (waiting) constraint иногда падает на INSERT с 'waiting'/'active'.
-- Подозрение: остатки старого constraint под другим именем, либо кэш в pooler.
-- Решение: найти ВСЕ check-constraints на колонке status и пересоздать чисто.

BEGIN;

-- Drop every CHECK constraint that touches scheduled_matches.status (любое имя)
DO $$
DECLARE
  c RECORD;
BEGIN
  FOR c IN
    SELECT con.conname
    FROM pg_constraint con
    JOIN pg_class cl ON cl.oid = con.conrelid
    WHERE cl.relname = 'scheduled_matches'
      AND con.contype = 'c'
      AND pg_get_constraintdef(con.oid) ILIKE '%status%'
  LOOP
    EXECUTE format('ALTER TABLE scheduled_matches DROP CONSTRAINT %I', c.conname);
  END LOOP;
END $$;

-- Recreate с явным NOT VALID → VALIDATE, чтобы обойти любой pooler cache
ALTER TABLE scheduled_matches
  ADD CONSTRAINT scheduled_matches_status_check
  CHECK (status IN ('pending', 'waiting', 'active', 'completed')) NOT VALID;

ALTER TABLE scheduled_matches VALIDATE CONSTRAINT scheduled_matches_status_check;

-- Default + NOT NULL на всякий
ALTER TABLE scheduled_matches ALTER COLUMN status SET DEFAULT 'pending';
ALTER TABLE scheduled_matches ALTER COLUMN status SET NOT NULL;

COMMIT;

-- После применения: NOTIFY pgrst, 'reload schema'; (для PostgREST cache, если используется)
NOTIFY pgrst, 'reload schema';
