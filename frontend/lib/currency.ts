'use client';

import { useEffect, useState } from 'react';

// Currency-aware pricing. An Indian CA seeing "$19/mo" for the statement tool reads
// as far more expensive than "₹1,499" — same money, very different conversion — so
// the India-first flagship must price in ₹ for Indian visitors.
//
// Detection is Cloudflare's country (GET /api/geo), cached in localStorage; the
// client falls back to the browser's timezone/locale so it still guesses sensibly
// if the API can't be reached. This only picks what to DISPLAY — checkout always
// re-derives the price server-side, so it can't be gamed by faking a country.

export type Currency = 'INR' | 'USD';

const KEY = 'dd_currency';

function localGuess(): Currency {
  if (typeof window === 'undefined') return 'USD';
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
    if (/Kolkata|Calcutta/i.test(tz)) return 'INR';
    if ((navigator.language || '').toLowerCase().endsWith('-in')) return 'INR';
  } catch { /* ignore */ }
  return 'USD';
}

/** The visitor's billing currency. Starts from a cached/local guess (so prices never
 *  flash the wrong symbol on load) then confirms with the server. */
export function useCurrency(): Currency {
  const [cur, setCur] = useState<Currency>('USD');

  useEffect(() => {
    let cached: string | null = null;
    try { cached = localStorage.getItem(KEY); } catch { /* ignore */ }
    setCur(cached === 'INR' || cached === 'USD' ? (cached as Currency) : localGuess());

    let alive = true;
    const base = process.env.NEXT_PUBLIC_API_URL || '';
    fetch(`${base}/api/geo`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!alive || !d) return;
        const c: Currency = d.currency === 'INR' ? 'INR' : 'USD';
        setCur(c);
        try { localStorage.setItem(KEY, c); } catch { /* ignore */ }
      })
      .catch(() => { /* keep the guess */ });
    return () => { alive = false; };
  }, []);

  return cur;
}

export const currencySymbol = (c: Currency): string => (c === 'INR' ? '₹' : '$');

// Group digits: Indian (1,23,456) for INR, Western (123,456) for USD.
export function fmtAmount(n: number, c: Currency): string {
  const s = Math.round(n).toString();
  if (c === 'INR') {
    const last3 = s.slice(-3);
    const rest = s.slice(0, -3);
    return rest ? `${rest.replace(/\B(?=(\d{2})+(?!\d))/g, ',')},${last3}` : last3;
  }
  return s.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

export const price = (n: number, c: Currency): string => `${currencySymbol(c)}${fmtAmount(n, c)}`;

// ---- price tables (single source of truth) ---------------------------------
// INR amounts are set from the spec (Statements) / rounded from USD (Pro), NOT a
// live FX rate — pricing is a product decision, not a currency conversion.

export type PlanPrice = { monthly: number; annual: number; annualPerMonth: number };

export const PRO_PRICE: Record<Currency, PlanPrice> = {
  USD: { monthly: 5.98, annual: 60, annualPerMonth: 5 },
  INR: { monthly: 499, annual: 4999, annualPerMonth: 417 },
};

// The Statement Converter is its own paid tier — priced against DocuClipper ($29+),
// not against the free PDF tools. See docs/designs/bank-statement-converter.md §6.
export type StatementPrice = {
  freePages: number;      // per month, no signup
  packPages: number;      // one-time credit pack
  pack: number;           // pack price
  proMonthly: number;     // Statements Pro subscription
  proPages: number;       // pages/month included
};

export const STATEMENT_PRICE: Record<Currency, StatementPrice> = {
  USD: { freePages: 5, packPages: 20, pack: 4.99, proMonthly: 19, proPages: 300 },
  INR: { freePages: 5, packPages: 20, pack: 399, proMonthly: 1499, proPages: 300 },
};

// ── Business ────────────────────────────────────────────────────────────────
// The tier is not a new price. We were already publishing TWO paid products set
// by two decisions months apart — Pro at $5.98 and Statements Pro at $19 — and
// a bookkeeper who converts statements for a dozen clients AND wants batch and
// Edit PDF had to buy BOTH: $24.98, two renewal dates, two cancel buttons. There
// was no plan that sold her what she does for a living.
//
// So Statements Pro BECOMES Business and absorbs all of Pro, at the same $19.
// No published price goes up, every buyer gets more, and the two-subscription
// problem disappears without a price to defend. STATEMENT_PRICE.proMonthly is
// kept in step below and asserted by tests/unit/pricing-tiers.test.ts.
//
// ₹1,499 is NOT a conversion of $19 (that would be ~₹1,690). It is the figure in
// the statement-converter spec and it is already on the live pricing page —
// pricing is a product decision, as the note at the top of this section says.
//
// Single user at launch, deliberately. Seats need an organisation model,
// invites, member management and Stripe quantity billing; that is weeks of work
// for a tier with no customers yet. A Firm tier arrives when somebody asks for
// a second seat. Full reasoning: docs/designs/business-tier-pricing.html
export const BUSINESS_PRICE: Record<Currency, PlanPrice> = {
  USD: { monthly: 19, annual: 190, annualPerMonth: 15.83 },
  INR: { monthly: 1499, annual: 14999, annualPerMonth: 1250 },
};

/** Statement pages included per month, by tier. Free and Business are the two
 *  numbers already published; Pro's 20 is the "existing Pro subscribers get N a
 *  month included" line on /pricing. Read this rather than hard-coding a page
 *  count anywhere — the quota endpoint and the pricing page must agree. */
export const STATEMENT_PAGES: Record<'free' | 'pro' | 'business', number> = {
  free: 5,
  pro: 20,
  business: 300,
};

/** Monthly AI actions by tier. Pro's 50 is `AI_USER_MONTHLY_MAX` in the backend;
 *  Business gets 200, which at ~$0.02 an action is ~$4 against $19 of revenue —
 *  inside the rule that blended variable cost stays under 40–50% of price. */
export const AI_ACTIONS: Record<'free' | 'pro' | 'business', number> = {
  free: 0,
  pro: 50,
  business: 200,
};
