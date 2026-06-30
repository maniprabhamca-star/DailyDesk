/* DailyDesk service worker — conservative, offline-capable.
   - Online navigations always hit the network FIRST (no stale content while online),
     caching each page for offline fallback.
   - Immutable static assets (_next/static, fonts, images, wasm) are cache-first.
   - Offline: navigations fall back to the cached page, then the cached home shell.
   Bump VERSION to invalidate old caches on the next visit. */
const VERSION = 'v1';
const STATIC = `dd-static-${VERSION}`;
const PAGES = `dd-pages-${VERSION}`;
const APP_SHELL = ['/'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(PAGES).then((c) => c.addAll(APP_SHELL)).catch(() => {}).then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => !k.endsWith(VERSION)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  const isStatic = url.pathname.startsWith('/_next/static/') ||
    /\.(?:js|css|woff2?|ttf|png|svg|jpg|jpeg|webp|gif|ico|wasm)$/.test(url.pathname);

  if (isStatic) {
    event.respondWith(
      caches.match(req).then((hit) => hit || fetch(req).then((res) => {
        const copy = res.clone();
        caches.open(STATIC).then((c) => c.put(req, copy));
        return res;
      })),
    );
    return;
  }

  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(PAGES).then((c) => c.put(req, copy));
          return res;
        })
        .catch(() => caches.match(req).then((hit) => hit || caches.match('/'))),
    );
    return;
  }

  event.respondWith(fetch(req).catch(() => caches.match(req)));
});
