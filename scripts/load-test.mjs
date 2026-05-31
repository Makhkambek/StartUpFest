/**
 * Load test: simulates tournament-day traffic on robotics.startupfest.uz
 *
 * Simulates:
 *   - 8 judges polling /api/judges/[cat]/live every 1.5s
 *   - 4 field displays polling /api/field/[cat]/state every 4s
 *   - 30 viewers polling standings + public pages every 15s
 *
 * Usage:
 *   node scripts/load-test.mjs [baseUrl] [durationSec]
 *   node scripts/load-test.mjs https://robotics.startupfest.uz 60
 *   node scripts/load-test.mjs http://localhost:3000 30
 */

const BASE = process.argv[2] ?? 'https://robotics.startupfest.uz'
const DURATION_MS = (parseInt(process.argv[3] ?? '60') * 1000)

const stats = {
  total: 0,
  ok: 0,
  errors: 0,
  auth401: 0,        // 401 = expected for protected endpoints (no cookie in test)
  slow: 0,           // > 1000ms
  timings: [],
  byEndpoint: {},
}

function record(endpoint, ms, ok, is401) {
  stats.total++
  if (ok) stats.ok++
  else if (is401) stats.auth401++
  else stats.errors++
  if (ms > 1000) stats.slow++
  stats.timings.push(ms)
  if (!stats.byEndpoint[endpoint]) stats.byEndpoint[endpoint] = { count: 0, errors: 0, auth401: 0, totalMs: 0, maxMs: 0 }
  const e = stats.byEndpoint[endpoint]
  e.count++
  if (is401) e.auth401++
  else if (!ok) e.errors++
  e.totalMs += ms
  if (ms > e.maxMs) e.maxMs = ms
}

async function hit(path) {
  const url = BASE + path
  const t = Date.now()
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) })
    const ms = Date.now() - t
    const ok = res.ok || res.status === 307 || res.status === 302
    record(path, ms, ok, res.status === 401)
    return ms
  } catch (e) {
    const ms = Date.now() - t
    record(path, ms, false, false)
    return ms
  }
}

function poll(paths, intervalMs, label) {
  let i = 0
  const id = setInterval(async () => {
    const path = Array.isArray(paths) ? paths[i++ % paths.length] : paths
    await hit(path)
  }, intervalMs)
  return id
}

function percentile(arr, p) {
  if (!arr.length) return 0
  const sorted = [...arr].sort((a, b) => a - b)
  return sorted[Math.floor(sorted.length * p / 100)]
}

console.log(`\n🚀 Load test → ${BASE}`)
console.log(`⏱  Duration: ${DURATION_MS / 1000}s\n`)

// ── JUDGES (8 judges, polling live state every 1.5s) ─────────────────────────
// 2 judges per category
const judgeIntervals = []
const cats = ['a', 'b', 'c', 'd']
for (const cat of cats) {
  judgeIntervals.push(poll(`/api/judges/${cat}/live`, 1500, `judge-${cat}-1`))
  judgeIntervals.push(poll(`/api/judges/${cat}/live`, 1500, `judge-${cat}-2`))
}

// ── FIELD DISPLAYS (4 field displays, polling every 4s) ──────────────────────
const fieldIntervals = cats.map(cat =>
  poll(`/api/field/${cat}/state`, 4000, `field-${cat}`)
)

// ── VIEWERS (30 people on /display or standings pages) ───────────────────────
const viewerEndpoints = [
  '/display',
  '/ru/a', '/ru/b', '/ru/c', '/ru/d',
  '/api/standings/a', '/api/standings/b', '/api/standings/c', '/api/standings/d',
  '/api/judges/schedule?category=a',
]

const viewerIntervals = []
for (let i = 0; i < 30; i++) {
  // Each viewer polls a random endpoint every 15s, staggered start
  const delay = Math.floor(Math.random() * 5000)
  setTimeout(() => {
    const path = viewerEndpoints[i % viewerEndpoints.length]
    viewerIntervals.push(poll(path, 15000, `viewer-${i}`))
  }, delay)
}

// ── PROGRESS ─────────────────────────────────────────────────────────────────
const startTime = Date.now()
const progressId = setInterval(() => {
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(0)
  const rps = (stats.total / (elapsed || 1)).toFixed(1)
  process.stdout.write(`\r  ⏳ ${elapsed}s | ${stats.total} reqs | ${rps} req/s | ✅ ${stats.ok} ❌ ${stats.errors} 🐢 ${stats.slow}   `)
}, 500)

// ── STOP ──────────────────────────────────────────────────────────────────────
setTimeout(() => {
  ;[...judgeIntervals, ...fieldIntervals, ...viewerIntervals, progressId].forEach(clearInterval)

  const p50 = percentile(stats.timings, 50)
  const p95 = percentile(stats.timings, 95)
  const p99 = percentile(stats.timings, 99)
  const avgMs = stats.timings.length
    ? Math.round(stats.timings.reduce((a, b) => a + b, 0) / stats.timings.length)
    : 0
  const elapsed = (DURATION_MS / 1000).toFixed(0)
  const rps = (stats.total / elapsed).toFixed(1)
  const publicTotal = stats.total - stats.auth401
  const errorRate = publicTotal ? ((stats.errors / publicTotal) * 100).toFixed(1) : '0'

  console.log('\n\n── RESULTS ──────────────────────────────────────────')
  console.log(`  Duration:    ${elapsed}s`)
  console.log(`  Total reqs:  ${stats.total}`)
  console.log(`  Req/sec:     ${rps}`)
  console.log(`  Success:     ${stats.ok}`)
  console.log(`  Auth (401):  ${stats.auth401}  ← expected, judges need browser session`)
  console.log(`  Real errors: ${stats.errors} (${errorRate}% of public reqs)`)
  console.log(`  Slow >1s:    ${stats.slow}`)
  console.log(`\n  Latency:`)
  console.log(`    avg  ${avgMs}ms`)
  console.log(`    p50  ${p50}ms`)
  console.log(`    p95  ${p95}ms`)
  console.log(`    p99  ${p99}ms`)

  console.log('\n── BY ENDPOINT ──────────────────────────────────────')
  const rows = Object.entries(stats.byEndpoint)
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 15)
  for (const [path, e] of rows) {
    const avg = Math.round(e.totalMs / e.count)
    const allAuth = e.auth401 === e.count
    const errPct = ((e.errors / e.count) * 100).toFixed(0)
    const status = allAuth ? '🔒' : e.errors > 0 ? '❌' : avg > 800 ? '🐢' : '✅'
    const note = allAuth ? '  (401 — auth required)' : ''
    console.log(`  ${status} ${path.padEnd(42)} ${String(e.count).padStart(4)} reqs  avg ${String(avg).padStart(4)}ms  max ${String(e.maxMs).padStart(4)}ms  err ${errPct}%${note}`)
  }

  console.log('\n── VERDICT ──────────────────────────────────────────')
  if (parseFloat(errorRate) > 5) {
    console.log('  ❌ REAL ERROR RATE HIGH — сервер не справляется')
  } else if (p95 > 2000) {
    console.log('  ⚠️  P95 > 2s — медленно, зрители будут ждать')
  } else if (p95 > 1000) {
    console.log('  ⚠️  P95 > 1s — приемлемо, но есть просадки')
  } else {
    console.log('  ✅ Сервер справляется с нагрузкой')
  }

  process.exit(0)
}, DURATION_MS)
