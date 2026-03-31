const CACHE_NAME = 'inomaka-v1'
const STATIC_ASSETS = [
  '/',
  '/login',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
]

// Install — cache static assets
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  )
  self.skipWaiting()
})

// Activate — clean old caches
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  )
  self.clients.claim()
})

// Fetch — network first, fallback to cache
self.addEventListener('fetch', (e) => {
  const { request } = e

  // Skip non-GET and API requests
  if (request.method !== 'GET' || request.url.includes('/api/')) return

  e.respondWith(
    fetch(request)
      .then((res) => {
        // Cache successful responses
        if (res.ok) {
          const clone = res.clone()
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone))
        }
        return res
      })
      .catch(() => caches.match(request))
  )
})
