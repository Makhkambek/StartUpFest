-- Add 'round_robin' to the allowed values for the round column in scheduled_matches.
-- Used for Cat D (Robo Football) finals: 3-alliance round-robin format.

ALTER TABLE scheduled_matches
  DROP CONSTRAINT IF EXISTS scheduled_matches_round_check;

ALTER TABLE scheduled_matches
  ADD CONSTRAINT scheduled_matches_round_check
  CHECK (round IS NULL OR round IN (
    'group', 'r1', 'r2', 'quarter', 'semi',
    'third_place', 'final', 'triangle', 'round_robin'
  ));
