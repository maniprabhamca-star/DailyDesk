import { describe, it, expect } from 'vitest';
import { readFileSync, globSync } from 'node:fs';

// ───────────────────────────────────────────────────────────────────────────
// Who we are allowed to cite for somebody else's rule.
// ───────────────────────────────────────────────────────────────────────────
//
// docs/passport-spec-sources.md has said from the beginning that aggregator
// sites are "fine for FINDING a rule and unacceptable as the source of one".
// It then recorded a competitor's blog as the source for the DS-160 photo
// requirements, and `us-visa` sat inside VERIFIED_SPECS on the strength of it
// for four months. A rule nothing enforces is a preference.
//
// This file enforces two things a reviewer cannot be relied on to catch:
//
//  1. No shipped page LINKS to an aggregator, a coaching site or a competitor
//     as the authority for a requirement. Prose that names one is fine —
//     naming competitors is deliberate policy — a citation is not.
//  2. The DS-160 page cites the Foreign Affairs Manual, and does not restate
//     the one figure on it we could not read at source as a requirement.

const SOURCE_FILES = [
  ...globSync('{app,components,lib}/**/*.{ts,tsx}', { cwd: process.cwd() }),
];

// ⚠ Everything here reads the code with COMMENTS REMOVED, and that is not a
// tidiness preference — it is the difference between a guard and a decoration.
// The first draft asserted the FAM url was `toContain`ed in the file. It passed
// after the citation was swapped for a competitor's blog, because the url was
// still sitting in the header comment explaining why we cite the FAM. A guard
// that reads its own documentation proves nothing.
function code(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:"'`\\])\/\/[^\n]*/g, '$1');
}

// Pages whose whole job is to discuss competitors by name, under the
// competitor-comparison policy. They may link to the competitor they compare
// against; everybody else may not link to one as a source.
const MAY_LINK_COMPETITORS = /(^|[\\/])(compare|.*-alternative|alternative-page)([\\/]|\.tsx?$)/;

// Hosts that quote other people's rules. Several of these disagree with each
// other on the very figures we would be citing them for.
const NOT_AN_AUTHORITY = [
  'passlens.com',
  'schengenvisainfo.com',
  'axa-schengen.com',
  'testbook.com',
  'byjus.com',
  'adda247.com',
  'jagranjosh.com',
  'careerpower.in',
  'ilovepdf.com',
  'smallpdf.com',
  'hipdf.com',
  'tinywow.com',
  'wondershare.com',
  'zamzar.com',
  'quora.com',
  'reddit.com',
  'wikipedia.org',
  'medium.com',
];

describe('sourced claims — nobody cites an aggregator for somebody else’s rule', () => {
  it('found the files to check', () => {
    expect(SOURCE_FILES.length, 'the glob matched nothing — this test checks nothing').toBeGreaterThan(200);
  });

  it('⚠ proof the comment stripper strips comments', () => {
    // The guard on the guard. Without this, `code()` could return its input
    // unchanged and every assertion below would read the explanatory comments
    // instead of the code, which is precisely how the first draft passed while
    // citing a competitor's blog.
    const sample = [
      "const good = 'https://fam.state.gov/x';",
      "// const bad = 'https://passlens.com/x';",
      '/* const alsoBad = "https://testbook.com/x"; */',
    ].join('\n');
    const stripped = code(sample);
    expect(stripped).toContain('fam.state.gov');
    expect(stripped, 'a line comment survived').not.toContain('passlens.com');
    expect(stripped, 'a block comment survived').not.toContain('testbook.com');
    // And it must not eat the url inside a real string.
    expect(code("const u = 'https://a.test/p';")).toContain('https://a.test/p');
  });

  it('⛔ no page links to an aggregator, coaching site or competitor as a source', () => {
    const offences: string[] = [];
    for (const rel of SOURCE_FILES) {
      const norm = rel.split(/[\\/]/).join('/');
      if (MAY_LINK_COMPETITORS.test(norm)) continue;
      const src = code(readFileSync(rel, 'utf8'));
      for (const host of NOT_AN_AUTHORITY) {
        // Any live url to that host in the CODE. Matching `href="…"` was too
        // narrow: this page holds its citation in `const FAM = '…'` and spends
        // it as `href={FAM}`, which no href pattern can see.
        const linked = new RegExp(`["'\`]https?://(?:[a-z0-9-]+\\.)*${host.replace(/\./g, '\\.')}`, 'i');
        if (linked.test(src)) offences.push(`${norm} → ${host}`);
      }
    }
    expect(
      offences,
      `a shipped page cites a non-authority:\n  ${offences.join('\n  ')}\nRead the authority's own page, or say plainly that the figure is unverified.`,
    ).toEqual([]);
  });
});

describe('sourced claims — the DS-160 page', () => {
  const rel = 'app/us-visa-photo/page.tsx';
  const src = code(readFileSync(rel, 'utf8'));

  it('cites the Foreign Affairs Manual, which is readable', () => {
    // fam.state.gov answers automated reads and carries the photo standard at
    // 9 FAM 303.6-2(A)(1). travel.state.gov serves a Cloudflare interstitial,
    // which is why the geometry is sourced and the byte cap is not.
    expect(src, 'the FAM citation is gone').toContain('fam.state.gov/fam/09fam/09fam030306.html');
    expect(src, 'the clause is not named, so a reader cannot find the sentence').toContain('9 FAM 303.6-2(A)(1)');
  });

  it('⚠ does not restate the 240 KB cap as a requirement', () => {
    // The figure may appear — it is what our export does, and it is a real
    // query people search. What it may not do is claim an authority requires
    // it, because the page that publishes it refuses to be read.
    const asRequirement = [
      /requires?\s+(?:a\s+)?(?:jpeg\s+)?(?:under|below|less than|≤)\s*240/i,
      /must\s+be\s+(?:under|below|less than|≤)\s*240/i,
      /240\s*KB\s+(?:upload\s+)?(?:limit|requirement|rule|maximum|cap)\b/i,
      /(?:under|below|≤)\s*240\s*KB[^.]{0,30}\bas\s+(?:the\s+)?DS-160\s+requires/i,
      /exactly\s+as\s+DS-160\s+requires/i,
    ];
    const hits = asRequirement.filter((re) => re.test(src)).map(String);
    expect(
      hits,
      `the page states the 240 KB cap as somebody's rule:\n  ${hits.join('\n  ')}\nSay what our export does, and tell the reader to read the cap off the form.`,
    ).toEqual([]);
  });

  it('tells the reader to check the figure on the form', () => {
    expect(src.toLowerCase()).toMatch(/read the cap off the form|check the cap on the form/);
  });
});
