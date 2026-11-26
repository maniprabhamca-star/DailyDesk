import { describe, expect, it } from 'vitest';
import { adviceBreaches } from './_advice-vocabulary';
import { INDIA_FORMS, FORM_GROUPS, getForm, INDIA_SEO } from '@/lib/india-forms';
import { catalog } from '@/components/app/catalog';

// This family carries a risk none of the others do: it makes statements about
// the law. A tool page that goes stale is annoying; a form page that states last
// year's deadline as fact sends someone to file the wrong thing, and they find
// out months later. These tests hold the two rules that keep that from happening
// — never state a date as fact, and never host the form ourselves.

const TOOL_NAMES = new Set(catalog.flatMap((g) => g.tools).map((t) => t.name));
const TITLE_BUDGET = 60; // `${short} — What It Is & Who Files It | DiemDesk`

describe('India forms library', () => {
  it('has a unique, url-safe slug per form', () => {
    const seen = new Map<string, string>();
    for (const f of INDIA_FORMS) {
      expect(f.slug, `${f.name}: "${f.slug}" is not url-safe`).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
      expect(seen.get(f.slug), `slug "${f.slug}" is used twice`).toBeUndefined();
      seen.set(f.slug, f.name);
      expect(getForm(f.slug)).toBeDefined();
    }
  });

  it('keeps the generated title inside its budget', () => {
    for (const f of INDIA_FORMS) {
      const title = `${f.short} — What It Is & Who Files It | DiemDesk`;
      expect(title.length, `${f.name}: title is ${title.length} chars`).toBeLessThanOrEqual(TITLE_BUDGET);
    }
  });

  it('never hosts the form itself — the link goes to the authority', () => {
    // Government forms are revised without notice. A copy served from our domain
    // is worse than no copy, because it looks current.
    //
    // An allowlist rather than a ".gov.in suffix" rule, because that rule was
    // wrong on its first real test: the Reserve Bank of India is rbi.org.in, and
    // it is unambiguously the authority. Naming the hosts keeps the check strict
    // where it matters — the point is that the link leaves our domain for a body
    // that actually issues the form.
    const AUTHORITIES = [
      'incometax.gov.in',
      'gst.gov.in',
      // The EPFO moved. `epfo.gov.in` was launched as its homepage on the
      // organisation's 73rd Foundation Day (1 Nov 2025, per PIB) and
      // `epfindia.gov.in` now redirects there — our published https link to the
      // old host was resetting the connection outright, which is how
      // verify:india-forms found it. The old host is kept on this list because
      // the UAN member and employer portals still live under it
      // (unifiedportal-*.epfindia.gov.in), so it is still an authority host;
      // what changed is which one we send a reader to first.
      'epfo.gov.in',
      'epfindia.gov.in',
      'uidai.gov.in',
      'mca.gov.in',
      'rbi.org.in',
    ];
    for (const f of INDIA_FORMS) {
      expect(f.officialUrl, `${f.name}: officialUrl must be https`).toMatch(/^https:\/\//);
      const host = new URL(f.officialUrl).hostname.replace(/^www\./, '');
      expect(
        AUTHORITIES.includes(host),
        `${f.name}: ${host} is not a known issuing authority — add it here only if it genuinely issues the form`,
      ).toBe(true);
      expect(f.officialUrl.toLowerCase().endsWith('.pdf'), `${f.name}: link to the page, not a PDF that will go stale`).toBe(false);
    }
  });

  it('never states a deadline as a hard date', () => {
    // The `when` field is the most dangerous sentence on the page. It has to
    // hedge and point at the portal, because these dates move every year and are
    // extended more often than not.
    const hedges = /generally|usually|typically|notified|each year|annually|published|check|confirm|depend|differ|any time|after|subject to/i;
    for (const f of INDIA_FORMS) {
      expect(hedges.test(f.when), `${f.name}: "when" reads as a fixed rule`).toBe(true);
      // A concrete calendar date is exactly what must not be asserted.
      expect(
        /\b(31st|15th|30th|31|15|30)\s+(january|february|march|april|may|june|july|august|september|october|november|december)\b/i.test(f.when),
        `${f.name}: "when" names a specific date — it will be wrong next year`,
      ).toBe(false);
    }
  });

  it('says something specific enough to be worth the page', () => {
    for (const f of INDIA_FORMS) {
      for (const field of ['what', 'who', 'when', 'gotcha'] as const) {
        const words = f[field].trim().split(/\s+/).length;
        expect(words, `${f.name}: "${field}" is only ${words} words`).toBeGreaterThanOrEqual(12);
      }
    }
  });

  it('gives every form its OWN gotcha', () => {
    // The gotcha is the reason anyone would link to the page. Two forms sharing
    // one means one of them is filler.
    const seen = new Map<string, string>();
    for (const f of INDIA_FORMS) {
      expect(seen.get(f.gotcha), `${f.name} and ${seen.get(f.gotcha)} share a gotcha`).toBeUndefined();
      seen.set(f.gotcha, f.name);
    }
  });

  it('links only tools that exist, by their exact catalogue name', () => {
    for (const f of INDIA_FORMS) {
      expect(f.tools.length, `${f.name}: no tools listed`).toBeGreaterThanOrEqual(3);
      for (const t of f.tools) {
        expect(TOOL_NAMES.has(t), `${f.name}: "${t}" is not a catalogue tool name`).toBe(true);
      }
    }
  });

  it('groups every form under a heading the index renders', () => {
    for (const f of INDIA_FORMS) {
      expect(FORM_GROUPS.includes(f.group), `${f.name}: group "${f.group}" is not in FORM_GROUPS`).toBe(true);
    }
    expect(FORM_GROUPS.length).toBeGreaterThan(1);
  });
});

// ───────────────────────────────────────────────────────────────────────────
// Search titles — the contract that replaced the template.
// ───────────────────────────────────────────────────────────────────────────
//
// Written after the 2026-11-25 Search Console export showed this library
// drawing 1,186 impressions (54% of the whole site) at average position 47.7
// for one click. The cause was one shared title string, and the clearest
// symptom was `/india-forms/epf-form-19` — 241 impressions, the biggest page
// on the site — titled "Form 19" while every query that reached it said
// "epf form 19", "pf form 19" or "form 19 in epfo".
//
// The guards below are the ones that would have caught that.

describe('India forms — per-form search titles', () => {
  it('every form has one, so nothing silently falls back to a template', () => {
    for (const f of INDIA_FORMS) {
      expect(INDIA_SEO[f.slug], `${f.slug} has no SEO entry`).toBeTruthy();
    }
    // And no entry for a form that does not exist.
    const slugs = new Set(INDIA_FORMS.map((f) => f.slug));
    for (const k of Object.keys(INDIA_SEO)) {
      expect(slugs.has(k), `INDIA_SEO has '${k}', which is not a form`).toBe(true);
    }
  });

  it('⚠ no two forms share a title or a description', () => {
    // THE regression guard. A template passes every other check in this file
    // and fails this one, because 32 pages would carry 32 identical strings.
    const titles = Object.values(INDIA_SEO).map((s) => s.title);
    const descs = Object.values(INDIA_SEO).map((s) => s.description);
    expect(new Set(titles).size, 'duplicate titles').toBe(titles.length);
    expect(new Set(descs).size, 'duplicate descriptions').toBe(descs.length);
  });

  it('⚠ an EPF form names EPF or PF in its title', () => {
    // The specific defect. /india-forms/epf-form-19 was titled "Form 19" while
    // its traffic came from "epf form 19" and "pf form 19". `short` is the
    // index label and drops the qualifier; it must never reach a title alone.
    for (const f of INDIA_FORMS.filter((x) => x.slug.startsWith('epf-'))) {
      const t = INDIA_SEO[f.slug].title;
      expect(/\b(EPF|PF)\b/.test(t), `${f.slug} title omits EPF/PF: "${t}"`).toBe(true);
    }
  });

  it('a title carries the form the page is about', () => {
    // `short` is sometimes a pair rather than a name — "FATCA / CRS" — so the
    // check is that every substantive part of the label appears, not that the
    // label appears verbatim. Matching verbatim would force the title to read
    // "FATCA / CRS", which is not a phrase anybody searches.
    for (const f of INDIA_FORMS) {
      const t = INDIA_SEO[f.slug].title.toLowerCase();
      const parts = f.short
        .toLowerCase()
        .split('/')
        .map((p) => p.trim())
        .filter(Boolean);
      for (const part of parts) {
        const core = part.replace(/^(form|gstr|itr)\s*/, '');
        expect(
          t.includes(part) || (core.length > 1 && t.includes(core)),
          `${f.slug}: title "${INDIA_SEO[f.slug].title}" does not name "${part}"`,
        ).toBe(true);
      }
    }
  });

  it('fits the SERP budgets', () => {
    for (const [slug, s] of Object.entries(INDIA_SEO)) {
      expect(s.title.length, `${slug} title is ${s.title.length}: "${s.title}"`).toBeLessThanOrEqual(60);
      expect(s.title.length, `${slug} title is too short`).toBeGreaterThan(20);
      expect(s.description.length, `${slug} description is ${s.description.length}`).toBeLessThanOrEqual(155);
      expect(s.description.length, `${slug} description is too short`).toBeGreaterThan(110);
    }
  });

  it('carries no brand suffix, which the budget cannot afford yet', () => {
    // Deliberate: see the note on INDIA_SEO. Revisit when the brand is
    // actually searched for — today the only brand query in the export is
    // "dimesk", misspelled, with 2 impressions.
    for (const [slug, s] of Object.entries(INDIA_SEO)) {
      expect(s.title.includes('DiemDesk'), `${slug} spends 11 characters on the brand`).toBe(false);
    }
  });

  it('states no duty — the advice boundary applies to titles too', () => {
    const copy = Object.values(INDIA_SEO).flatMap((s) => [s.title, s.description]);
    const breaches = adviceBreaches(copy);
    expect(breaches, breaches.join('\n')).toEqual([]);
  });
});
