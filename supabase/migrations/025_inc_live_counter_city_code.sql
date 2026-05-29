-- Migration 025 — Add city_code param to inc_live_counter RPC.
-- Migration 024 changed live_match_state PK to (city_code, category).
-- The old RPC filtered only by category, meaning it would update ALL city rows
-- for that category once multiple regional events exist. This migration tightens
-- the WHERE clause to (city_code, category) so only the active region is affected.

BEGIN;

CREATE OR REPLACE FUNCTION inc_live_counter(
  p_category  text,
  p_column    text,
  p_delta     int,
  p_city_code text DEFAULT 'TSH'
) RETURNS live_match_state
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_row live_match_state;
BEGIN
  IF p_column NOT IN ('fouls_red','fouls_white','wins_red','wins_white','round_number') THEN
    RAISE EXCEPTION 'inc_live_counter: column % is not allowed', p_column;
  END IF;
  IF p_category NOT IN ('a','b','c','d') THEN
    RAISE EXCEPTION 'inc_live_counter: category % is not allowed', p_category;
  END IF;

  EXECUTE format(
    'UPDATE live_match_state SET %I = %I + $1 WHERE category = $2 AND city_code = $3 RETURNING *',
    p_column, p_column
  )
  INTO v_row
  USING p_delta, p_category, p_city_code;

  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION inc_live_counter(text, text, int, text) FROM public;
GRANT EXECUTE ON FUNCTION inc_live_counter(text, text, int, text) TO authenticated, service_role;

COMMIT;
