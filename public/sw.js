// SFRC judges service worker — basic offline support
const CACHE_NAME = 'sfrc-v1'
const ASSETS = ['/judges/dashboard', '/judges/login', '/manifest.webmanifest']

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

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url)

  // Never intercept API or POST/PATCH/DELETE — those must be live
  if (url.pathname.startsWith('/api/') || event.request.method !== 'GET') return

  // Network-first for HTML pages, cache fallback
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((res) => {
          const copy = res.clone()
          caches.open(CACHE_NAME).then((c) => c.put(event.request, copy))
          return res
        })
        .catch(() => caches.match(event.request).then((r) => r || caches.match('/judges/dashboard')))
    )
    return
  }

  // Cache-first for assets
  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request))
  )
})
