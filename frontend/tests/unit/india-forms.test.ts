import { describe, expect, it } from 'vitest';
import { INDIA_FORMS, FORM_GROUPS, getForm } from '@/lib/india-forms';
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
