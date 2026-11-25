import { describe, it, expect } from 'vitest';
import { adviceBreaches } from './_advice-vocabulary';
import {
  JURISDICTIONS, ACCEPTING, NEEDS_OWN_FORM, NO_SALES_TAX, STATUS_ORDER, STATUS_LABEL,
  STATUS_BLURB, byStatus, jurisdiction, MTC, MTC_BOXES, MTC_NOTES, MTC_PAGES, MTC_FIELDS,
  MTC_REVISION, MTC_CLAIMED_STATES, CHECKED_ON, CHECKED_ON_LABEL, JURISDICTION_COUNT,
  SEO_TITLE, SEO_DESCRIPTION,
  type MtcStatus,
} from '@/lib/resale-certificates';

// The contract for matrix 1 — resale / sales-tax exemption certificates.
//
// The matrix shape is new, so the invariants that matter are new too. Three
// carry real consequence:
//
//  1. A VERDICT WITHOUT AN EXPLANATION IS WORSE THAN NO ROW. "Accepted, with a
//     condition" and "resale only" are only useful if the row says what the
//     condition is. A blank there reads as a plain yes.
//  2. THE HEADLINE MUST EQUAL THE ROWS. A matrix that claims a number its own
//     rows do not add up to is the exact failure the derived-counts rule
//     exists to prevent, and it is invisible on the page.
//  3. THE MTC'S OWN ERRORS MUST NOT PROPAGATE. mtc.gov links California to the
//     Franchise Tax Board, which does not administer sales tax, and omits
//     Nevada although Nevada is printed on the certificate. Both are pinned
//     below, because the obvious "fix" later is to re-sync from their page.

const US_STATES = [
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA', 'HI', 'ID', 'IL', 'IN', 'IA',
  'KS', 'KY', 'LA', 'ME', 'MD', 'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
  'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC', 'SD', 'TN', 'TX', 'UT', 'VT',
  'VA', 'WA', 'WV', 'WI', 'WY',
];

describe('resale certificates — the grid is complete and well formed', () => {
  it('covers all 50 states and DC, once each', () => {
    expect(JURISDICTION_COUNT).toBe(51);
    const codes = JURISDICTIONS.map((j) => j.code);
    expect(new Set(codes).size).toBe(51);
    for (const c of [...US_STATES, 'DC']) {
      expect(codes, `${c} missing from the matrix`).toContain(c);
    }
  });

  it('slugs are unique, url-safe and match no other', () => {
    const slugs = JURISDICTIONS.map((j) => j.slug);
    expect(new Set(slugs).size).toBe(51);
    for (const s of slugs) expect(s, s).toMatch(/^[a-z][a-z-]*[a-z]$/);
  });

  it('every row resolves by slug, and nothing else does', () => {
    for (const j of JURISDICTIONS) expect(jurisdiction(j.slug)?.code).toBe(j.code);
    expect(jurisdiction('not-a-state')).toBeUndefined();
  });

  it('every status is one we know how to render', () => {
    for (const j of JURISDICTIONS) {
      expect(STATUS_ORDER, `${j.code}`).toContain(j.status);
      expect(STATUS_LABEL[j.status]).toBeTruthy();
      expect(STATUS_BLURB[j.status]).toBeTruthy();
    }
    // Every status that exists in the data must be renderable, and every
    // status we can render must exist — an orphan legend entry is a label for
    // a column the reader will never see.
    const used = new Set(JURISDICTIONS.map((j) => j.status));
    for (const s of STATUS_ORDER) expect([...used], `legend has "${s}" but no row does`).toContain(s);
  });
});

describe('⚠ resale certificates — a verdict always carries its reason', () => {
  // The one that matters. "Accepted, with a condition" and no condition on the
  // row is indistinguishable from a plain yes, and a seller acting on it takes
  // a certificate that does not cover the purchase.
  it('every qualified verdict says what the qualification is', () => {
    for (const j of JURISDICTIONS) {
      if (j.status === 'conditional' || j.status === 'resale-only') {
        expect(j.limit, `${j.code} is "${j.status}" with nothing to explain it`).toBeTruthy();
        expect((j.limit ?? '').length, `${j.code} limit too thin to be useful`).toBeGreaterThan(30);
      }
    }
  });

  it('a note number on a row means the row explains it', () => {
    for (const j of JURISDICTIONS) {
      if (j.notes?.length) {
        expect(j.limit, `${j.code} cites note ${j.notes.join(',')} and says nothing`).toBeTruthy();
      }
    }
  });

  it('an unqualified acceptance carries no note and no caveat', () => {
    for (const j of byStatus('accepted')) {
      if (!j.notes?.length) {
        expect(j.limit, `${j.code} is plainly accepted but carries a caveat`).toBeUndefined();
      }
    }
  });

  it('every cited note exists on the certificate', () => {
    for (const j of JURISDICTIONS) {
      for (const n of j.notes ?? []) {
        expect(n, `${j.code} cites note ${n}`).toBeGreaterThanOrEqual(1);
        expect(n, `${j.code} cites note ${n}, past the ${MTC_NOTES} on the form`).toBeLessThanOrEqual(MTC_NOTES);
      }
    }
  });

  it('only jurisdictions on the certificate cite a note', () => {
    for (const j of byStatus('absent')) {
      expect(j.notes, `${j.code} is absent yet cites a note`).toBeUndefined();
    }
  });
});

describe('⚠ resale certificates — the headline equals the rows', () => {
  it('the jurisdictions on the certificate match the boxes counted on it', () => {
    expect(ACCEPTING.length).toBe(MTC_BOXES);
  });

  it('the four buckets partition the grid', () => {
    const sum = STATUS_ORDER.reduce((n, s) => n + byStatus(s).length, 0);
    expect(sum).toBe(JURISDICTION_COUNT);
  });

  it('what we publish is not what mtc.gov says, and that is deliberate', () => {
    // Their page says 36 states; their form prints 38 boxes. If these ever
    // agree, somebody has re-synced from the prose and the page is now
    // repeating a number it cannot show.
    expect(MTC_BOXES).not.toBe(MTC_CLAIMED_STATES);
  });

  it('the five no-sales-tax states are exactly who we think', () => {
    expect(NO_SALES_TAX.map((j) => j.code).sort()).toEqual(['AK', 'DE', 'MT', 'NH', 'OR']);
  });

  it('⚠ Alaska is the one no-sales-tax state still on the certificate', () => {
    // Municipalities levy it and the ARSSTC administers it for remote sellers.
    // Treating "no state sales tax" as "no certificate" would drop a real row.
    const ak = jurisdiction('alaska')!;
    expect(ak.salesTax).toBe(false);
    expect(ak.status).not.toBe('absent');
    expect(ak.limit).toMatch(/ARSSTC/);
    for (const j of NO_SALES_TAX) {
      if (j.code !== 'AK') expect(j.status, `${j.code}`).toBe('absent');
    }
  });

  it('the states needing their own form are the taxing ones not on the certificate', () => {
    expect(NEEDS_OWN_FORM.every((j) => j.salesTax && j.status === 'absent')).toBe(true);
    // Ship 2 builds this column. If the number moves, ship 2's scope moved.
    expect(NEEDS_OWN_FORM.length).toBe(9);
    expect(NEEDS_OWN_FORM.map((j) => j.code).sort())
      .toEqual(['DC', 'IN', 'LA', 'MA', 'MS', 'NY', 'VA', 'WV', 'WY']);
  });
});

describe('⚠ resale certificates — the MTC’s own errors stop here', () => {
  it('California points at CDTFA, never the Franchise Tax Board', () => {
    const ca = jurisdiction('california')!;
    expect(ca.authorityUrl).toContain('cdtfa.ca.gov');
    expect(ca.authorityUrl).not.toContain('ftb.ca.gov');
    expect(ca.authority).toMatch(/Tax and Fee Administration/);
  });

  it('Nevada is in the matrix, though mtc.gov’s state list omits it', () => {
    const nv = jurisdiction('nevada');
    expect(nv, 'Nevada is printed on the certificate — it belongs here').toBeTruthy();
    expect(nv!.status).not.toBe('absent');
    expect(nv!.notes).toContain(20);
  });
});

describe('resale certificates — links and provenance', () => {
  it('every authority link is https and is a page, not a PDF', () => {
    for (const j of JURISDICTIONS) {
      expect(j.authorityUrl, j.code).toMatch(/^https:\/\//);
      expect(j.authorityUrl.toLowerCase().endsWith('.pdf'), j.code).toBe(false);
    }
  });

  it('every authority is named, and named differently from the next', () => {
    for (const j of JURISDICTIONS) expect(j.authority.length, j.code).toBeGreaterThan(8);
    // 51 jurisdictions, 51 revenue bodies. A duplicate means a copy-paste.
    expect(new Set(JURISDICTIONS.map((j) => j.authority)).size).toBe(51);
  });

  it('the header row links to the MTC page, and the PDF stays separate', () => {
    expect(MTC.officialUrl).toMatch(/^https:\/\/www\.mtc\.gov\//);
    expect(MTC.officialUrl.endsWith('.pdf')).toBe(false);
    expect(MTC.pdfUrl).toMatch(/\.pdf$/);
    expect(MTC_REVISION).toMatch(/October 14, 2022/);
  });

  it('the measurements are measurements, not round numbers', () => {
    expect(MTC_PAGES).toBe(9);
    expect(MTC_FIELDS).toBe(60);
    expect(MTC_BOXES).toBe(38);
    expect(MTC_NOTES).toBe(32);
  });

  it('CHECKED_ON is a real past date and its label agrees with it', () => {
    expect(CHECKED_ON).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    const [y, m, d] = CHECKED_ON.split('-').map(Number);
    const then = new Date(y, m - 1, d);
    expect(then.getTime()).toBeLessThanOrEqual(Date.now());
    // The label is built from the parts for a reason — a UTC-parsed date
    // renders a day early west of UTC, undermining the claim it supports.
    expect(CHECKED_ON_LABEL).toContain(String(d));
    expect(CHECKED_ON_LABEL).toContain(String(y));
  });
});

describe('⚠ resale certificates — the advice boundary', () => {
  // Same rule as the task pages, same shared list. Saying "the buyer must
  // enter a Kansas number" tells a reader what the law requires of them.
  // Saying "Kansas looks for a Kansas number" tells them about the document.
  it('no row describes a duty', () => {
    const copy = JURISDICTIONS.flatMap((j) => [j.limit ?? '', j.name, j.authority]);
    const hits = adviceBreaches(copy);
    expect(hits, `\n  ${hits.join('\n  ')}\n`).toEqual([]);
  });

  it('the legend does not either', () => {
    const hits = adviceBreaches([
      ...Object.values(STATUS_LABEL),
      ...Object.values(STATUS_BLURB),
    ] as string[]);
    expect(hits, `\n  ${hits.join('\n  ')}\n`).toEqual([]);
  });

  // Proof the guard bites on this data, not just that it is wired up.
  it('the guard would catch a duty if one were written', () => {
    expect(adviceBreaches(['The buyer must enter a Kansas registration number']).length)
      .toBeGreaterThan(0);
  });
});

describe('resale certificates — statuses carry their weight', () => {
  it('each bucket has rows, so no column renders empty', () => {
    const counts = Object.fromEntries(STATUS_ORDER.map((s) => [s, byStatus(s).length])) as Record<MtcStatus, number>;
    for (const s of STATUS_ORDER) expect(counts[s], `${s} is empty`).toBeGreaterThan(0);
    // The shape of the finding: qualified acceptances outnumber plain ones.
    // If this ever inverts, the notes were read too generously.
    expect(counts.conditional + counts['resale-only']).toBeGreaterThan(counts.accepted);
  });
});

describe('resale certificates — the SEO budgets', () => {
  // Measured on the rendered page at 184 characters on the first build, which
  // Google truncates mid-sentence. The budget lives in a test because the copy
  // is a template literal over derived counts — it can grow without anyone
  // editing the string.
  it('the title fits', () => {
    expect(SEO_TITLE.length, `title is ${SEO_TITLE.length}`).toBeLessThanOrEqual(60);
    expect(SEO_TITLE.length).toBeGreaterThan(25);
  });

  it('the description fits', () => {
    expect(SEO_DESCRIPTION.length, `description is ${SEO_DESCRIPTION.length}`).toBeLessThanOrEqual(155);
    expect(SEO_DESCRIPTION.length).toBeGreaterThan(80);
  });

  it('the description states the number the page actually shows', () => {
    expect(SEO_DESCRIPTION).toContain(String(ACCEPTING.length));
  });
});
