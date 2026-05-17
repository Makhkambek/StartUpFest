-- Migration 010 — Enable RLS with public-read / auth-write policies
-- Safe to run multiple times: IF EXISTS guards + DROP/CREATE pattern.
-- service_role bypasses RLS automatically, so server-side API code keeps working.

BEGIN;

-- ── teams ─────────────────────────────────────────────
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "teams_public_read" ON teams;
DROP POLICY IF EXISTS "teams_auth_write"  ON teams;
CREATE POLICY "teams_public_read" ON teams FOR SELECT USING (true);
CREATE POLICY "teams_auth_write"  ON teams FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ── scheduled_matches ─────────────────────────────────
ALTER TABLE scheduled_matches ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "scheduled_matches_public_read" ON scheduled_matches;
DROP POLICY IF EXISTS "scheduled_matches_auth_write"  ON scheduled_matches;
CREATE POLICY "scheduled_matches_public_read" ON scheduled_matches FOR SELECT USING (true);
CREATE POLICY "scheduled_matches_auth_write"  ON scheduled_matches FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ── results_a ─────────────────────────────────────────
ALTER TABLE results_a ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "results_a_public_read" ON results_a;
DROP POLICY IF EXISTS "results_a_auth_write"  ON results_a;
CREATE POLICY "results_a_public_read" ON results_a FOR SELECT USING (true);
CREATE POLICY "results_a_auth_write"  ON results_a FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ── matches_b ─────────────────────────────────────────
ALTER TABLE matches_b ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "matches_b_public_read" ON matches_b;
DROP POLICY IF EXISTS "matches_b_auth_write"  ON matches_b;
CREATE POLICY "matches_b_public_read" ON matches_b FOR SELECT USING (true);
CREATE POLICY "matches_b_auth_write"  ON matches_b FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ── fights_c ──────────────────────────────────────────
ALTER TABLE fights_c ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "fights_c_public_read" ON fights_c;
DROP POLICY IF EXISTS "fights_c_auth_write"  ON fights_c;
CREATE POLICY "fights_c_public_read" ON fights_c FOR SELECT USING (true);
CREATE POLICY "fights_c_auth_write"  ON fights_c FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ── matches_d ─────────────────────────────────────────
ALTER TABLE matches_d ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "matches_d_public_read" ON matches_d;
DROP POLICY IF EXISTS "matches_d_auth_write"  ON matches_d;
CREATE POLICY "matches_d_public_read" ON matches_d FOR SELECT USING (true);
CREATE POLICY "matches_d_auth_write"  ON matches_d FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ── profiles ─ (sensitive: only own row visible to non-admins) ─
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "profiles_self_read" ON profiles;
DROP POLICY IF EXISTS "profiles_self_write" ON profiles;
CREATE POLICY "profiles_self_read"  ON profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "profiles_self_write" ON profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- ── judge_categories ──────────────────────────────────
ALTER TABLE judge_categories ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "judge_categories_self_read" ON judge_categories;
CREATE POLICY "judge_categories_self_read" ON judge_categories FOR SELECT TO authenticated USING (auth.uid() = judge_id);

COMMIT;
