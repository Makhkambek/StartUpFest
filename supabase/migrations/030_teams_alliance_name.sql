-- Optional custom alliance name for Cat D finals.
-- Set by judge for the alliance captain; shown in finals schedule and bracket.
ALTER TABLE teams ADD COLUMN IF NOT EXISTS alliance_name VARCHAR(100);
