/* DiemDesk service worker.
 *
 * DESIGN INVARIANT: no cache in this file can serve stale content to an ONLINE
 * user. Documents are network-first (fresh, or nothing). /public assets are
 * stale-while-revalidate (one load behind at worst, self-healing). /_next/static
 * is cache-first, but its URLs ARE content hashes, so a wrong entry cannot exist.
 *
 * ── Rules learned from the July 2026 stale-shell incident. Do not relax them. ──
 *
 * 1. NEVER serve a cached document under a URL other than the one requested.
 *    The old worker ended its navigate branch with `|| caches.match('/')`, so a
 *    single flaky request on /compress-pdf returned the HOME page's HTML —
 *    frozen at install time by addAll(['/']) — referencing chunk hashes the
 *    live deploy no longer served. THAT was the incident.
 *
 * 2. NEVER cache a response unless res.ok. A 404 for a dead chunk hash, or the
 *    502 that nginx returns during the PM2 restart window on every deploy, must
 *    not become the permanent cache entry for that URL.
 *
 * 3. NEVER purge dd-immutable on activate. After a deploy those chunks no longer
 *    exist on the origin; deleting them breaks tabs that are still open on the
 *    previous build (ChunkLoadError). Hash-keyed entries are safe to keep
 *    forever, so retention is free — we only trim by count.
 *
 * 4. BUILD_ID is injected by scripts/gen-sw.mjs. NEVER hand-edit it. The old
 *    worker's `const VERSION = 'v1'` was hand-maintained and commit 8fde731
 *    edited this file without touching it — proof that a hand-maintained
 *    constant is not a mechanism.
 *
 * 5. Any internal error falls through to the network. A bug in this file must
 *    degrade to "no offline", never to "no site".
 *
 * Kill switch: set /sw-kill.json to {"disabled":true} on the server. Every
 * worker wipes its caches and unregisters on its next activate or hourly check.
 * No deploy required. /sw.js and /sw-kill.json are both served no-cache (see
 * next.config.js) and Cloudflare returns BYPASS for them, so this path is real.
 */

const BUILD_ID = '__BUILD_ID__';

const IMMUTABLE = 'dd-immutable'; // deliberately UNVERSIONED — keys are content hashes
const DOCS = 'dd-docs';
const PUBLIC = 'dd-public';
const SHARE = 'dd-share'; // the Android share_target stash — behaviour preserved verbatim
const KEEP = [IMMUTABLE, DOCS, PUBLIC, SHARE];

const DOC_TIMEOUT_MS = 3500;
const MAX_IMMUTABLE = 500;
const MAX_DOCS = 60;
const MAX_PUBLIC = 80;
const KILL_CHECK_MS = 60 * 60 * 1000;

/* Engine assets live at stable (non-hashed) URLs, so they are NEVER cache-first.
 * Allowlisted, not blanket-matched: /models (45MB) and /ort (40MB) would thrash
 * the origin's storage quota and evict everything else, and /og is crawler-only. */
const PUBLIC_PREFIXES = ['/qpdf/', '/libheif/', '/pdfjs/', '/fonts/'];
const PUBLIC_FILES = ['/mozjpeg_enc.wasm', '/pdf.worker.min.mjs', '/bg-worker.js', '/manifest.webmanifest'];

function isPublicAsset(pathname) {
  if (PUBLIC_FILES.indexOf(pathname) !== -1) return true;
  if (/^\/icon-[\w-]+\.png$/.test(pathname)) return true;
  for (const p of PUBLIC_PREFIXES) if (pathname.startsWith(p)) return true;
  return false;
}

// ─────────────────────────────── lifecycle ───────────────────────────────

/* No skipWaiting: a tab open on build N keeps worker N until it closes, so its
 * already-loaded chunks stay reachable. Trading rollout speed for not breaking
 * live tabs is the whole lesson of the incident. */
self.addEventListener('install', () => {
  /* No precache. An install-time addAll() is the same shape of mechanism that
   * pinned the stale shell; it does not come back until the runtime cache has
   * survived a few real deploys. */
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    if (await runKillCheck(true)) return;
    try {
      const keys = await caches.keys();
      // Drops legacy dd-static-v1 / dd-pages-v1 from the old worker. Rule 3:
      // dd-immutable is in KEEP and is never purged here.
      await Promise.all(keys.filter((k) => KEEP.indexOf(k) === -1).map((k) => caches.delete(k)));
    } catch (e) { /* non-fatal */ }
    await self.clients.claim();
  })());
});

// ────────────────────────────── kill switch ──────────────────────────────

let lastKillCheck = 0;

async function runKillCheck(force) {
  const now = Date.now();
  if (!force && now - lastKillCheck < KILL_CHECK_MS) return false;
  lastKillCheck = now;
  try {
    const res = await fetch('/sw-kill.json', { cache: 'no-store' });
    if (!res || !res.ok) return false;
    const cfg = await res.json();
    if (!cfg || cfg.disabled !== true) return false;
    const keys = await caches.keys();
    await Promise.all(keys.map((k) => caches.delete(k)));
    await self.registration.unregister();
    return true;
  } catch (e) {
    return false; // network trouble must never look like a kill signal
  }
}

// ─────────────────────────────── strategies ──────────────────────────────

function withTimeout(promise, ms) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('timeout')), ms);
    promise.then((v) => { clearTimeout(t); resolve(v); }, (e) => { clearTimeout(t); reject(e); });
  });
}

async function trim(name, max) {
  try {
    const cache = await caches.open(name);
    const keys = await cache.keys();
    if (keys.length <= max) return;
    const excess = keys.slice(0, keys.length - max);
    await Promise.all(excess.map((k) => cache.delete(k)));
  } catch (e) { /* non-fatal */ }
}

function store(cacheName, req, res, max) {
  // Rule 2: only ever cache a genuine success.
  if (!res || !res.ok) return;
  const copy = res.clone();
  caches.open(cacheName)
    .then((cache) => cache.put(req, copy))
    .then(() => trim(cacheName, max))
    .catch(() => { /* non-fatal */ });
}

/* /_next/static/** — the URL is a content hash, so a cached entry can never be
 * the "wrong" bytes for that URL. Cache-first is safe here and nowhere else. */
async function immutableFirst(req) {
  try {
    const cache = await caches.open(IMMUTABLE);
    const hit = await cache.match(req);
    if (hit) return hit;
    const res = await fetch(req);
    store(IMMUTABLE, req, res, MAX_IMMUTABLE);
    return res;
  } catch (e) {
    return fetch(req); // rule 5
  }
}

/* Stable-URL engine assets. Serve the cached copy instantly, refresh in the
 * background — so a bad entry is wrong for at most one load, then self-heals. */
async function staleWhileRevalidate(req) {
  try {
    const cache = await caches.open(PUBLIC);
    const hit = await cache.match(req);
    const network = fetch(req).then((res) => { store(PUBLIC, req, res, MAX_PUBLIC); return res; }).catch(() => null);
    if (hit) return hit;
    const res = await network;
    return res || fetch(req);
  } catch (e) {
    return fetch(req); // rule 5
  }
}

/* Documents. Online always gets the network. The cached copy is offline-only and
 * is matched against THE SAME URL — rule 1. There is deliberately no fallback
 * page: a route never visited fails honestly rather than rendering a wrong one. */
async function documentNetworkFirst(req) {
  try {
    const res = await withTimeout(fetch(req), DOC_TIMEOUT_MS);
    store(DOCS, req, res, MAX_DOCS);
    return res;
  } catch (e) {
    try {
      const cache = await caches.open(DOCS);
      const hit = await cache.match(req);
      if (hit) return hit;
    } catch (e2) { /* fall through */ }
    return fetch(req); // fails again → the browser's own offline page
  }
}

// ──────────────────────────────── routing ────────────────────────────────

self.addEventListener('fetch', (event) => {
  const req = event.request;

  // Android "Share to DiemDesk" → manifest share_target POST. Preserved verbatim
  // from the previous worker; must stay ahead of every other branch.
  if (req.method === 'POST') {
    let shareUrl;
    try { shareUrl = new URL(req.url); } catch (e) { return; }
    if (shareUrl.pathname !== '/pdf-viewer') return;
    event.respondWith((async () => {
      try {
        const form = await req.formData();
        const file = form.get('file');
        if (file && file.size) {
          const cache = await caches.open(SHARE);
          await cache.put('/__shared_pdf', new Response(file, {
            headers: {
              'Content-Type': 'application/pdf',
              'X-Name': encodeURIComponent(file.name || 'shared.pdf'),
            },
          }));
        }
      } catch (e) { /* ignore — still open the viewer */ }
      return Response.redirect('/pdf-viewer?shared=1', 303);
    })());
    return;
  }

  if (req.method !== 'GET') return;

  let url;
  try { url = new URL(req.url); } catch (e) { return; }

  if (url.origin !== self.location.origin) return;          // never touch cross-origin
  if (url.pathname.startsWith('/api/')) return;             // never cache the API
  if (url.pathname === '/sw.js' || url.pathname === '/sw-kill.json') return;
  if (url.pathname.startsWith('/models/') || url.pathname.startsWith('/ort/')) return; // 85MB, quota thrash

  event.waitUntil(runKillCheck(false)); // opportunistic; never blocks the response

  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(immutableFirst(req));
    return;
  }

  if (isPublicAsset(url.pathname)) {
    event.respondWith(staleWhileRevalidate(req));
    return;
  }

  if (req.mode === 'navigate') {
    event.respondWith(documentNetworkFirst(req));
    return;
  }

  /* Everything else — notably Next's RSC payloads (?_rsc=) — goes to the network
   * untouched. Caching an RSC payload risks serving it against a different build's
   * HTML, and that skew is the failure class we are trying to eliminate. Offline,
   * a client-side navigation fails and a full reload falls back to dd-docs. */
});

// Referencing BUILD_ID keeps it in the emitted file, which is what makes the
// browser see a byte-difference and install the new worker after a deploy.
self.addEventListener('message', (event) => {
  if (event.data === 'build-id' && event.source) event.source.postMessage(BUILD_ID);
});
