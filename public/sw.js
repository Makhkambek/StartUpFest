// SFRC judges service worker — basic offline support.
// Authenticated pages (/judges/dashboard, /judges/[a-d]/...) are intentionally
// NOT cached. After logout, an offline user must end up on /judges/login,
// not a stale dashboard from a previous session.
const CACHE_NAME = 'sfrc-v2'
const ASSETS = ['/judges/login', '/manifest.webmanifest']

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS).catch(() => null))
  )
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  )
  self.clients.claim()
})

function isAuthenticatedJudgePath(pathname) {
  // Only /judges/login is safe to cache; everything else under /judges/* is
  // session-gated and must hit the network for fresh auth checks.
  return pathname.startsWith('/judges/') && pathname !== '/judges/login'
}

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url)

  // Never intercept API or non-GET — those must always be live.
  if (url.pathname.startsWith('/api/') || event.request.method !== 'GET') return

  // HTML page navigation
  if (event.request.mode === 'navigate') {
    // Authenticated pages: pure network, no caching, fallback to /judges/login.
    if (isAuthenticatedJudgePath(url.pathname)) {
      event.respondWith(
        fetch(event.request).catch(() => caches.match('/judges/login'))
      )
      return
    }
    // Public pages: network-first, cache fallback.
    event.respondWith(
      fetch(event.request)
        .then((res) => {
          const copy = res.clone()
          caches.open(CACHE_NAME).then((c) => c.put(event.request, copy))
          return res
        })
        .catch(() => caches.match(event.request).then((r) => r || caches.match('/judges/login')))
    )
    return
  }

  // Cache-first for static assets.
  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request))
  )
})
