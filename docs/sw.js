// ez-rapp PWA service worker.
//
// Caching strategy:
//   - Same-origin (kody-w.github.io/ez-rapp/*): network-first, fall back
//     to cache. Lets us push shell updates instantly — visitors get the
//     new HTML the next time they open the PWA online, and the cache
//     keeps them functional offline if we ever lose Pages.
//   - localhost:7071/*: never touched. Always network. The brainstem is
//     a live API; caching its responses would lie.
//   - Everything else (CDNs like jsdelivr): pass through to network.
//
// Versioned cache name so a bump invalidates everything cleanly.

const CACHE = "ez-rapp-v1";
const APP_SHELL = [
  "./app.html",
  "./manifest.webmanifest",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(APP_SHELL)).then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // Brainstem API calls — never cached, always live.
  if (url.hostname === "127.0.0.1" || url.hostname === "localhost") return;

  // Cross-origin (CDN) — let the browser handle it.
  if (url.origin !== self.location.origin) return;

  // Same-origin (our shell) — network-first, fall back to cache. Lets
  // shell updates land instantly when the user is online, and lets the
  // PWA keep working when offline (brainstem-not-reachable handling is
  // the page's responsibility, not ours).
  event.respondWith((async () => {
    try {
      const fresh = await fetch(event.request);
      const cache = await caches.open(CACHE);
      cache.put(event.request, fresh.clone());
      return fresh;
    } catch {
      const cached = await caches.match(event.request);
      if (cached) return cached;
      throw new Error("offline + uncached");
    }
  })());
});
