// Polling cadence for the public field displays (`/field/[cat]`).
//
// Supabase Realtime is the primary signal, but it can be flaky on a constrained
// venue network — so polling is the safety net. A blanket 4s poll keeps idle
// GET load low, but it also means a live run timer takes up to 4s to STOP after
// a judge presses Finish/End on a separate device. So poll fast WHILE a run is
// active (countdown/fighting) and slow otherwise. 1500ms = 40 req/min, under the
// /api/field 60-req/min/IP cap with headroom for realtime-triggered refetches.

const ACTIVE_PHASES = new Set(['countdown', 'fighting'])

export function fieldPollMs(phase: string | null | undefined, hasSupabase: boolean): number {
  if (!hasSupabase) return 300 // mock/dev: snappy, no rate limit
  return phase && ACTIVE_PHASES.has(phase) ? 1500 : 4000
}
