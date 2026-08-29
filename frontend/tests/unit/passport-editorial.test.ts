import { describe, expect, it } from 'vitest';
import { EDITORIAL, PASSPORT_SPECS, getSpec } from '@/lib/passport-specs';

// The editorial block exists for one reason: two countries that publish the same
// photo size generate identical pages, and Google files them as duplicates. The
// prose is the only thing that separates them, so it has to be real — sourced
// from the issuing authority, on a date someone can check. These tests fail the
// build on the two ways that decays: an unsourced entry, and an entry sourced to
// a visa-agency blog that will be out of date within a year.

// Aggregators are fine for FINDING a rule and unacceptable as the source of one.
// This list is the set already caught in docs/passport-spec-sources.md.
const AGGREGATORS = [
  'passlens.com',
  'axa-schengen.com',
  'schengenvisainfo.com',
  'simplevisa.com',
  'ivisa.com',
  'visahq.com',
  'photoaid.com',
  'persofoto.com',
];

describe('passport editorial', () => {
  const entries = Object.entries(EDITORIAL);

  it('has at least one entry', () => {
    expect(entries.length).toBeGreaterThan(0);
  });

  it('only describes countries that actually exist in the spec table', () => {
    for (const [id] of entries) {
      expect(getSpec(id), `EDITORIAL has "${id}" but PASSPORT_SPECS does not`).toBeDefined();
    }
  });

  it('cites an authority page and the date it was read, for every entry', () => {
    for (const [id, ed] of entries) {
      expect(ed.sourceName, `${id}: missing sourceName`).toBeTruthy();
      expect(ed.sourceUrl, `${id}: missing sourceUrl`).toMatch(/^https:\/\//);
      expect(ed.checkedOn, `${id}: checkedOn must be an ISO date`).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  it('never cites an aggregator as the source of a government rule', () => {
    for (const [id, ed] of entries) {
      const host = new URL(ed.sourceUrl).hostname.replace(/^www\./, '');
      for (const bad of AGGREGATORS) {
        expect(
          host === bad || host.endsWith(`.${bad}`),
          `${id}: cites aggregator ${host}. Use the issuing authority's own page.`,
        ).toBe(false);
      }
    }
  });

  it('says something country-specific, not just a restatement of the numbers', () => {
    // 150 words is the bar in the editorial scope. Count across the prose fields.
    for (const [id, ed] of entries) {
      const prose = [
        ed.authority, ed.quirk, ed.background, ed.expression,
        ed.glasses, ed.headCovering, ed.children, ed.exceptions, ed.recency,
      ].filter(Boolean).join(' ');
      const words = prose.trim().split(/\s+/).length;
      expect(words, `${id}: only ${words} words of editorial; the bar is 150`).toBeGreaterThanOrEqual(150);
    }
  });

  it('covers the countries whose specs are identical to another country', () => {
    // These are the pages that deduplicate without prose. If a NEW country is
    // added that shares its whole spec with an existing one, this fails until
    // one of the two has editorial — which is the moment to write it, not later.
    const key = (s: (typeof PASSPORT_SPECS)[number]) =>
      `${s.wMM}x${s.hMM}/${s.headMin}-${s.headMax}/${s.bgName}`;
    const byKey = new Map<string, string[]>();
    for (const s of PASSPORT_SPECS) {
      byKey.set(key(s), [...(byKey.get(key(s)) ?? []), s.id]);
    }

    const undifferentiated: string[] = [];
    for (const ids of byKey.values()) {
      if (ids.length < 2) continue;
      const bare = ids.filter((id) => !EDITORIAL[id]);
      // A cluster is fine while at most one page in it is bare — that page is
      // the only one carrying the shared text, so nothing duplicates it.
      if (bare.length > 1) undifferentiated.push(...bare);
    }

    // Snapshot of what is still to write. This number must go DOWN. Raising it
    // means a country was added to a shared-spec cluster without its editorial.
    expect(undifferentiated.length).toBeLessThanOrEqual(24);
  });
});
