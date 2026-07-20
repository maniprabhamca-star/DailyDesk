/* Harness for DiemDesk's service worker. Mocks Cache/caches/fetch and drives the
 * real sw.js through the failure modes that caused the July 2026 incident. */
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const SW = new URL('../public/sw.js', import.meta.url);

// ── minimal Cache Storage mock ────────────────────────────────────────────
const keyOf = (r) => (typeof r === 'string' ? r : r.url);

class MockCache {
  constructor() { this.map = new Map(); }
  async match(req) { return this.map.get(keyOf(req)) || undefined; }
  async put(req, res) { this.map.set(keyOf(req), res); }
  async delete(req) { return this.map.delete(keyOf(req)); }
  async keys() { return [...this.map.keys()].map((u) => ({ url: u })); }
}

class MockCaches {
  constructor() { this.stores = new Map(); }
  async open(n) { if (!this.stores.has(n)) this.stores.set(n, new MockCache()); return this.stores.get(n); }
  async keys() { return [...this.stores.keys()]; }
  async delete(n) { return this.stores.delete(n); }
}

class MockResponse {
  constructor(body, { status = 200, url = '' } = {}) {
    this.body = body; this.status = status; this.ok = status >= 200 && status < 300; this.url = url;
  }
  clone() { return new MockResponse(this.body, { status: this.status, url: this.url }); }
  async json() { return JSON.parse(this.body); }
}

const ORIGIN = 'https://diemdesk.com';
const req = (path, { mode = "no-cors", method = "GET" } = {}) => ({ url: ORIGIN + path, mode, method });

// ── scenario runner ───────────────────────────────────────────────────────
function makeSW({ net }) {
  const listeners = {};
  const caches = new MockCaches();
  const sandbox = {
    caches, Response: MockResponse, URL, setTimeout, clearTimeout, Date, Promise, console,
    fetch: async (r) => net(typeof r === 'string' ? r : r.url),
    self: {
      location: { origin: ORIGIN },
      addEventListener: (t, fn) => { (listeners[t] ||= []).push(fn); },
      clients: { claim: async () => {} },
      registration: { unregister: async () => { sandbox.__unregistered = true; } },
    },
  };
  sandbox.self.registration.unregister = async () => { sandbox.__unregistered = true; };
  vm.createContext(sandbox);
  vm.runInContext(readFileSync(SW, 'utf8'), sandbox);

  const fire = async (type, request) => {
    let responded, waited = [];
    const ev = {
      request,
      respondWith: (p) => { responded = p; },
      waitUntil: (p) => { waited.push(p); },
    };
    for (const fn of listeners[type] || []) fn(ev);
    await Promise.allSettled(waited);
    return responded ? await responded : null;
  };
  return { fire, caches, sandbox };
}

let pass = 0, fail = 0;
const check = (name, cond, extra = '') => {
  if (cond) { pass++; console.log(`  PASS  ${name}`); }
  else { fail++; console.log(`  FAIL  ${name} ${extra}`); }
};

// ─────────────────────────────────────────────────────────────────────────
console.log('\n1. RULE 1 — a cached document is NEVER served under another URL');
{
  // /  is cached; /compress-pdf was never visited; network is down.
  const sw = makeSW({ net: async () => { throw new Error('offline'); } });
  const docs = await sw.caches.open('dd-docs');
  await docs.put(ORIGIN + '/', new MockResponse('HOME PAGE', { url: ORIGIN + '/' }));

  let threw = false, body = null;
  try {
    const res = await sw.fire('fetch', req('/compress-pdf', { mode: 'navigate' }));
    body = res && res.body;
  } catch (e) { threw = true; }
  check('offline miss does NOT return the home shell', body !== 'HOME PAGE', `got: ${body}`);
  check('it fails honestly instead', threw || body === null, `threw=${threw} body=${body}`);
}

console.log('\n2. RULE 2 — a 502 from the deploy window is never cached');
{
  const sw = makeSW({ net: async (u) => new MockResponse('BAD GATEWAY', { status: 502, url: u }) });
  await sw.fire('fetch', req('/compress-pdf', { mode: 'navigate' }));
  const docs = await sw.caches.open('dd-docs');
  const stored = await docs.match(ORIGIN + '/compress-pdf');
  check('502 not written to dd-docs', stored === undefined, `stored: ${stored && stored.body}`);
}

console.log('\n3. RULE 2 — a 404 for a dead chunk hash is never cached');
{
  const sw = makeSW({ net: async (u) => new MockResponse('NOT FOUND', { status: 404, url: u }) });
  await sw.fire('fetch', req('/_next/static/chunks/dead.js'));
  const imm = await sw.caches.open('dd-immutable');
  const stored = await imm.match(ORIGIN + '/_next/static/chunks/dead.js');
  check('404 not written to dd-immutable', stored === undefined, `stored: ${stored && stored.body}`);
}

console.log('\n4. RULE 3 — activate does NOT purge dd-immutable (live tabs keep chunks)');
{
  const sw = makeSW({ net: async (u) => new MockResponse('ok', { url: u }) });
  const imm = await sw.caches.open('dd-immutable');
  await imm.put(ORIGIN + '/_next/static/chunks/old.js', new MockResponse('OLD CHUNK'));
  await sw.caches.open('dd-static-v1'); // legacy cache from the broken worker
  await sw.fire('activate');
  const kept = await (await sw.caches.open('dd-immutable')).match(ORIGIN + '/_next/static/chunks/old.js');
  const names = await sw.caches.keys();
  check('dd-immutable survives activate', kept && kept.body === 'OLD CHUNK');
  check('legacy dd-static-v1 IS purged', !names.includes('dd-static-v1'), `names: ${names}`);
}

console.log('\n5. Online users always get fresh documents (never a cache hit)');
{
  let served = 0;
  const sw = makeSW({ net: async (u) => { served++; return new MockResponse('BUILD N+1', { url: u }); } });
  const docs = await sw.caches.open('dd-docs');
  await docs.put(ORIGIN + '/compress-pdf', new MockResponse('BUILD N (STALE)'));
  const res = await sw.fire('fetch', req('/compress-pdf', { mode: 'navigate' }));
  check('network wins while online', res && res.body === 'BUILD N+1', `got: ${res && res.body}`);
  check('cache was refreshed', (await docs.match(ORIGIN + '/compress-pdf')).body === 'BUILD N+1');
}

console.log('\n6. Offline, a previously-visited route is served from cache');
{
  const sw = makeSW({ net: async () => { throw new Error('offline'); } });
  const docs = await sw.caches.open('dd-docs');
  await docs.put(ORIGIN + '/compress-pdf', new MockResponse('CACHED COMPRESS'));
  const res = await sw.fire('fetch', req('/compress-pdf', { mode: 'navigate' }));
  check('same-URL cache hit works offline', res && res.body === 'CACHED COMPRESS', `got: ${res && res.body}`);
}

console.log('\n7. Huge assets (/models, /ort) are never cached');
{
  const sw = makeSW({ net: async (u) => new MockResponse('45MB', { url: u }) });
  await sw.fire('fetch', req('/models/face.onnx'));
  await sw.fire('fetch', req('/ort/ort.wasm'));
  const names = await sw.caches.keys();
  let total = 0;
  for (const n of names) total += (await sw.caches.open(n)).map.size;
  check('nothing cached for /models or /ort', total === 0, `entries: ${total}`);
}

console.log('\n8. The API is never cached');
{
  const sw = makeSW({ net: async (u) => new MockResponse('{"plan":"pro"}', { url: u }) });
  await sw.fire('fetch', req('/api/user/me'));
  const names = await sw.caches.keys();
  let total = 0;
  for (const n of names) total += (await sw.caches.open(n)).map.size;
  check('no API response cached', total === 0, `entries: ${total}`);
}

console.log('\n9. Engine assets self-heal (stale-while-revalidate)');
{
  const sw = makeSW({ net: async (u) => new MockResponse('GOOD WASM', { url: u }) });
  const pub = await sw.caches.open('dd-public');
  await pub.put(ORIGIN + '/qpdf/qpdf.wasm', new MockResponse('POISONED'));
  const first = await sw.fire('fetch', req('/qpdf/qpdf.wasm'));
  check('serves cached copy immediately', first && first.body === 'POISONED');
  await new Promise((r) => setTimeout(r, 10)); // let revalidation settle
  const after = await pub.match(ORIGIN + '/qpdf/qpdf.wasm');
  check('background refresh replaced it', after && after.body === 'GOOD WASM', `got: ${after && after.body}`);
}

console.log('\n10. Kill switch wipes everything and unregisters');
{
  const sw = makeSW({
    net: async (u) => (u.endsWith('/sw-kill.json')
      ? new MockResponse('{"disabled":true}', { url: u })
      : new MockResponse('ok', { url: u })),
  });
  await (await sw.caches.open('dd-docs')).put(ORIGIN + '/x', new MockResponse('x'));
  await (await sw.caches.open('dd-immutable')).put(ORIGIN + '/y', new MockResponse('y'));
  await sw.fire('activate');
  const names = await sw.caches.keys();
  check('all caches deleted', names.length === 0, `left: ${names}`);
  check('worker unregistered itself', sw.sandbox.__unregistered === true);
}

console.log('\n11. A network error on the kill file is NOT read as a kill signal');
{
  const sw = makeSW({
    net: async (u) => { if (u.endsWith('/sw-kill.json')) throw new Error('offline'); return new MockResponse('ok', { url: u }); },
  });
  await (await sw.caches.open('dd-docs')).put(ORIGIN + '/x', new MockResponse('x'));
  await sw.fire('activate');
  const kept = await (await sw.caches.open('dd-docs')).match(ORIGIN + '/x');
  check('caches survive a kill-file fetch failure', kept && kept.body === 'x');
  check('did not unregister', sw.sandbox.__unregistered !== true);
}

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
