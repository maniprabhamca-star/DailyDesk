/* DiemDesk service worker — MINIMAL, no-cache.
   Its ONLY job is to receive a PDF shared to the site (Android "Share to
   DiemDesk" → the manifest share_target POST). It caches NOTHING about the app
   shell, so it cannot pin a stale page after a deploy — the bug that made us
   disable the old caching SW. Every request except the share POST falls straight
   through to the network. Delete this file's body back to a no-op to disable. */
const SHARE_CACHE = 'dd-share';

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    // Purge any leftover caches from the OLD caching SW; keep only the share stash.
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k !== SHARE_CACHE).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'POST') return; // let ALL normal traffic hit the network
  let url;
  try { url = new URL(req.url); } catch (e) { return; }
  if (url.pathname !== '/pdf-viewer') return; // only the share_target action
  event.respondWith((async () => {
    try {
      const form = await req.formData();
      const file = form.get('file');
      if (file && file.size) {
        const cache = await caches.open(SHARE_CACHE);
        await cache.put('/__shared_pdf', new Response(file, {
          headers: { 'Content-Type': 'application/pdf', 'X-Name': encodeURIComponent(file.name || 'shared.pdf') },
        }));
      }
    } catch (e) { /* ignore — still open the viewer */ }
    return Response.redirect('/pdf-viewer?shared=1', 303);
  })());
});
