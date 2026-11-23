import { describe, expect, it } from 'vitest';
import { US_FORMS, US_FORM_GROUPS, CHECKED_ON, CHECKED_ON_LABEL, getUsForm, revisionSentence, revisionHeading } from '@/lib/us-forms';
import type { UsForm } from '@/lib/us-forms';
import { catalog } from '@/components/app/catalog';

// Same risk as the India library, one notch higher: these pages state a form's
// REVISION, which is a verifiable claim about a federal document. If it drifts
// and we keep asserting it, we become the thing we are criticising — pdf.net's
// pages wear an "Official IRS form" badge and link to irs.gov zero times.
//
// So: the eight rules the India set already runs on, plus revision contract
// checks. `npm run verify:us-forms` does the live half (comparing every
// `revision` against the IRS product table); these are the offline half, and
// they run in CI on every commit.

const TOOL_NAMES = new Set(catalog.flatMap((g) => g.tools).map((t) => t.name));
const TITLE_BUDGET = 60; // `Fill Form ${short} Free — Nothing Uploaded | DiemDesk`

describe('US forms library', () => {
  it('has a unique, url-safe slug per form', () => {
    const seen = new Map<string, string>();
    for (const f of US_FORMS) {
      expect(f.slug, `${f.name}: "${f.slug}" is not url-safe`).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
      expect(seen.get(f.slug), `slug "${f.slug}" is used twice`).toBeUndefined();
      seen.set(f.slug, f.name);
      expect(getUsForm(f.slug)).toBeDefined();
    }
  });

  it('keeps the generated title inside its budget', () => {
    for (const f of US_FORMS) {
      const title = `Fill Form ${f.short} Free — Nothing Uploaded | DiemDesk`;
      expect(title.length, `${f.name}: title is ${title.length} chars`).toBeLessThanOrEqual(TITLE_BUDGET);
    }
  });

  it('never hosts the form itself — the link goes to the authority', () => {
    // An allowlist rather than a ".gov suffix" rule: the suffix rule would pass
    // any state or municipal site, and these are federal forms with named
    // issuers. Add a host here only when it genuinely issues one of the forms.
    const AUTHORITIES = ['irs.gov', 'uscis.gov', 'ssa.gov', 'dol.gov', 'va.gov', 'state.gov'];
    for (const f of US_FORMS) {
      expect(f.officialUrl, `${f.name}: officialUrl must be https`).toMatch(/^https:\/\//);
      const host = new URL(f.officialUrl).hostname.replace(/^www\./, '');
      expect(
        AUTHORITIES.includes(host),
        `${f.name}: ${host} is not a known issuing authority — add it here only if it genuinely issues the form`,
      ).toBe(true);
      // The point of the rule: a PDF link goes stale silently, a page does not.
      expect(
        new URL(f.officialUrl).pathname.toLowerCase().endsWith('.pdf'),
        `${f.name}: link to the authority's page, not to a PDF that will go stale`,
      ).toBe(false);
      expect(
        f.officialUrl.includes('/pub/irs-pdf/'),
        `${f.name}: /pub/irs-pdf/ is the raw file — link to the form's page instead`,
      ).toBe(false);
    }
  });

  it('never states a deadline as a hard date', () => {
    // Filing dates move and are extended. The `when` field has to hedge and
    // point at the authority. Both date orders are checked, because this set is
    // written for an audience that writes "April 15" rather than "15 April".
    const hedges = /generally|usually|typically|normally|commonly|most|check|confirm|depend|whenever|any time|as soon|before|after|each year|annually|while/i;
    const MONTHS = 'january|february|march|april|may|june|july|august|september|october|november|december';
    const dateish = new RegExp(`\\b(\\d{1,2}(st|nd|rd|th)?\\s+(${MONTHS})|(${MONTHS})\\s+\\d{1,2}\\b)`, 'i');
    for (const f of US_FORMS) {
      expect(hedges.test(f.when), `${f.name}: "when" reads as a fixed rule`).toBe(true);
      expect(dateish.test(f.when), `${f.name}: "when" names a specific date — it will be wrong next year`).toBe(false);
    }
  });

  it('says something specific enough to be worth the page', () => {
    for (const f of US_FORMS) {
      for (const field of ['what', 'who', 'when', 'gotcha', 'sensitive'] as const) {
        const words = f[field].trim().split(/\s+/).length;
        expect(words, `${f.name}: "${field}" is only ${words} words`).toBeGreaterThanOrEqual(12);
      }
    }
  });

  it('gives every form its OWN gotcha and its own sensitive-data line', () => {
    // The gotcha is the reason anyone would link to the page; the sensitive
    // line is the reason the page is on a privacy-first site. Two forms sharing
    // either one means one of them is filler.
    for (const field of ['gotcha', 'sensitive'] as const) {
      const seen = new Map<string, string>();
      for (const f of US_FORMS) {
        expect(seen.get(f[field]), `${f.name} and ${seen.get(f[field])} share a ${field}`).toBeUndefined();
        seen.set(f[field], f.name);
      }
    }
  });

  it('links only tools that exist, by their exact catalogue name', () => {
    for (const f of US_FORMS) {
      expect(f.tools.length, `${f.name}: no tools listed`).toBeGreaterThanOrEqual(3);
      // Every form here IS a fillable PDF — that is the whole premise, so the
      // fill tool has to be one of the links.
      expect(f.tools, `${f.name}: must link Fill PDF form`).toContain('Fill PDF form');
      for (const t of f.tools) {
        expect(TOOL_NAMES.has(t), `${f.name}: "${t}" is not a catalogue tool name`).toBe(true);
      }
    }
  });

  it('groups every form under a heading the index renders', () => {
    for (const f of US_FORMS) {
      expect(US_FORM_GROUPS.includes(f.group), `${f.name}: group "${f.group}" is not in US_FORM_GROUPS`).toBe(true);
    }
    expect(US_FORM_GROUPS.length).toBeGreaterThan(1);
  });

  // ── the rule this family adds ────────────────────────────────────────────────
  it('states a plausible revision, a measured field count and a page count', () => {
    // These are the claims that make the page better than a copy hosted without
    // provenance, so they have to be present and shaped like real values.
    // `npm run verify:us-forms` checks them against the IRS itself.
    const YEAR_NOW = new Date().getFullYear();
    for (const f of US_FORMS) {
      // Five agencies, five ways of marking a version. The shape has to match
      // the label, because "Rev. 04/01/24" would be the IRS's word on USCIS's
      // value and neither agency would recognise it.
      const SHAPES: Record<UsForm['revisionLabel'], RegExp> = {
        'Rev.': /^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) \d{4}$/, // Mar 2024
        'Form year': /^\d{4}$/,                                              // 2026
        'Edition date': /^\d{2}\/\d{2}\/\d{2}$/,                            // 04/01/24
        Revised: /^[A-Z][a-z]+ \d{4}$/,                                      // June 2020
        'Form date': /^((\d{2}-\d{4})|((Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) \d{4}))$/, // 12-2024 or Jan 2026
      };
      expect(
        SHAPES[f.revisionLabel],
        `${f.name}: revisionLabel "${f.revisionLabel}" has no known shape`,
      ).toBeDefined();
      expect(
        f.revision,
        `${f.name}: revision "${f.revision}" does not look like a ${f.revisionLabel} value`,
      ).toMatch(SHAPES[f.revisionLabel]);

      const y = f.revision.match(/\d{4}/);
      const year = y ? Number(y[0]) : 2000 + Number(f.revision.slice(-2));
      expect(year, `${f.name}: revision year ${year} is implausible`).toBeGreaterThanOrEqual(2015);
      expect(year, `${f.name}: revision year ${year} is in the future`).toBeLessThanOrEqual(YEAR_NOW + 1);

      expect(Number.isInteger(f.fields), `${f.name}: fields must be a measured integer`).toBe(true);
      expect(f.fields, `${f.name}: a fillable form with no fields is not fillable`).toBeGreaterThan(0);
      expect(Number.isInteger(f.pages) && f.pages > 0, `${f.name}: pages must be a measured integer`).toBe(true);
    }
  });

  it('points /api/forms at the agency’s own PDF, on an allowlisted host', () => {
    // pdfUrl is the ONE place a URL leaves our control, and the route handler
    // fetches it server-side. There is no SSRF surface because the caller
    // supplies a slug, not a URL — but a typo here would still have the server
    // fetching somewhere unintended, so the list is checked.
    const ALLOWED = ['www.irs.gov', 'www.uscis.gov', 'www.ssa.gov', 'www.dol.gov', 'www.vba.va.gov', 'www.va.gov'];
    for (const f of US_FORMS) {
      const u = new URL(f.pdfUrl);
      expect(u.protocol, `${f.name}: pdfUrl must be https`).toBe('https:');
      expect(ALLOWED.includes(u.hostname), `${f.name}: ${u.hostname} is not an allowlisted agency host`).toBe(true);
      expect(u.pathname.toLowerCase().endsWith('.pdf'), `${f.name}: pdfUrl must point at a PDF`).toBe(true);
      // The human page and the file are different things, and conflating them
      // is how a reader ends up downloading a form with no context.
      expect(f.pdfUrl, `${f.name}: pdfUrl and officialUrl must not be the same`).not.toBe(f.officialUrl);
    }
  });

  it('phrases the version marker in the agency’s own words', () => {
    for (const f of US_FORMS) {
      const sentence = revisionSentence(f);
      expect(sentence, `${f.name}: revision sentence must quote the value`).toContain(f.revision);
      // "The rev. the IRS publishes today" is not English. The clause has to
      // read as a sentence, which means it never just interpolates the label.
      expect(sentence.toLowerCase(), `${f.name}: sentence reads as a raw label`).not.toContain('the rev. ');
      expect(revisionHeading(f), `${f.name}: strip heading must not end in a dot`).not.toMatch(/\.$/);
    }
    // USCIS editions are the case that matters most: a superseded edition is
    // rejected outright, and the page has to say so.
    for (const f of US_FORMS.filter((x) => x.revisionLabel === 'Edition date')) {
      expect(revisionSentence(f).toLowerCase(), `${f.name}: must warn that an old edition is rejected`).toContain('rejected');
    }
  });

  it('says when every revision was last verified', () => {
    // Without this date the revision is an assertion. With it, it is a claim
    // with a timestamp a reader can weigh.
    expect(CHECKED_ON, 'CHECKED_ON must be an ISO date').toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(Number.isNaN(Date.parse(CHECKED_ON)), 'CHECKED_ON is not a real date').toBe(false);
    expect(Date.parse(CHECKED_ON), 'CHECKED_ON is in the future').toBeLessThanOrEqual(Date.now() + 864e5);
  });

  it('renders the verification date as the day it actually is', () => {
    // `new Date('2026-11-23').toLocaleDateString()` renders the 22nd anywhere
    // west of UTC, because the bare date parses as UTC midnight. That shipped
    // once. A verification date off by one discredits the only thing it is
    // there to establish, so the label is built from the parts and checked here.
    // Round-trip: read the prose back and it must be the same calendar day.
    const back = new Date(CHECKED_ON_LABEL);
    expect(Number.isNaN(back.getTime()), `label "${CHECKED_ON_LABEL}" does not parse`).toBe(false);
    const iso = `${back.getFullYear()}-${String(back.getMonth() + 1).padStart(2, '0')}-${String(back.getDate()).padStart(2, '0')}`;
    expect(iso, `label "${CHECKED_ON_LABEL}" is not the day CHECKED_ON names`).toBe(CHECKED_ON);
  });
});
