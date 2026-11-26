import { describe, it, expect } from 'vitest';
import { readFileSync, globSync } from 'node:fs';
import {
  SIZE_LIMITS,
  PUBLISHED_LIMITS,
  UNVERIFIED_COUNT,
  LIMIT_GROUPS,
  limitsInGroup,
  isSourced,
  type SizeLimit,
} from '@/lib/size-limits';

// ───────────────────────────────────────────────────────────────────────────
// The upload caps, and the line between a preset and a published claim.
// ───────────────────────────────────────────────────────────────────────────
//
// These numbers are shown to somebody about to submit an exam form or a visa
// application. They lived inline in the tool under a comment calling them
// "real, sourced upload limits", with no source beside any of them.
//
// The rule this file enforces: a cap is EITHER sourced — authority, URL, the
// date it was read, the sentence as published — OR it says why it is not, and
// only the sourced ones reach the page. The tool offers both, because filling
// a number box the user can see and change is not the same act as publishing a
// claim about what a government department requires.
//
// The load-bearing test is "the page publishes PUBLISHED_LIMITS, not
// SIZE_LIMITS". Everything else here can pass while that one regression quietly
// publishes fourteen unverified figures as fact.

const ISO = /^\d{4}-\d{2}-\d{2}$/;

// Places a cap gets quoted and disagreed about. A source from one of these is
// not a source.
const NOT_A_SOURCE = [
  'blogspot', 'medium.com', 'quora', 'reddit', 'wikipedia',
  'ilovepdf', 'smallpdf', 'hipdf', 'wondershare', 'zamzar', 'swifdoo',
  'testbook', 'byjus', 'adda247', 'jagranjosh', 'careerpower',
];

describe('size limits — every row declares what it is', () => {
  it('has rows at all, and they are unique', () => {
    expect(SIZE_LIMITS.length).toBeGreaterThan(10);
    const labels = SIZE_LIMITS.map((l) => l.label);
    expect(new Set(labels).size, 'two presets share a label').toBe(labels.length);
  });

  it('⚠ carries exactly one of source / unverified — never both, never neither', () => {
    for (const l of SIZE_LIMITS) {
      const hasSource = 'source' in l && l.source !== undefined;
      const hasReason = 'unverified' in l && l.unverified !== undefined;
      expect(
        hasSource !== hasReason,
        `${l.label}: ${hasSource && hasReason ? 'claims a source AND an unverified reason' : 'has neither a source nor a reason for not having one'}`,
      ).toBe(true);
    }
  });

  it('states a real byte count that matches the note', () => {
    for (const l of SIZE_LIMITS) {
      expect(l.bytes, `${l.label} has a nonsense byte count`).toBeGreaterThan(0);
      const m = l.note.match(/^([\d.]+)\s*(KB|MB)$/);
      expect(m, `${l.label}: note "${l.note}" is not a plain KB/MB figure`).toBeTruthy();
      const want = parseFloat(m![1]) * (m![2] === 'MB' ? 1024 * 1024 : 1024);
      expect(l.bytes, `${l.label}: note says ${l.note}, bytes say ${l.bytes}`).toBe(want);
    }
  });

  it('sits in a declared group', () => {
    for (const l of SIZE_LIMITS) {
      expect(LIMIT_GROUPS as readonly string[], `${l.label} is in group "${l.group}"`).toContain(l.group);
    }
    const total = LIMIT_GROUPS.reduce((n, g) => n + limitsInGroup(g).length, 0);
    expect(total, 'a preset is in no group, so the picker never shows it').toBe(SIZE_LIMITS.length);
  });

  it('gives a real reason when it is unverified, not a shrug', () => {
    for (const l of SIZE_LIMITS) {
      if (isSourced(l)) continue;
      expect(l.unverified.length, `${l.label}: "${l.unverified}" is too short to be a reason`).toBeGreaterThan(20);
      expect(l.unverified.trim().endsWith('.'), `${l.label}: reason is not a sentence`).toBe(true);
    }
  });
});

describe('size limits — what a source has to be', () => {
  it('names an authority, a page, a date and the sentence', () => {
    expect(PUBLISHED_LIMITS.length, 'nothing is sourced at all').toBeGreaterThan(0);
    for (const l of PUBLISHED_LIMITS) {
      const s = l.source;
      expect(s.authority.length, `${l.label}: no authority named`).toBeGreaterThan(3);
      expect(s.url.startsWith('https://'), `${l.label}: ${s.url} is not an https page`).toBe(true);
      expect(ISO.test(s.checked), `${l.label}: "${s.checked}" is not an ISO date`).toBe(true);
      expect(s.quote.length, `${l.label}: no quote from the page`).toBeGreaterThan(15);
      expect(l.applies, `${l.label}: published without saying what the cap applies to`).toBeTruthy();
    }
  });

  it('⛔ was not read off an aggregator, a blog or a competitor', () => {
    for (const l of PUBLISHED_LIMITS) {
      const host = l.source.url.toLowerCase();
      for (const bad of NOT_A_SOURCE) {
        expect(host.includes(bad), `${l.label} cites ${bad} — read the authority's own page`).toBe(false);
      }
    }
  });

  it('was not read in the future', () => {
    const today = new Date().toISOString().slice(0, 10);
    for (const l of PUBLISHED_LIMITS) {
      expect(l.source.checked <= today, `${l.label} claims it was read on ${l.source.checked}`).toBe(true);
    }
  });
});

describe('size limits — the published set is the sourced set', () => {
  it('PUBLISHED_LIMITS holds nothing unsourced', () => {
    for (const l of PUBLISHED_LIMITS) {
      expect('unverified' in l && (l as SizeLimit & { unverified?: string }).unverified).toBeFalsy();
    }
    expect(UNVERIFIED_COUNT).toBe(SIZE_LIMITS.length - PUBLISHED_LIMITS.length);
    expect(UNVERIFIED_COUNT, 'nothing left to verify? check the data, not the test').toBeGreaterThan(0);
  });

  it('⚠ proof isSourced actually discriminates', () => {
    // Without this, isSourced could return true for everything and every
    // assertion above would still pass while the page published guesses. This
    // has happened on this codebase before: adviceBreaches given a bare string
    // iterated characters and returned no breaches, for ever, silently.
    const sourced = {
      label: 'x', note: '1 MB', bytes: 1048576, group: 'Everyday sharing' as const, applies: 'y',
      source: { authority: 'A', url: 'https://a.test/p', checked: '2026-01-01', quote: 'The limit is 1 MB.' },
    };
    const not = {
      label: 'y', note: '1 MB', bytes: 1048576, group: 'Everyday sharing' as const,
      unverified: 'Not yet read at source, and this sentence is long enough.',
    };
    expect(isSourced(sourced as SizeLimit)).toBe(true);
    expect(isSourced(not as SizeLimit)).toBe(false);
    expect([sourced, not].filter((l) => isSourced(l as SizeLimit))).toHaveLength(1);
  });

  it('⚠⚠ the page publishes PUBLISHED_LIMITS, never SIZE_LIMITS', () => {
    // THE test. Swapping one identifier for the other turns a table of checked
    // facts into a table of fourteen guesses, and nothing on screen would say so.
    const src = readFileSync('app/compress-to-size/page.tsx', 'utf8');
    expect(src, 'the table is gone').toContain('PUBLISHED_LIMITS.map');
    expect(src, 'the table now maps over the UNVERIFIED rows too').not.toContain('SIZE_LIMITS.map');
    // And it must render outside the gate, or it is published to nobody.
    const open = src.indexOf('afterTool={');
    const at = src.indexOf('<SourcedLimits />');
    expect(open, 'no afterTool prop').toBeGreaterThan(-1);
    expect(at, 'SourcedLimits is not rendered').toBeGreaterThan(open);
  });

  it('the tool still offers every preset, sourced or not', () => {
    const src = readFileSync('components/tools/compress-target-tool.tsx', 'utf8');
    expect(src).toContain("from '@/lib/size-limits'");
    expect(src, 'the tool kept its own copy of the caps').not.toMatch(/label:\s*'UPSC photo'/);
    expect(src, 'the tool must offer all of them, not only the published ones').toContain('limitsInGroup');
    expect(src).not.toContain('PUBLISHED_LIMITS');
  });
});

describe('size limits — an unverified cap is not asserted in page copy', () => {
  // How this one was found: the data file and the table were both correct, and
  // step 2 of "How it works" on /compress-to-size still read
  //   "a government/exam limit (UPSC 40 KB, SSC 100 KB…)"
  // in plain prose, which is the same claim the table refuses to make, written
  // somewhere the type system cannot see. The twin in public/*.md is generated
  // from the page, so it carried it too.
  //
  // What counts as an assertion: the label and the figure near each other. That
  // is what reads as "the cap is N", and it is exactly what no unverified row
  // may say outside the tool's own number box.
  // lib/changelog.ts is in here because the changelog IS a published page, and
  // the first draft of the entry announcing this very change quoted two of the
  // unverified caps as fact in its opening line.
  const files = [
    ...globSync('{app,components}/**/*.tsx', { cwd: process.cwd() }),
    'lib/changelog.ts',
  ];

  it('finds the pages to check at all', () => {
    expect(files.length, 'the glob matched nothing — this test checks nothing').toBeGreaterThan(100);
    expect(files, 'the changelog is a published page too').toContain('lib/changelog.ts');
  });

  it('⚠ no page states an unverified label and its figure together', () => {
    const unverified = SIZE_LIMITS.filter((l) => !isSourced(l));
    expect(unverified.length).toBeGreaterThan(0);
    const offences: string[] = [];
    for (const rel of files) {
      // The tool reads every preset from lib/size-limits.ts by design; it renders
      // them into an input the reader can change, which is not an assertion.
      if (rel.split(/[\\/]/).join('/') === 'components/tools/compress-target-tool.tsx') continue;
      const src = readFileSync(rel, 'utf8');
      for (const l of unverified) {
        // The label and the cap within one clause of each other.
        const near = new RegExp(`${l.label}\\W{0,4}${l.note.replace(' ', '\\s*')}`, 'i');
        if (near.test(src)) offences.push(`${rel}: "${l.label} ${l.note}"`);
      }
    }
    expect(
      offences,
      `an unverified cap is stated as fact in page copy:\n  ${offences.join('\n  ')}\nEither read it at source and give it a \`source\`, or describe the presets without quoting the number.`,
    ).toEqual([]);
  });
});
