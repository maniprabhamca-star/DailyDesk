import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { describe, expect, it } from 'vitest';

// Every indexable route ships with a title, a description, a self-referencing
// canonical and an OG image, or it does not ship. Written after a session that
// added ~75 routes across seven families, because "I checked each one as I went"
// is exactly the assurance that stops being true the day you add fifteen at once.
//
// ── Why this reads more than the page file ───────────────────────────────────
// The first version of this test reported 99 violations and almost all of them
// were false. Metadata reaches a route three legitimate ways:
//   1. a literal `export const metadata` in the page,
//   2. a helper that builds it — devMeta('base64'), workflowMetadata(...),
//   3. a layout.tsx beside a 'use client' page, which cannot export metadata
//      itself (/pricing and /feedback are both correct and were both flagged).
// A test that only knows about (1) trains people to ignore it, which is worse
// than not having it. Verified against production before being loosened: those
// pages emit correct titles and canonicals.

const APP = join(process.cwd(), 'app');

function routeFiles(dir: string, out: string[] = []): string[] {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (!e.isDirectory()) continue;
    if (e.name.startsWith('_') || e.name === 'api') continue;
    const full = join(dir, e.name);
    if (existsSync(join(full, 'page.tsx'))) out.push(join(full, 'page.tsx'));
    routeFiles(full, out);
  }
  return out;
}

const rel = (p: string) => p.slice(process.cwd().length + 1).replace(/\\/g, '/');
const read = (p: string) => readFileSync(p, 'utf8');

// Not indexable, so metadata is not the point.
const SKIP = [
  /app\/page\.tsx$/,                                   // home — metadata in the root layout
  /\/\[[^\]]+\]\/page\.tsx$/,                          // dynamic — generateMetadata, covered by each family's test
  /app\/(login|register|account|dashboard|reset-password|verify-email|forgot|logged-out|account-deleted)\//,
  /app\/design\//,                                     // internal design review, noindex
  /app\/technology\//,                                 // internal, noindex
  /app\/tools\/(password|qr-code)\//,                  // permanentRedirect stubs
];

/** The source that actually decides this route's metadata. */
function metaSource(page: string): string {
  const own = read(page);
  const layout = join(dirname(page), 'layout.tsx');
  return existsSync(layout) ? own + '\n' + read(layout) : own;
}

/** Delegates to a helper that builds the whole Metadata object. */
const viaHelper = (s: string) => /\b(devMeta|workflowMetadata)\s*\(/.test(s);

/** A page that tells Google not to index it is out of scope by definition. */
const noindex = (s: string) => /robots:\s*\{[^}]*index:\s*false/.test(s);

const PAGES = routeFiles(APP)
  .filter((p) => !SKIP.some((re) => re.test(rel(p))))
  // Gated coming-soon tools carry robots index:false on purpose. Demanding a
  // share card for a page search engines are told to ignore is noise, and noise
  // is how a test stops being read.
  .filter((p) => !noindex(read(p)));

describe('SEO metadata', () => {
  it('found the app routes', () => {
    expect(PAGES.length).toBeGreaterThan(50);
  });

  it('gives every indexable route title, description, canonical and an OG image', () => {
    for (const p of PAGES) {
      const s = metaSource(p);
      if (viaHelper(s)) continue;
      const where = rel(p);
      expect(/export const metadata|generateMetadata/.test(s), `${where}: no metadata export`).toBe(true);
      expect(/title:/.test(s), `${where}: no title`).toBe(true);
      expect(/description:/.test(s), `${where}: no description`).toBe(true);
      expect(/alternates:\s*\{\s*canonical:/.test(s), `${where}: no canonical`).toBe(true);
      expect(/openGraph:/.test(s), `${where}: no openGraph block`).toBe(true);
      expect(/images:\s*\[/.test(s), `${where}: openGraph has no image`).toBe(true);
    }
  });

  it('keeps titles inside the 60-character budget', () => {
    // Google truncates around there. A title that gets cut loses the brand.
    for (const p of PAGES) {
      const m = metaSource(p).match(/title:\s*'([^']{5,})'|title:\s*"([^"]{5,})"/);
      if (!m) continue;
      const title = (m[1] || m[2]).replace(/\\'/g, "'");
      if (title.includes('${')) continue;
      expect(title.length, `${rel(p)}: title is ${title.length} chars — "${title}"`).toBeLessThanOrEqual(60);
    }
  });

  it('keeps descriptions inside the 165-character budget', () => {
    for (const p of PAGES) {
      const m = metaSource(p).match(/description:\s*\n?\s*'([^']{20,})'|description:\s*\n?\s*"([^"]{20,})"/);
      if (!m) continue;
      const d = (m[1] || m[2]).replace(/\\'/g, "'");
      if (d.includes('${')) continue;
      expect(d.length, `${rel(p)}: description is ${d.length} chars`).toBeLessThanOrEqual(165);
    }
  });

  it('has a canonical that points at its own route', () => {
    // A copy-pasted canonical pointing at the page it was copied from is worse
    // than none: it tells Google the new page is a duplicate of the old one.
    for (const p of PAGES) {
      const s = metaSource(p);
      if (viaHelper(s)) continue;
      const m = s.match(/canonical:\s*'([^']+)'/);
      if (!m || m[1].includes('${')) continue;
      const route = '/' + rel(p).replace(/^app\//, '').replace(/\/page\.tsx$/, '');
      expect(m[1], `${rel(p)}: canonical "${m[1]}" does not match route "${route}"`).toBe(route);
    }
  });
});
