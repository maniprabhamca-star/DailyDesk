import { describe, expect, it } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';

// Several page families name somebody else — a regulator, a bank, a tax agency,
// a government that publishes a photo specification. Every one of those names
// is there to describe what a tool does, and none of them implies a
// relationship. Being mistaken for an official or endorsed service is the kind
// of problem that is cheap to prevent and expensive to discover.
//
// The sector pages and the passport country pages shipped without the notice
// the bank pages and the forms libraries already had, which is exactly how this
// drifts: nobody is against the sentence, it just does not get written on the
// next family. So the rule is a test.
//
// Add a page here when it names a third party. Do NOT remove one to make the
// test pass.

const MUST_CARRY_NOTICE = [
  // sector pages — cite statutes, regulators and professional bodies
  'app/for/[sector]/page.tsx',
  // passport/visa pages — quote government photo specifications per country
  'app/passport-photo/page.tsx',
  'app/passport-photo/[country]/page.tsx',
  // bank statement pages — name banks
  'app/bank-statement-converter/page.tsx',
  'app/bank-statement-converter/[bank]/page.tsx',
  // forms libraries — name the IRS, USCIS and the Indian tax authorities
  'app/forms/page.tsx',
  'app/us-forms/page.tsx',
  'app/us-forms/[form]/page.tsx',
  'app/india-forms/page.tsx',
  'app/india-forms/[form]/page.tsx',
  // the resale-certificate matrix — names the Multistate Tax Commission, the
  // Streamlined Sales Tax Governing Board and all 51 revenue departments
  'app/resale-certificates/page.tsx',
  // competitor comparisons
  'app/compare/page.tsx',
  'components/marketing/alternative-page.tsx',
];

// Either the shared component or the equivalent sentence written inline. Both
// are fine; silence is not.
const HAS_NOTICE = /ThirdPartyNotice|not affiliated with|no affiliation/;

describe('third-party non-affiliation notice', () => {
  it('appears on every page family that names somebody else', () => {
    for (const rel of MUST_CARRY_NOTICE) {
      expect(existsSync(rel), `${rel} does not exist — fix this list, do not delete the entry`).toBe(true);
      const src = readFileSync(rel, 'utf8');
      expect(
        HAS_NOTICE.test(src),
        `${rel} names a third party but carries no non-affiliation notice. Use <ThirdPartyNotice> from components/app/third-party-notice.`,
      ).toBe(true);
    }
  });

  it('states the three things that actually matter, not just "not affiliated"', () => {
    // "Not affiliated" on its own reads as boilerplate. The notice has to also
    // say WHY the name is there and WHAT we are instead, which is the part that
    // answers the reader's real question.
    const src = readFileSync('components/app/third-party-notice.tsx', 'utf8');
    expect(src, 'must disclaim affiliation').toMatch(/not affiliated with, endorsed by, or connected to/);
    expect(src, 'must explain what DiemDesk actually is').toMatch(/general-purpose document tools/);
    expect(src, 'must take the reason the name appears from the page').toMatch(/\{because\}/);
  });
});

describe('third-party notice — the reason clause is a clause', () => {
  // The component supplies the sentence around `because`:
  //   "DiemDesk is not affiliated with <subject>. {because}. DiemDesk is ..."
  // So a lowercase fragment renders after a full stop, and a value with its
  // own full stop renders a double one. Both look like someone was careless
  // on exactly the sentence where care is the point.
  const BECAUSE = /because=(?:"([^"]+)"|\{`([^`]+)`\})/g;

  it('is capitalised and carries no terminal full stop, everywhere', () => {
    let checked = 0;
    for (const rel of MUST_CARRY_NOTICE) {
      const src = readFileSync(rel, 'utf8');
      for (const m of src.matchAll(BECAUSE)) {
        const raw = (m[1] ?? m[2]).trim();
        // A template literal may open with ${...}; its casing is not ours to judge.
        const value = raw.replace(/\s+/g, ' ');
        checked += 1;
        if (!value.startsWith('${')) {
          expect(
            /^[A-Z]/.test(value),
            `${rel}: because="${value.slice(0, 60)}…" must read as a sentence, not a fragment — the component puts a full stop in front of it`,
          ).toBe(true);
        }
        expect(
          value.endsWith('.'),
          `${rel}: because="…${value.slice(-50)}" ends with a full stop, and the component adds one`,
        ).toBe(false);
      }
    }
    // A loop that found nothing would pass this whole test silently.
    expect(checked, 'no because= values were found — the pattern has drifted').toBeGreaterThan(5);
  });
});
