import { describe, it, expect } from 'vitest';
import { PRO_PRICE, BUSINESS_PRICE, STATEMENT_PRICE, STATEMENT_PAGES, AI_ACTIONS } from '@/lib/currency';
import { PRICING } from '@/lib/pricing';
import { PLAN_ORDER } from '@/lib/plan';

// The price tables are the single source of truth for three surfaces that can
// drift apart silently: the /pricing page, the statement quota endpoint, and the
// copy in PRICING. Two of those are in different languages on different machines
// and nothing else makes them agree.
//
// This file also pins the DECISIONS in docs/designs/business-tier-pricing.html
// that are cheap to reverse by accident and expensive to reverse after someone
// has paid — above all that Business must not be cheaper than Pro and that
// Statements Pro's published $19 is the number Business inherits.

const CURRENCIES = ['USD', 'INR'] as const;

describe('pricing tiers', () => {
  it('has a price for every paid tier, in every currency', () => {
    for (const c of CURRENCIES) {
      for (const [name, p] of [['Pro', PRO_PRICE[c]], ['Business', BUSINESS_PRICE[c]]] as const) {
        expect(p.monthly, `${name}/${c}: monthly must be a positive number`).toBeGreaterThan(0);
        expect(p.annual, `${name}/${c}: annual must be a positive number`).toBeGreaterThan(0);
        expect(
          p.annual,
          `${name}/${c}: the annual plan must cost LESS than twelve monthly charges, or nobody has a reason to take it`,
        ).toBeLessThan(p.monthly * 12);
        // The headline "$X/mo billed yearly" must be the annual divided by 12,
        // to the precision that currency is actually DISPLAYED in — a figure
        // typed by hand drifts, but demanding more precision than the page can
        // show would fail on a correct number. INR renders in whole rupees
        // (fmtAmount rounds), so ₹4,999/12 = ₹416.58 is published as ₹417 and
        // that is right, not a typo. USD renders to the cent.
        const tolerance = c === 'INR' ? 1 : 0.01;
        expect(
          Math.abs(p.annualPerMonth - p.annual / 12),
          `${name}/${c}: annualPerMonth (${p.annualPerMonth}) is not annual/12 (${(p.annual / 12).toFixed(2)}) ` +
            `within the ${c} display precision`,
        ).toBeLessThanOrEqual(tolerance);
      }
    }
  });

  it('prices Business above Pro — in both currencies', () => {
    for (const c of CURRENCIES) {
      expect(
        BUSINESS_PRICE[c].monthly,
        `${c}: Business must cost more than Pro — it is a superset of it`,
      ).toBeGreaterThan(PRO_PRICE[c].monthly);
      expect(BUSINESS_PRICE[c].annual).toBeGreaterThan(PRO_PRICE[c].annual);
    }
  });

  it('inherits the price Statements Pro already published', () => {
    // The whole argument for the tier is that NO published price goes up:
    // Statements Pro becomes Business and absorbs Pro at the same number. If
    // these ever diverge, somebody has quietly raised a live price.
    for (const c of CURRENCIES) {
      expect(
        BUSINESS_PRICE[c].monthly,
        `${c}: Business monthly must equal the published Statements Pro price`,
      ).toBe(STATEMENT_PRICE[c].proMonthly);
      expect(
        STATEMENT_PAGES.business,
        'Business must include the page allowance Statements Pro already promised',
      ).toBe(STATEMENT_PRICE[c].proPages);
      expect(STATEMENT_PAGES.free, `${c}: the free page allowance is published`).toBe(STATEMENT_PRICE[c].freePages);
    }
  });

  it('costs less than buying both — because that is the reason it exists', () => {
    for (const c of CURRENCIES) {
      const both = PRO_PRICE[c].monthly + STATEMENT_PRICE[c].proMonthly;
      expect(
        BUSINESS_PRICE[c].monthly,
        `${c}: Business (${BUSINESS_PRICE[c].monthly}) must be cheaper than Pro + Statements Pro (${both}), ` +
          'or it is a surcharge rather than a plan',
      ).toBeLessThan(both);
    }
  });

  it('raises every allowance with the tier, and never lowers one', () => {
    const tiers = ['free', 'pro', 'business'] as const;
    for (const table of [STATEMENT_PAGES, AI_ACTIONS]) {
      for (let i = 1; i < tiers.length; i++) {
        expect(
          table[tiers[i]],
          `${tiers[i]} must get at least as much as ${tiers[i - 1]}`,
        ).toBeGreaterThanOrEqual(table[tiers[i - 1]]);
      }
    }
    // And each table must cover every tier the app knows about.
    for (const p of PLAN_ORDER) {
      expect(STATEMENT_PAGES, `STATEMENT_PAGES is missing the "${p}" tier`).toHaveProperty(p);
      expect(AI_ACTIONS, `AI_ACTIONS is missing the "${p}" tier`).toHaveProperty(p);
    }
  });

  it('writes the Business list as an extension of Pro, not a different product', () => {
    const f = PRICING.businessFeatures;
    expect(f.length, 'a tier with three bullets does not look like a plan').toBeGreaterThanOrEqual(6);
    expect(
      f[0].toLowerCase(),
      'the first line must say it contains Pro — that is the whole proposition',
    ).toContain('everything in pro');
    // The two things an accountant is actually buying.
    const all = f.join(' ').toLowerCase();
    expect(all, 'must name the statement page allowance').toContain(String(STATEMENT_PAGES.business));
    expect(all, 'Tally is the export no competitor supports — it must be on the list').toContain('tally');
  });

  it('names who each tier is for', () => {
    for (const p of PLAN_ORDER) {
      const line = (PRICING.audience as Record<string, string>)[p];
      expect(line, `no audience line for the "${p}" tier`).toBeTruthy();
      expect(line.trim().split(/\s+/).length, `${p}: the audience line is too short to say anything`).toBeGreaterThan(4);
    }
  });
});
