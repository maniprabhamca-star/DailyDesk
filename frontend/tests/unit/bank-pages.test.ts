import { describe, expect, it } from 'vitest';
import { BANK_PAGES } from '@/lib/bank-statements';

// These pages exist to rank, and a set of generated pages only ranks while each
// one says something the others do not. The family went 11 → 39 in one sitting,
// which is exactly the moment a template starts producing near-duplicates — the
// same thing that put the passport pages into Search Console's "Duplicate
// without user-selected canonical" report.
//
// So: uniqueness is enforced, not hoped for.

const TITLE_BUDGET = 60;  // `${short} Statement PDF to Excel — Free | DiemDesk`
const DESC_BUDGET = 165;  // the generated description in the page's metadata

describe('bank statement pages', () => {
  it('has a unique slug per bank', () => {
    const seen = new Map<string, string>();
    for (const b of BANK_PAGES) {
      expect(seen.get(b.slug), `slug "${b.slug}" is used by ${seen.get(b.slug)} and ${b.name}`).toBeUndefined();
      seen.set(b.slug, b.name);
    }
  });

  it('uses url-safe slugs', () => {
    for (const b of BANK_PAGES) {
      expect(b.slug, `${b.name}: "${b.slug}"`).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
    }
  });

  it('keeps the generated title inside its budget', () => {
    for (const b of BANK_PAGES) {
      const title = `${b.short} Statement PDF to Excel — Free | DiemDesk`;
      expect(title.length, `${b.name}: "${title}" is ${title.length} chars`).toBeLessThanOrEqual(TITLE_BUDGET);
    }
  });

  it('keeps the generated description inside its budget', () => {
    for (const b of BANK_PAGES) {
      const desc = `Convert your ${b.short} statement PDF to Excel, CSV or Tally — every row checked against the running balance. Read in your browser; never uploaded.`;
      expect(desc.length, `${b.name}: description is ${desc.length} chars`).toBeLessThanOrEqual(DESC_BUDGET);
    }
  });

  it('tells the reader how to get the statement', () => {
    for (const b of BANK_PAGES) {
      expect(b.download.length, `${b.name}: only ${b.download.length} download steps`).toBeGreaterThanOrEqual(3);
      for (const step of b.download) {
        expect(step.trim().length, `${b.name}: a download step is too short`).toBeGreaterThan(15);
      }
    }
  });

  it('gives every bank its OWN quirk and password guidance', () => {
    // The two fields that carry the page's whole reason to exist. If two banks
    // share either one, one of those pages is filler.
    for (const field of ['quirk', 'password'] as const) {
      const seen = new Map<string, string>();
      for (const b of BANK_PAGES) {
        const text = b[field].trim();
        expect(
          seen.get(text),
          `${b.name} and ${seen.get(text)} share the same ${field} text`,
        ).toBeUndefined();
        seen.set(text, b.name);
      }
    }
  });

  it('writes password guidance as guidance, never as a hard rule', () => {
    // Banks change password formats without telling anyone. Stating one as fact
    // is how a page becomes wrong six months after it was written, so the copy
    // has to hedge and point at the covering email.
    const hedges = /commonly|usually|often|may |can be|the covering email|as stated|as described|as given|as set out/i;
    for (const b of BANK_PAGES) {
      expect(hedges.test(b.password), `${b.name}: password copy states a format as fact`).toBe(true);
    }
  });

  it('says the file is unlocked on the reader’s own device', () => {
    // The whole sell. A statement is the most private document most people own;
    // if the page does not say where the unlocking happens, it is not selling.
    for (const b of BANK_PAGES) {
      const saysLocal = /on your device|locally|without uploading|never uploaded/i.test(b.password);
      expect(saysLocal, `${b.name}: password copy never says the file stays on the device`).toBe(true);
    }
  });

  it('does not carry pages for institutions that no longer serve these accounts', () => {
    // Paytm Payments Bank's licence was cancelled by the RBI on 2026-04-24 and
    // Citi India's consumer business moved to Axis in 2024. Pages telling people
    // to log in and download would be actively wrong. If either is ever added,
    // this fails and whoever added it has to justify the copy.
    const retired = ['paytm', 'citi', 'citibank'];
    for (const b of BANK_PAGES) {
      for (const r of retired) {
        expect(
          b.slug.includes(r),
          `${b.slug}: ${r} no longer serves these accounts — see the comment in bank-statements.ts`,
        ).toBe(false);
      }
    }
  });
});
