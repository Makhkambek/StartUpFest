-- Migration 018 — Atomic counter increments on live_match_state.
--
-- Previously every live POST did SELECT → compute patch → UPDATE, which races
-- under concurrent requests (two simultaneous "foul" submissions could both
-- read fouls_red=0 and both write fouls_red=1, losing one event).
--
-- This RPC performs `UPDATE ... SET <col> = <col> + delta WHERE category = ?`
-- in a single statement, eliminating the race.

BEGIN;

CREATE OR REPLACE FUNCTION inc_live_counter(
  p_category text,
  p_column   text,
  p_delta    int
) RETURNS live_match_state
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_row live_match_state;
BEGIN
  -- Hard-coded column whitelist — never interpolate caller input without it.
  IF p_column NOT IN ('fouls_red','fouls_white','wins_red','wins_white','round_number') THEN
    RAISE EXCEPTION 'inc_live_counter: column % is not allowed', p_column;
  END IF;
  IF p_category NOT IN ('a','b','c','d') THEN
    RAISE EXCEPTION 'inc_live_counter: category % is not allowed', p_category;
  END IF;

  EXECUTE format(
    'UPDATE live_match_state SET %I = %I + $1 WHERE category = $2 RETURNING *',
    p_column, p_column
  )
  INTO v_row
  USING p_delta, p_category;

  RETURN v_row;
END;
$$;

-- Allow authenticated callers to invoke; RLS on live_match_state still applies
-- to the underlying UPDATE.
REVOKE ALL ON FUNCTION inc_live_counter(text, text, int) FROM public;
GRANT EXECUTE ON FUNCTION inc_live_counter(text, text, int) TO authenticated, service_role;

COMMIT;
