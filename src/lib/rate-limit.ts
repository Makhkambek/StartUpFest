// In-memory token bucket rate limiter.
// Per-endpoint limits chosen for the live-scoring workload:
//   • Public scoreboard (/api/standings, /api/field) is hammered by spectators
//     and field displays — tight read limit so a flood can't pin the Node loop
//     even with unstable_cache absorbing the DB hit.
//   • Judge UI polls 4 endpoints at ~3–5s intervals plus realtime fallback,
//     and the Goal/foul button can fire ~20–30 POSTs/min on a hot ring.
//   • /api/auth/login is brute-force-prone; the route itself adds a 10/15min
//     wall, this is an additional per-minute trip-wire.
// For real DDoS protection at the edge, put Cloudflare in front and swap this
// for Upstash Redis via @upstash/ratelimit.

type Bucket = { count: number; resetAt: number }

const buckets = new Map<string, Bucket>()
const WINDOW_MS = 60_000          // 1 minute
const MAX_BUCKETS = 10_000        // cap memory; oldest evicted when exceeded

interface EndpointLimit {
  prefix: string
  read: number
  write: number
}

// Order matters: first matching prefix wins. Put longer/more-specific paths first.
const ENDPOINT_LIMITS: EndpointLimit[] = [
  { prefix: '/api/auth/login', read: 30,  write: 5   },
  { prefix: '/api/standings',  read: 30,  write: 0   },
  { prefix: '/api/field',      read: 60,  write: 0   },
  { prefix: '/api/event',      read: 60,  write: 10  },
  { prefix: '/api/admin',      read: 60,  write: 30  },
  { prefix: '/api/judges',     read: 180, write: 60  },
  { prefix: '/api/auth',       read: 60,  write: 20  },
]
const DEFAULT_LIMIT: Omit<EndpointLimit, 'prefix'> = { read: 60, write: 20 }

function pickLimit(path: string): Omit<EndpointLimit, 'prefix'> {
  for (const l of ENDPOINT_LIMITS) {
    if (path.startsWith(l.prefix)) return { read: l.read, write: l.write }
  }
  return DEFAULT_LIMIT
}

export interface RateLimitResult {
  ok: boolean
  remaining: number
  resetAt: number
}

export function rateLimit(ip: string, method: string, path: string = ''): RateLimitResult {
  const isWrite = method !== 'GET' && method !== 'HEAD' && method !== 'OPTIONS'
  const cfg = pickLimit(path)
  const limit = isWrite ? cfg.write : cfg.read
  // A zero limit means "method not allowed for this path under rate limiting" —
  // we still let it through (route handler will 405) but track the bucket so
  // a flood of disallowed methods can't be used to probe the limiter for free.
  if (limit === 0) {
    return { ok: true, remaining: 0, resetAt: Date.now() + WINDOW_MS }
  }
  const key = `${ip}:${path.split('/').slice(0, 4).join('/')}:${isWrite ? 'w' : 'r'}`
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
