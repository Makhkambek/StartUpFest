// In-memory token bucket rate limiter.
// Limits chosen for the live-scoring workload:
//   • A judge dashboard polls 4 endpoints (live, teams, schedule, matches)
//     at ~3–5s intervals, plus realtime fallback → ~80 GET/min steady-state.
//   • Goal/foul buttons during a match can fire ~20–30 POSTs/min legitimately
//     (judges add fouls + goals + phase transitions on a hot ring).
// Higher numbers give breathing room without weakening DDoS protection too
// much (one IP still capped). For real DDoS protection on Vercel, swap to
// Upstash Redis via @upstash/ratelimit.

type Bucket = { count: number; resetAt: number }

const buckets = new Map<string, Bucket>()
const WINDOW_MS = 60_000          // 1 minute
const READ_LIMIT = 180            // was 60 — too tight under multi-panel judge UI polling
const WRITE_LIMIT = 60            // was 20 — judges hitting Goal button repeatedly during a match
const MAX_BUCKETS = 10_000        // cap memory; oldest evicted when exceeded

export interface RateLimitResult {
  ok: boolean
  remaining: number
  resetAt: number
}

export function rateLimit(ip: string, method: string): RateLimitResult {
  const isWrite = method !== 'GET' && method !== 'HEAD' && method !== 'OPTIONS'
  const limit = isWrite ? WRITE_LIMIT : READ_LIMIT
  const key = `${ip}:${isWrite ? 'w' : 'r'}`
  const now = Date.now()

  let bucket = buckets.get(key)
  if (!bucket || bucket.resetAt < now) {
    bucket = { count: 0, resetAt: now + WINDOW_MS }
    buckets.set(key, bucket)
  }

  bucket.count += 1

  // Evict stale entries when map grows too large. Collect keys first so we
  // don't mutate the Map mid-iteration (single-threaded JS makes this fine,
  // but it's still clearer + correct under unexpected re-entry).
  if (buckets.size > MAX_BUCKETS) {
    const stale: string[] = []
    for (const [k, b] of buckets) {
      if (b.resetAt < now) stale.push(k)
    }
    for (const k of stale) {
      buckets.delete(k)
      if (buckets.size <= MAX_BUCKETS * 0.8) break
    }
    // If everything is still hot (no stale entries), evict the oldest 20% by
    // resetAt so we don't grow unbounded under a determined floood.
    if (buckets.size > MAX_BUCKETS) {
      const oldest = [...buckets.entries()]
        .sort((a, b) => a[1].resetAt - b[1].resetAt)
        .slice(0, Math.floor(MAX_BUCKETS * 0.2))
      for (const [k] of oldest) buckets.delete(k)
    }
  }

  return {
    ok: bucket.count <= limit,
    remaining: Math.max(0, limit - bucket.count),
    resetAt: bucket.resetAt,
  }
}

export function getClientIp(req: Request): string {
  // Vercel forwards real client IP in x-forwarded-for (first hop)
  const xff = req.headers.get('x-forwarded-for')
  if (xff) return xff.split(',')[0].trim()
  const real = req.headers.get('x-real-ip')
  if (real) return real
  return 'unknown'
}
