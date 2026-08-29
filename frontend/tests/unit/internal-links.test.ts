import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ALTERNATIVES } from '@/lib/alternatives';
import { SECTORS } from '@/lib/sectors';

// Orphan pages: live, in the sitemap, and reachable from nowhere on the site.
//
// It happened twice on 2026-08-29 and neither was caught by a test, a build or a
// typecheck, because nothing was broken — the pages worked perfectly and simply
// could not be found. Five *-alternative pages shipped while /compare listed a
// hand-typed four, and SIX sector pages (including the four that had been live
// for weeks) were linked from nowhere at all.
//
// A sitemap tells Google a page exists. An internal link is what tells it the
// page matters, and it is the only thing that lets a reader find it.

const APP = join(process.cwd(), 'app');
const routeDirs = readdirSync(APP, { withFileTypes: true })
  .filter((e) => e.isDirectory())
  .map((e) => e.name);

const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf8');

// Comments are prose, and prose legitimately mentions a path while explaining
// why a link is there. Stripping them keeps "is this hard-coded?" asking about
// code — which is what it means. Without this, writing a comment that names a
// route fails the test that exists to stop routes being typed by hand.
const code = (p: string) =>
  read(p)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|\s)\/\/.*$/gm, '$1');

describe('internal links', () => {
  it('lists every *-alternative route in ALTERNATIVES', () => {
    const onDisk = routeDirs.filter((d) => d.endsWith('-alternative')).sort();
    const listed = ALTERNATIVES.map((a) => a.slug).sort();
    expect(listed, 'a page exists that /compare will not link to').toEqual(onDisk);
  });

  it('does not list an alternative whose page was deleted', () => {
    for (const a of ALTERNATIVES) {
      expect(routeDirs.includes(a.slug), `${a.slug} is listed but app/${a.slug}/ does not exist`).toBe(true);
    }
  });

  it('renders the alternatives from the list rather than typing them', () => {
    const compare = code('app/compare/page.tsx');
    expect(compare.includes('ALTERNATIVES'), '/compare should map over ALTERNATIVES').toBe(true);
    // A hard-coded href is how the first four drifted out of sync with the rest.
    for (const a of ALTERNATIVES) {
      expect(
        compare.includes(`href="/${a.slug}"`),
        `/compare hard-codes a link to ${a.slug} — map over ALTERNATIVES instead`,
      ).toBe(false);
    }
  });

  it('links every sector from the footer', () => {
    const footer = code('components/app/site-footer.tsx');
    expect(footer.includes('SECTORS.map'), 'the footer should derive its Built for column from SECTORS').toBe(true);
    for (const s of SECTORS) {
      expect(
        footer.includes(`/for/${s.slug}`),
        `the footer hard-codes /for/${s.slug} — derive it from SECTORS instead`,
      ).toBe(false);
    }
  });

  it('gives every sector a route on disk', () => {
    // /for/[sector] is dynamic, so a typo in a slug is a 404 nothing catches.
    expect(routeDirs.includes('for'), 'app/for/ is missing').toBe(true);
    for (const s of SECTORS) {
      expect(s.slug, `sector slug "${s.slug}" is not url-safe`).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
    }
  });

  it('points every sector job at a route that exists', () => {
    // Caught a real one: three sector pages linked /share-safe-pdf, and the route
    // is /share-safe-pdf-check. Nothing else would have noticed — a wrong href in
    // data compiles, renders, and 404s only when somebody clicks it.
    for (const s of SECTORS) {
      for (const j of s.jobs) {
        const seg = j.href.split('/')[1];
        expect(routeDirs.includes(seg), `${s.slug}: job "${j.task}" links to ${j.href}, which has no route`).toBe(true);
      }
      const seg = s.primary.href.split('/')[1];
      expect(routeDirs.includes(seg), `${s.slug}: primary CTA links to ${s.primary.href}, which has no route`).toBe(true);
    }
  });

  it('names toolkit tools exactly as the catalogue does', () => {
    // The toolkit is matched by NAME against the catalogue to build its links, so
    // a near-miss silently drops the tool from the page rather than erroring.
    const catalogFile = read('components/app/catalog.tsx');
    const names = new Set([...catalogFile.matchAll(/name:\s*'([^']+)'/g)].map((m) => m[1]));
    for (const s of SECTORS) {
      for (const t of s.toolkit) {
        expect(names.has(t), `${s.slug}: toolkit lists "${t}", which is not a catalogue tool name`).toBe(true);
      }
    }
  });

  it('gives every alternative a distinct hook', () => {
    // Nine links reading the same way is a list nobody scans.
    const seen = new Map<string, string>();
    for (const a of ALTERNATIVES) {
      expect(seen.get(a.hook), `${a.name} and ${seen.get(a.hook)} share a hook`).toBeUndefined();
      seen.set(a.hook, a.name);
    }
  });
});
