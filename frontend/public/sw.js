/* DiemDesk service worker — DISABLED (kill-switch).
   The previous caching SW could pin browsers to a stale app shell after a deploy
   (old CSS hash -> unstyled page). Until we ship a robust offline strategy, this
   SW clears all caches, unregisters itself, and reloads open tabs so the browser
   always loads fresh from the network. No fetch handler = every request hits the
   network directly. */
self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    try {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
      await self.registration.unregister();
      const clients = await self.clients.matchAll({ type: 'window' });
      clients.forEach((c) => { try { c.navigate(c.url); } catch (e) { /* ignore */ } });
    } catch (e) {
      /* ignore */
    }
  })());
});
