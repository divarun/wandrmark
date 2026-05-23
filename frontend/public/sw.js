const CACHE_VERSION = "v1";
const STATIC_CACHE = `wandrmark-static-${CACHE_VERSION}`;
const RUNTIME_CACHE = `wandrmark-runtime-${CACHE_VERSION}`;

// Cache the app shell on install
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => cache.add("/"))
  );
  self.skipWaiting();
});

// Remove old caches on activate
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k !== STATIC_CACHE && k !== RUNTIME_CACHE)
          .map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Only handle GET requests on our own origin
  if (request.method !== "GET") return;
  if (url.origin !== self.location.origin) return;

  // Next.js immutable static assets — cache forever
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(
      caches.open(STATIC_CACHE).then((cache) =>
        cache.match(request).then((hit) => {
          if (hit) return hit;
          return fetch(request).then((res) => {
            cache.put(request, res.clone());
            return res;
          });
        })
      )
    );
    return;
  }

  // Page navigations — network first, fall back to cached shell
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((res) => {
          caches.open(STATIC_CACHE).then((c) => c.put(request, res.clone()));
          return res;
        })
        .catch(() =>
          caches.open(STATIC_CACHE).then((c) => c.match("/"))
        )
    );
    return;
  }

  // Everything else — network first, runtime cache fallback
  event.respondWith(
    fetch(request)
      .then((res) => {
        if (res.ok) {
          caches.open(RUNTIME_CACHE).then((c) => c.put(request, res.clone()));
        }
        return res;
      })
      .catch(() =>
        caches.open(RUNTIME_CACHE).then((c) => c.match(request))
      )
  );
});
