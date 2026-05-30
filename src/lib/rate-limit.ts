// Token-bucket rate limiter with Redis backend (falls back to in-memory when
// REDIS_URL is not set, e.g. in mock/dev mode without Docker).
//
// Redis path: atomic INCR + PEXPIRE via Lua — no race conditions across
// multiple Next.js workers or between restarts.
// In-memory path: same fixed-window logic, single-process only.

import redis from './redis'

// ── Lua script: increment key, set TTL on first touch, return count ──────────
// KEYS[1] = bucket key  ARGV[1] = window_ms
const INCR_SCRIPT = `
local cur = redis.call('INCR', KEYS[1])
if cur == 1 then
  redis.call('PEXPIRE', KEYS[1], ARGV[1])
end
return cur
`

// ── In-memory fallback ───────────────────────────────────────────────────────
type Bucket = { count: number; resetAt: number }
const buckets = new Map<string, Bucket>()
const MAX_BUCKETS = 10_000

function inMemoryIncr(key: string, windowMs: number): number {
  const now = Date.now()
  let bucket = buckets.get(key)
  if (!bucket || bucket.resetAt < now) {
    bucket = { count: 0, resetAt: now + windowMs }
    buckets.set(key, bucket)
  }
  bucket.count += 1

  if (buckets.size > MAX_BUCKETS) {
    const stale: string[] = []
    for (const [k, b] of buckets) {
      if (b.resetAt < now) stale.push(k)
    }
    for (const k of stale) {
      buckets.delete(k)
      if (buckets.size <= MAX_BUCKETS * 0.8) break
    }
    if (buckets.size > MAX_BUCKETS) {
      const oldest = [...buckets.entries()]
        .sort((a, b) => a[1].resetAt - b[1].resetAt)
        .slice(0, Math.floor(MAX_BUCKETS * 0.2))
      for (const [k] of oldest) buckets.delete(k)
    }
  }

  return bucket.count
}

// ── Endpoint limits ──────────────────────────────────────────────────────────
const WINDOW_MS = 60_000

interface EndpointLimit { prefix: string; read: number; write: number }

const ENDPOINT_LIMITS: EndpointLimit[] = [
  { prefix: '/api/auth/login', read: 30,  write: 5  },
  { prefix: '/api/standings',  read: 30,  write: 0  },
  { prefix: '/api/field',      read: 60,  write: 0  },
  { prefix: '/api/event',      read: 60,  write: 10 },
  { prefix: '/api/admin',      read: 60,  write: 30 },
  { prefix: '/api/judges',     read: 180, write: 60 },
  { prefix: '/api/auth',       read: 60,  write: 20 },
]
const DEFAULT_LIMIT: Omit<EndpointLimit, 'prefix'> = { read: 60, write: 20 }

function pickLimit(path: string): Omit<EndpointLimit, 'prefix'> {
  for (const l of ENDPOINT_LIMITS) {
    if (path.startsWith(l.prefix)) return l
  }
  return DEFAULT_LIMIT
}

// ── Public API ───────────────────────────────────────────────────────────────
export interface RateLimitResult {
  ok: boolean
  remaining: number
  resetAt: number
}

export async function rateLimit(
  ip: string,
  method: string,
  path: string = '',
): Promise<RateLimitResult> {
  const isWrite = method !== 'GET' && method !== 'HEAD' && method !== 'OPTIONS'
  const cfg = pickLimit(path)
  const limit = isWrite ? cfg.write : cfg.read
  if (limit === 0) return { ok: true, remaining: 0, resetAt: Date.now() + WINDOW_MS }

  const key = `rl:${ip}:${path.split('/').slice(0, 4).join('/')}:${isWrite ? 'w' : 'r'}`

  let count: number

  if (redis) {
    try {
      count = (await redis.eval(INCR_SCRIPT, 1, key, String(WINDOW_MS))) as number
    } catch {
      // Redis unavailable — degrade gracefully to in-memory
      count = inMemoryIncr(key, WINDOW_MS)
    }
  } else {
    count = inMemoryIncr(key, WINDOW_MS)
  }

  return {
    ok: count <= limit,
    remaining: Math.max(0, limit - count),
    resetAt: Date.now() + WINDOW_MS,
  }
}

export function getClientIp(req: Request): string {
  const xff = req.headers.get('x-forwarded-for')
  if (xff) return xff.split(',')[0].trim()
  const real = req.headers.get('x-real-ip')
  if (real) return real
  return 'unknown'
}
