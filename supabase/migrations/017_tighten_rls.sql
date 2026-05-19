-- Migration 017 — Tighten RLS write policies.
--
-- Replaces the broad `USING (true) WITH CHECK (true)` policies from migrations
-- 010 and 012 with auth-aware policies:
--   - teams, scheduled_matches: admin-only write (organizers manage these)
--   - scheduled_matches UPDATE: admin OR judge of that row's category (for status changes)
--   - results_a, matches_b, fights_c, matches_d: admin OR judge of that table's category
--   - live_match_state: admin OR judge of that row's category (PK)
--
-- service_role bypasses RLS automatically, so any future API route that promotes
-- itself to admin keeps working.

BEGIN;

-- ── teams ─────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "teams_auth_write"           ON teams;
DROP POLICY IF EXISTS "teams_admin_write"          ON teams;
CREATE POLICY "teams_admin_write" ON teams
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
  );

-- ── scheduled_matches ────────────────────────────────────────────────
DROP POLICY IF EXISTS "scheduled_matches_auth_write"           ON scheduled_matches;
DROP POLICY IF EXISTS "scheduled_matches_admin_insert"         ON scheduled_matches;
DROP POLICY IF EXISTS "scheduled_matches_admin_or_judge_update" ON scheduled_matches;
DROP POLICY IF EXISTS "scheduled_matches_admin_delete"         ON scheduled_matches;
CREATE POLICY "scheduled_matches_admin_insert" ON scheduled_matches
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
  );
CREATE POLICY "scheduled_matches_admin_or_judge_update" ON scheduled_matches
  FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
    OR EXISTS (SELECT 1 FROM judge_categories WHERE judge_id = auth.uid() AND category = scheduled_matches.category)
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
    OR EXISTS (SELECT 1 FROM judge_categories WHERE judge_id = auth.uid() AND category = scheduled_matches.category)
  );
CREATE POLICY "scheduled_matches_admin_delete" ON scheduled_matches
  FOR DELETE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
  );

-- ── results_a ────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "results_a_auth_write"  ON results_a;
DROP POLICY IF EXISTS "results_a_judge_write" ON results_a;
CREATE POLICY "results_a_judge_write" ON results_a
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
    OR EXISTS (SELECT 1 FROM judge_categories WHERE judge_id = auth.uid() AND category = 'a')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
    OR EXISTS (SELECT 1 FROM judge_categories WHERE judge_id = auth.uid() AND category = 'a')
  );

-- ── matches_b ────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "matches_b_auth_write"  ON matches_b;
DROP POLICY IF EXISTS "matches_b_judge_write" ON matches_b;
CREATE POLICY "matches_b_judge_write" ON matches_b
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
    OR EXISTS (SELECT 1 FROM judge_categories WHERE judge_id = auth.uid() AND category = 'b')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
    OR EXISTS (SELECT 1 FROM judge_categories WHERE judge_id = auth.uid() AND category = 'b')
  );

-- ── fights_c ─────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "fights_c_auth_write"  ON fights_c;
DROP POLICY IF EXISTS "fights_c_judge_write" ON fights_c;
CREATE POLICY "fights_c_judge_write" ON fights_c
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
    OR EXISTS (SELECT 1 FROM judge_categories WHERE judge_id = auth.uid() AND category = 'c')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
    OR EXISTS (SELECT 1 FROM judge_categories WHERE judge_id = auth.uid() AND category = 'c')
  );

-- ── matches_d ────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "matches_d_auth_write"  ON matches_d;
DROP POLICY IF EXISTS "matches_d_judge_write" ON matches_d;
CREATE POLICY "matches_d_judge_write" ON matches_d
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
    OR EXISTS (SELECT 1 FROM judge_categories WHERE judge_id = auth.uid() AND category = 'd')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
    OR EXISTS (SELECT 1 FROM judge_categories WHERE judge_id = auth.uid() AND category = 'd')
  );

-- ── live_match_state ─────────────────────────────────────────────────
DROP POLICY IF EXISTS "live_match_state_auth_write"  ON live_match_state;
DROP POLICY IF EXISTS "live_match_state_judge_write" ON live_match_state;
CREATE POLICY "live_match_state_judge_write" ON live_match_state
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
    OR EXISTS (SELECT 1 FROM judge_categories WHERE judge_id = auth.uid() AND category = live_match_state.category)
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
    OR EXISTS (SELECT 1 FROM judge_categories WHERE judge_id = auth.uid() AND category = live_match_state.category)
  );

COMMIT;
