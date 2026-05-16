// In-memory token bucket rate limiter.
// Limits: 60 req/min for GET, 20 req/min for POST/PATCH/DELETE per IP.
// Note: in-memory means each serverless instance has its own counters.
// For real DDoS protection on Vercel, swap to Upstash Redis via @upstash/ratelimit.

type Bucket = { count: number; resetAt: number }

const buckets = new Map<string, Bucket>()
const WINDOW_MS = 60_000          // 1 minute
const READ_LIMIT = 60
const WRITE_LIMIT = 20
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

  // Evict stale entries when map grows too large
  if (buckets.size > MAX_BUCKETS) {
    for (const [k, b] of buckets) {
      if (b.resetAt < now) buckets.delete(k)
      if (buckets.size <= MAX_BUCKETS * 0.8) break
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
