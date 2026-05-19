-- Migration 016 — Event settings (multi-region).
-- SFRC runs 14 events across Uzbekistan regions. Admin sets city/year once
-- before each event; all field displays / PDFs / scoreboards read from here.

BEGIN;

CREATE TABLE IF NOT EXISTS event_settings (
  id         INT  PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  city_code  TEXT NOT NULL DEFAULT 'TSH',     -- one of UZ_CITIES codes (TSH, SAM, BUX, ...)
  year       INT  NOT NULL DEFAULT EXTRACT(YEAR FROM NOW())::INT,
  event_name TEXT,                            -- optional, e.g. "SFRC · Bukhara Stage"
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed the single row.
INSERT INTO event_settings (id, city_code, year)
VALUES (1, 'TSH', EXTRACT(YEAR FROM NOW())::INT)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE event_settings ENABLE ROW LEVEL SECURITY;

-- Read: anyone (including anon) — field displays are public.
DROP POLICY IF EXISTS event_settings_read_all ON event_settings;
CREATE POLICY event_settings_read_all ON event_settings
  FOR SELECT
  USING (true);

-- Write: admin only. Profile.is_admin is the source of truth.
DROP POLICY IF EXISTS event_settings_write_admin ON event_settings;
CREATE POLICY event_settings_write_admin ON event_settings
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.is_admin = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.is_admin = true
    )
  );

-- Auto-bump updated_at on every change.
CREATE OR REPLACE FUNCTION event_settings_touch() RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS event_settings_touch_trigger ON event_settings;
CREATE TRIGGER event_settings_touch_trigger
  BEFORE UPDATE ON event_settings
  FOR EACH ROW EXECUTE FUNCTION event_settings_touch();

COMMIT;
