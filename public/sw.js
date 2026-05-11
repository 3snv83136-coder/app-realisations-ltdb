const CACHE = 'ltdb-v1'
const STATIC = ['/', '/manifest.json']

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(STATIC).catch(() => {}))
  )
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  )
  self.clients.claim()
})

self.addEventListener('fetch', (event) => {
  // Ne pas intercepter les API calls Supabase / DeepSeek — réseau uniquement
  if (
    event.request.url.includes('/api/') ||
    event.request.url.includes('supabase.co') ||
    event.request.url.includes('deepseek.com')
  ) {
    return
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      return (
        cached ||
        fetch(event.request)
          .then((res) => {
            if (res.ok && event.request.method === 'GET') {
              const clone = res.clone()
              caches.open(CACHE).then((cache) => {
                cache.put(event.request, clone)
              })
            }
            return res
          })
          .catch(() => cached || new Response('Hors ligne', { status: 503 }))
      )
    })
  )
})
