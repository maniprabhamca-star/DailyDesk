import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { STATEMENT_PAGES, AI_ACTIONS } from '../../lib/currency';

// What a plan includes is printed on /pricing before anybody pays, so the
// server has to agree with the page. It cannot share the constant: the pricing
// page is TypeScript compiled by Next, the quota endpoint is CommonJS run by
// Node, and there is no build step between them. So the numbers exist twice and
// this file is the thing that stops them drifting.
//
// They had already drifted, which is why this exists. routes/statements.js
// short-circuited on isPaidPlan() and returned `unlimited: true` for anyone who
// had paid anything, while /pricing printed "5 · 20 · 300" and /compare printed
// "$0.063 a page" — a figure that is $19 ÷ 300 and therefore meaningless unless
// 300 is enforced. A $5.98 Pro subscriber had the same unmetered access as a $19
// Business subscriber, so the tier we had just built had no volume advantage at
// all in code. In the other direction, aiBudget.js gave every account the single
// AI_USER_MONTHLY_MAX, so Business paid $19 for the "200 actions a month" on the
// page and received Pro's 50.
//
// Neither failure was visible to the build, to a typecheck, or to any of the 389
// tests that existed, because a published price and a server constant have
// nothing in common that a compiler can see.

const BACKEND = join(__dirname, '../../../backend/src');
const read = (p: string) => readFileSync(join(BACKEND, p), 'utf8');

/** Pull `name: 123` out of an object literal in a .js file. */
function num(src: string, object: string, key: string): number {
  const obj = new RegExp(`const\\s+${object}\\s*=\\s*\\{([\\s\\S]*?)\\n\\};`).exec(src);
  if (!obj) throw new Error(`${object} not found`);
  const m = new RegExp(`\\b${key}\\s*:\\s*([^,\\n]+)`).exec(obj[1]);
  if (!m) throw new Error(`${object}.${key} not found`);
  // free pages carry an env fallback: Number(process.env.X || 5)
  const lit = /(\d+(?:\.\d+)?)\s*\)?\s*,?\s*$/.exec(m[1].trim());
  if (!lit) throw new Error(`${object}.${key} is not a literal: ${m[1]}`);
  return Number(lit[1]);
}

describe('tier allowances: the server agrees with the pricing page', () => {
  const tiers = read('config/tiers.js');

  it('statement pages match lib/currency.ts for every tier', () => {
    for (const tier of ['free', 'pro', 'business'] as const) {
      expect(
        num(tiers, 'STATEMENT_PAGES', tier),
        `backend STATEMENT_PAGES.${tier} must equal the ${STATEMENT_PAGES[tier]} on /pricing`,
      ).toBe(STATEMENT_PAGES[tier]);
    }
  });

  it('AI actions match lib/currency.ts for every tier', () => {
    for (const tier of ['free', 'pro', 'business'] as const) {
      expect(
        num(tiers, 'AI_ACTIONS', tier),
        `backend AI_ACTIONS.${tier} must equal the ${AI_ACTIONS[tier]} on /pricing`,
      ).toBe(AI_ACTIONS[tier]);
    }
  });

  it('Business gets strictly more than Pro on both meters', () => {
    // If these ever come out equal, the tier has no reason to cost 3.2× more
    // and the comparison table is selling a difference that does not exist.
    expect(STATEMENT_PAGES.business).toBeGreaterThan(STATEMENT_PAGES.pro);
    expect(AI_ACTIONS.business).toBeGreaterThan(AI_ACTIONS.pro);
    expect(STATEMENT_PAGES.pro).toBeGreaterThan(STATEMENT_PAGES.free);
  });

  it('the $/page we publish on /compare is $19 ÷ the Business allowance', () => {
    // /compare prints $0.063 against DocuClipper's $0.483. That number is only
    // true while Business is $19 for STATEMENT_PAGES.business.
    const perPage = 19 / STATEMENT_PAGES.business;
    expect(perPage).toBeCloseTo(0.063, 3);
  });
});

describe('regression guards: the bugs this replaced', () => {
  it('the quota route does not hand unlimited pages to anyone who has paid', () => {
    // Comments stripped first: the file deliberately quotes the old line in its
    // header so the next reader knows what changed, and a guard that cannot
    // tell code from a comment about code fails on its own documentation.
    const src = code(read('routes/statements.js'));
    const line = /isPaidPlan\([^)]*\)[^\n]*unlimited:\s*true/;
    expect(line.test(src), 'statements.js must meter paid tiers, not exempt them').toBe(false);
    expect(src.includes("require('../config/tiers')")).toBe(true);
  });

  it('every AI budget check passes the caller’s tier', () => {
    // budget.check(key, weight) silently falls back to one allowance for
    // everybody — which is how Business ended up with Pro's 50 actions. A new
    // AI endpoint must say who is calling.
    const offenders: string[] = [];
    for (const file of walk(BACKEND)) {
      if (!file.endsWith('.js') || file.includes('aiBudget.js')) continue;
      const src = code(readFileSync(file, 'utf8'));
      for (const m of src.matchAll(/budget\.check\(([^)]*)\)/g)) {
        if (m[1].split(',').length < 3) offenders.push(`${file.replace(BACKEND, '')}: budget.check(${m[1]})`);
      }
    }
    expect(offenders, 'pass a tier as the third argument').toEqual([]);
  });

  it('nothing escalates a statement to a bigger model without the budget in scope', () => {
    // Trap two from docs/designs/business-tier-pricing.html: the escalation
    // ladder (balance check fails → Haiku → Sonnet) has no per-account ceiling
    // in its design. It is not built yet, and this is here so it cannot BE
    // built without one. A corrupt 300-page scan where every balance fails
    // would otherwise bill Sonnet 300 times against a single $19 account.
    const offenders: string[] = [];
    for (const file of walk(BACKEND)) {
      if (!file.endsWith('.js')) continue;
      const src = code(readFileSync(file, 'utf8'));
      const usesBigModel = /claude-[a-z0-9.-]*(sonnet|opus)/i.test(src);
      if (usesBigModel && !src.includes('aiBudget')) offenders.push(file.replace(BACKEND, ''));
    }
    expect(offenders, 'a Sonnet/Opus call must go through utils/aiBudget').toEqual([]);
  });
});

/** Source with comments removed, so a guard reads code and not a comment
 *  that happens to quote the very pattern it is looking for. */
function code(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules') continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
}
