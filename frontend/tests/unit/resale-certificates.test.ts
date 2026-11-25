import { describe, it, expect } from 'vitest';
import { adviceBreaches } from './_advice-vocabulary';
import {
  JURISDICTIONS, ACCEPTING, NEEDS_OWN_FORM, NO_SALES_TAX, STATUS_ORDER, STATUS_LABEL,
  STATUS_BLURB, byStatus, jurisdiction, MTC, MTC_BOXES, MTC_NOTES, MTC_PAGES, MTC_FIELDS,
  MTC_REVISION, MTC_CLAIMED_STATES, CHECKED_ON, CHECKED_ON_LABEL, JURISDICTION_COUNT,
  SEO_TITLE, SEO_DESCRIPTION,
  SST, SST_MEMBERS, isSstMember, OWN_CERTS, ownCert, OWN_FORMS, OWN_FORM_COUNT,
  OWN_FORM_FIELDS, STILL_UNANSWERED,
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

// ───────────────────────────────────────────────────────────────────────────
// Ship 2 — the Streamlined header row, and each jurisdiction's own document.
// ───────────────────────────────────────────────────────────────────────────
//
// Two of these guards exist because of a specific near-miss, and they are the
// ones to leave alone:
//
//  A. GEORGIA IS THE ONLY ZERO. The harness that measured these reported 0
//     fillable fields for all twelve PDFs, because pdf.js detaches the
//     ArrayBuffer it is handed and the catch wrote 0. Georgia's ST-5 really is
//     flat. Pinning "exactly one zero" means the next time a measurement
//     pass silently fails, the build fails with it instead of publishing a
//     page that calls every form flat.
//  B. AN UNVERIFIED ROW CARRIES NO LINK. The District of Columbia's source
//     403s. The tempting repair is a plausible URL, which is the one failure
//     mode that costs more than the gap: the `unverified` variant has no url
//     field at all, so there is nowhere to put one.

describe('resale certificates — the Streamlined header row', () => {
  it('has 24 members: 23 full and Tennessee as the lone associate', () => {
    const codes = Object.keys(SST_MEMBERS);
    expect(codes.length).toBe(24);
    expect(codes.filter((c) => SST_MEMBERS[c] === 'full').length).toBe(23);
    expect(codes.filter((c) => SST_MEMBERS[c] === 'associate')).toEqual(['TN']);
  });

  it('every member is a jurisdiction we actually carry', () => {
    for (const c of Object.keys(SST_MEMBERS)) {
      expect(jurisdiction(JURISDICTIONS.find((j) => j.code === c)?.slug ?? ''), `${c} not in the grid`).toBeTruthy();
    }
  });

  it('no member is a state without a sales tax', () => {
    // A certificate of exemption from a tax that does not exist would be a
    // sign the membership list was copied from somewhere careless.
    for (const j of NO_SALES_TAX) {
      expect(isSstMember(j.code), `${j.code} has no sales tax yet appears as an SST member`).toBe(false);
    }
  });

  it('covers Indiana, West Virginia and Wyoming — the reason it is on the page', () => {
    // The structural finding of ship 2. If a future edit drops these, the
    // second header row stops earning its space and the page should say so.
    for (const c of ['IN', 'WV', 'WY']) {
      expect(isSstMember(c), `${c} is MTC-absent and needs the Streamlined route`).toBe(true);
    }
  });

  it('states its own measured shape', () => {
    expect(SST.pages).toBe(2);
    expect(SST.fields).toBeGreaterThan(50);
    expect(SST.revision).toMatch(/\d{4}/);
    expect(SST.officialUrl).not.toMatch(/\.pdf($|\?)/i);
  });
});

describe('resale certificates — each jurisdiction’s own document', () => {
  it('is keyed only by jurisdictions we carry', () => {
    const codes = new Set(JURISDICTIONS.map((j) => j.code));
    for (const c of Object.keys(OWN_CERTS)) expect(codes.has(c), `${c} is not a jurisdiction`).toBe(true);
  });

  it('never attaches a certificate to a state with no sales tax', () => {
    for (const j of NO_SALES_TAX) expect(ownCert(j.code), `${j.code} has no sales tax`).toBeUndefined();
  });

  it('keeps the human page and the PDF separate, as us-forms does', () => {
    // Same rule as lib/us-forms.ts: officialUrl is the page a person reads,
    // and must not be a direct PDF, so a reader always lands somewhere the
    // department can correct.
    for (const [code, c] of Object.entries(OWN_CERTS)) {
      if (c.kind === 'unverified') continue;
      expect(c.officialUrl, `${code} officialUrl`).toMatch(/^https:\/\//);
      expect(c.officialUrl, `${code} officialUrl is a direct PDF`).not.toMatch(/\.pdf($|\?)/i);
    }
  });

  it('points every PDF at the department’s own host', () => {
    // These four serve the blank from a download endpoint rather than a .pdf
    // path. Listed explicitly so the check stays a check: a new entry with
    // some other extension has to be justified here first.
    const ENDPOINTS = ['GA', 'IN', 'MA'];
    for (const [code, c] of OWN_FORMS) {
      expect(c.pdfUrl, `${code} pdfUrl`).toMatch(/^https:\/\//);
      if (!ENDPOINTS.includes(code)) {
        expect(c.pdfUrl, `${code} pdfUrl is not a .pdf and is not a listed endpoint`).toMatch(/\.pdf$/i);
      }
    }
  });

  it('measured every blank, and Georgia is the only zero', () => {
    // ⚠ Guard A above. Do not relax this to `toBeGreaterThanOrEqual(0)`.
    // Eleven state blanks. The twelfth document verified for this ship is
    // SSTGB F0003, which is the header row above the grid rather than any one
    // jurisdiction's form, so it is measured on SST and not counted here.
    expect(OWN_FORM_COUNT).toBe(11);
    const zeros = OWN_FORMS.filter(([, c]) => c.fields === 0).map(([code]) => code);
    expect(zeros, 'a measurement pass has silently failed if this is not exactly [GA]').toEqual(['GA']);
    for (const [code, c] of OWN_FORMS) {
      expect(c.pages, `${code} pages`).toBeGreaterThan(0);
      expect(c.pages, `${code} pages looks like a whole instruction booklet`).toBeLessThan(10);
    }
    // 286 across the eleven blanks when measured, plus SST's 97 separately.
    // A floor rather than the exact number: a department can republish a
    // form with one more box, and the zeros check above is what actually
    // catches a failed measurement pass.
    expect(OWN_FORM_FIELDS).toBeGreaterThan(250);
  });

  it('prints a revision wherever the document prints one, and invents none', () => {
    // CDTFA-230 and Indiana's ST-105 carry no revision marker. Recording the
    // absence stops a later pass filling it with a guess.
    const NO_MARKER = ['CA', 'IN'];
    for (const [code, c] of OWN_FORMS) {
      if (NO_MARKER.includes(code)) {
        expect(c.revision, `${code} prints no revision marker on the document`).toBeUndefined();
      } else {
        expect(c.revision, `${code} revision`).toBeTruthy();
        expect(c.revision!.length, `${code} revision`).toBeGreaterThan(3);
      }
    }
  });

  it('explains every jurisdiction that has no blank to download', () => {
    const issued = Object.entries(OWN_CERTS).filter(([, c]) => c.kind === 'issued');
    const none = Object.entries(OWN_CERTS).filter(([, c]) => c.kind === 'none');
    expect(issued.map(([c]) => c).sort()).toEqual(['FL', 'LA']);
    expect(none.map(([c]) => c)).toEqual(['MS']);
    for (const [code, c] of [...issued, ...none]) {
      const prose = c.kind === 'issued' ? c.how : c.kind === 'none' ? c.why : '';
      expect(prose.length, `${code} needs a real explanation, not a label`).toBeGreaterThan(60);
    }
  });

  it('gives an unverified row no link to click', () => {
    // ⚠ Guard B above.
    const unverified = Object.entries(OWN_CERTS).filter(([, c]) => c.kind === 'unverified');
    expect(unverified.map(([c]) => c)).toEqual(['DC']);
    for (const [code, c] of unverified) {
      expect(Object.keys(c), `${code} must not carry a url`).not.toContain('officialUrl');
      expect(Object.keys(c), `${code} must not carry a url`).not.toContain('pdfUrl');
      expect((c as { why: string }).why.length).toBeGreaterThan(60);
    }
  });
});

describe('resale certificates — the nine the MTC form misses', () => {
  it('answers eight of nine, and names the one it cannot', () => {
    // The point of ship 2. Each MTC-absent taxing jurisdiction now resolves
    // through Streamlined membership, its own document, or a documented
    // reason there is no document.
    expect(NEEDS_OWN_FORM.length).toBe(9);
    const unanswered = NEEDS_OWN_FORM.filter((j) => !isSstMember(j.code) && !ownCert(j.code));
    expect(unanswered, 'every MTC-absent jurisdiction needs a route or a stated reason').toEqual([]);
    expect(STILL_UNANSWERED.map((j) => j.code)).toEqual(['DC']);
  });

  it('routes each of the nine through something a reader can act on', () => {
    for (const j of NEEDS_OWN_FORM) {
      const own = ownCert(j.code);
      const routed = isSstMember(j.code) || (own !== undefined && own.kind !== 'unverified');
      if (j.code === 'DC') expect(routed).toBe(false);
      else expect(routed, `${j.code} has no usable route`).toBe(true);
    }
  });
});

describe('resale certificates — an absent row promises no document', () => {
  // ⚠ Ship 1 wrote "Use <State>'s own." against all nine MTC-absent taxing
  // jurisdictions before any of those documents had been read. Four were
  // false. The verdict prose may now state only that the jurisdiction is
  // absent; the route comes from OWN_CERTS and SST_MEMBERS, where every
  // entry was read at source. This test is what stops the promise returning.
  it('states only the absence, and names no form in the verdict', () => {
    for (const j of byStatus('absent')) {
      expect(j.limit, `${j.code} has no verdict text`).toBeTruthy();
      expect(j.limit!, `${j.code} verdict points at an unverified document`).not.toMatch(
        /\bown\b|\bST-\d|\bForm \d|certificate of its/i,
      );
    }
  });

  it('routes the absent taxing jurisdictions from verified data only', () => {
    for (const j of byStatus('absent')) {
      if (!j.salesTax) {
        expect(ownCert(j.code), `${j.code} has no sales tax`).toBeUndefined();
        continue;
      }
      const own = ownCert(j.code);
      expect(
        isSstMember(j.code) || own !== undefined,
        `${j.code} taxes sales, is off the certificate, and has no verified route`,
      ).toBe(true);
    }
  });
});

describe('resale certificates — ship 2 prose stays on the document side', () => {
  const prose = [
    ...Object.entries(OWN_CERTS).flatMap(([code, c]) => {
      const bits = [c.kind === 'issued' ? c.how : c.kind === 'none' ? c.why : c.kind === 'unverified' ? c.why : c.name];
      return bits.map((t) => [`OWN_CERTS.${code}`, t] as const);
    }),
    ['SST.name', SST.name] as const,
  ];

  it('states no duty in any person', () => {
    for (const [where, text] of prose) {
      const breaches = adviceBreaches([text]);
      expect(breaches, `${where}: ${breaches.join(', ')}`).toEqual([]);
    }
  });

  it('and the guard would still bite', () => {
    // A guard nobody has seen fire is not a guard. Mississippi's note is the
    // realistic shape of the mistake: it is one verb away from a requirement.
    // ⚠ adviceBreaches takes an ARRAY. The first version of this suite passed
    // a bare string, which `for (const s of strings)` then iterated as
    // CHARACTERS — no pattern can match a single character, so the clean-prose
    // check above passed while testing nothing. This line is what caught it.
    expect(adviceBreaches(['The buyer must show a permit the department issued.']).length).toBeGreaterThan(0);
  });
});
