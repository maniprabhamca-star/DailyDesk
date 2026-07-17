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
