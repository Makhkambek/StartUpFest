import { describe, expect, it } from 'vitest'
import { fieldPollMs } from '@/lib/field-poll'

// Regression guard: a blanket 4s poll (introduced as a rate-limit mitigation)
// made the live run timer take up to 4s to stop after a judge pressed
// Finish/End on a separate device. The field display must poll fast WHILE a run
// is active (so it reflects the stop promptly) but stay slow when idle to keep
// shared-venue GET load under the /api/field 60-req/min/IP limit.
describe('fieldPollMs', () => {
  it('polls fast during active phases (Supabase mode)', () => {
    expect(fieldPollMs('countdown', true)).toBe(1500)
    expect(fieldPollMs('fighting', true)).toBe(1500)
  })

  it('polls slow when idle / showing a result (Supabase mode)', () => {
    expect(fieldPollMs('idle', true)).toBe(4000)
    expect(fieldPollMs('waiting', true)).toBe(4000)
    expect(fieldPollMs('positioning', true)).toBe(4000)
    expect(fieldPollMs('round_result', true)).toBe(4000)
    expect(fieldPollMs('match_result', true)).toBe(4000)
  })

  it('active polling is strictly faster than idle (the regression guard)', () => {
    expect(fieldPollMs('fighting', true)).toBeLessThan(fieldPollMs('idle', true))
  })

  it('stays under the 60-req/min/IP /api/field limit even when active', () => {
    // 60_000 / interval = requests per minute from one device
    expect(60_000 / fieldPollMs('fighting', true)).toBeLessThanOrEqual(60)
  })

  it('is snappy in mock/dev mode regardless of phase', () => {
    expect(fieldPollMs('idle', false)).toBe(300)
    expect(fieldPollMs('fighting', false)).toBe(300)
  })

  it('treats unknown/undefined phase as idle (safe default)', () => {
    expect(fieldPollMs(undefined, true)).toBe(4000)
    expect(fieldPollMs(null, true)).toBe(4000)
  })
})
