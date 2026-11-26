import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { BANK_PAGES, siblingBanks, getBankPage } from '@/lib/bank-statements';

// ───────────────────────────────────────────────────────────────────────────
// Internal linking for the bank pages.
// ───────────────────────────────────────────────────────────────────────────
//
// An internal-link audit on 2026-11-25 (crawl the built site, strip
// header/footer/nav, count inbound editorial links per URL) found all 38 bank
// pages on ZERO — the single worst result on the site, and on the family that
// ranks best: sbi-card at position 2.4, bandhan 6.5, rbl 7.0, amex-india 8.0,
// axis 8.7, phonepe-statement 8.7.
//
// Two causes: the hub listed none of them, and the hub is `soon: true` in the
// catalogue, which the Tools menu renders as plain text with no anchor.
//
// These tests hold the repair in place. The one that matters is the
// DISTRIBUTION test: a naive "link to the first twelve" passes every other
// assertion here and leaves 26 pages exactly as orphaned as they were.

describe('bank pages — the sibling link graph', () => {
  it('gives every page a dozen onward links', () => {
    for (const b of BANK_PAGES) {
      const sibs = siblingBanks(b.slug);
      expect(sibs.length, `${b.slug} links to ${sibs.length} siblings`).toBe(12);
    }
  });

  it('never links a page to itself', () => {
    for (const b of BANK_PAGES) {
      expect(siblingBanks(b.slug).map((o) => o.slug)).not.toContain(b.slug);
    }
  });

  it('emits no duplicate link on a page', () => {
    for (const b of BANK_PAGES) {
      const slugs = siblingBanks(b.slug).map((o) => o.slug);
      expect(new Set(slugs).size, `${b.slug} repeats a sibling`).toBe(slugs.length);
    }
  });

  it('⚠ spreads the links so no bank is left orphaned', () => {
    // THE guard. Count what each bank actually RECEIVES across the whole
    // family. "Link to the first twelve" scores 38 for twelve banks and 0 for
    // the rest, and fails here.
    const inbound = new Map(BANK_PAGES.map((b) => [b.slug, 0]));
    for (const b of BANK_PAGES) {
      for (const o of siblingBanks(b.slug)) {
        inbound.set(o.slug, (inbound.get(o.slug) ?? 0) + 1);
      }
    }
    const counts = [...inbound.values()];
    const min = Math.min(...counts);
    const max = Math.max(...counts);
    const orphans = [...inbound.entries()].filter(([, n]) => n === 0).map(([s]) => s);

    expect(orphans, `still orphaned: ${orphans.join(', ')}`).toEqual([]);
    expect(min, `least-linked bank receives only ${min}`).toBeGreaterThanOrEqual(10);
    // Even, not merely non-zero: a lopsided graph concentrates the signal.
    expect(max - min, `spread is ${min}..${max}`).toBeLessThanOrEqual(2);
  });

  it('is deterministic — the same build twice gives the same graph', () => {
    // A random or date-seeded pick would hand Google a different internal
    // link structure on every deploy, which is the one thing it must not do.
    for (const b of BANK_PAGES.slice(0, 6)) {
      expect(siblingBanks(b.slug).map((o) => o.slug)).toEqual(
        siblingBanks(b.slug).map((o) => o.slug),
      );
    }
    const src = readFileSync('lib/bank-statements.ts', 'utf8');
    const fn = src.slice(src.indexOf('export function siblingBanks'));
    const body = fn.slice(0, fn.indexOf('\n}'));
    for (const bad of ['Math.random', 'Date.now', 'new Date']) {
      expect(body.includes(bad), `siblingBanks uses ${bad}`).toBe(false);
    }
  });

  it('handles an unknown slug without throwing', () => {
    expect(siblingBanks('not-a-bank').length).toBe(12);
    expect(getBankPage('not-a-bank')).toBeUndefined();
  });
});

describe('bank pages — the pages actually render the links', () => {
  // A helper nobody calls is not a link. These read the source, because the
  // audit that found the problem read the rendered HTML, and the gap between
  // "the data is right" and "the anchor is on the page" is exactly where the
  // original bug lived.
  it('the bank template renders the sibling block', () => {
    const src = readFileSync('app/bank-statement-converter/[bank]/page.tsx', 'utf8');
    expect(src).toContain('siblingBanks(b.slug)');
    expect(src, 'siblings must be real anchors').toMatch(/href=\{`\/bank-statement-converter\/\$\{o\.slug\}`\}/);
    expect(src, 'and link back to the hub').toContain('href="/bank-statement-converter"');
  });

  it('⚠ the hub lists every bank', () => {
    // It listed none for the whole of the family's life until 2026-11-25.
    const src = readFileSync('app/bank-statement-converter/page.tsx', 'utf8');
    expect(src).toContain('BANK_PAGES.map');
    expect(src).toMatch(/href=\{`\/bank-statement-converter\/\$\{b\.slug\}`\}/);
  });
});
