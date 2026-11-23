import { describe, expect, it } from 'vitest';
import { matchesForm, type FormHit } from '@/lib/form-search';
import { US_FORMS } from '@/lib/us-forms';
import { INDIA_FORMS } from '@/lib/india-forms';

// The ⌘K palette is the only way to reach a form page by typing its number, and
// a matcher that is wrong here fails SILENTLY — the palette says "No matches"
// and nothing else in the suite notices. The first version of this shipped past
// a clean build and 350 green tests, so the rule is now a test: every form in
// both libraries must be findable by the way people actually write its number.

const rows: FormHit[] = [
  ...US_FORMS.map((f) => ({ s: f.short, n: f.name, a: f.aka ?? '', g: 'US federal forms', h: `/us-forms/${f.slug}` })),
  ...INDIA_FORMS.map((f) => ({ s: f.short, n: f.name, a: f.aka ?? '', g: 'Indian forms', h: `/india-forms/${f.slug}` })),
];
const find = (q: string) => rows.filter((r) => matchesForm(r, q));

describe('form search', () => {
  it('finds every form by its number exactly as printed', () => {
    for (const r of rows) {
      expect(find(r.s).includes(r), `"${r.s}" does not find itself`).toBe(true);
    }
  });

  it('finds every form with the punctuation left out', () => {
    // Nobody types the hyphen. "w9", "i485", "1099nec" must all work, which
    // only happens if the separators come off the FORM NAME too, not just the
    // query — that was the bug.
    for (const r of rows) {
      const bare = r.s.replace(/[^A-Za-z0-9]/g, '');
      if (bare.length < 2) continue;
      expect(find(bare).includes(r), `"${bare}" does not find ${r.n}`).toBe(true);
    }
  });

  it('is case-insensitive and ignores surrounding spaces', () => {
    const w9 = rows.find((r) => r.s === 'W-9')!;
    for (const q of ['W-9', 'w-9', 'w9', 'W9', '  w9  ', 'form w-9']) {
      expect(find(q).includes(w9), `"${q}" does not find Form W-9`).toBe(true);
    }
  });

  it('matches the plain-English name as well as the number', () => {
    // Half of all searches will be words, not numbers: "green card", "pan".
    expect(find('taxpayer identification').length, 'no form matches "taxpayer identification"').toBeGreaterThan(0);
  });

  it('returns nothing for an empty or whitespace query', () => {
    // The palette only reaches the matcher once something is typed; if that
    // ever changes, an empty query must not dump 60-odd forms into the list.
    for (const q of ['', '   ']) expect(find(q).length, `"${q}" matched something`).toBe(0);
  });

  it('does not match a single stray character', () => {
    // A one-character bare query would collapse to a substring of almost every
    // form number. The 2-character floor is what stops that.
    const junk = rows.filter((r) => matchesForm(r, '-'));
    expect(junk.length, '"-" matched forms').toBe(0);
  });
});
