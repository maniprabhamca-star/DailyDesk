import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import {
  PLAN_ORDER,
  isPaid,
  isAtLeast,
  isExactly,
  canProcessSize,
  canBatch,
  allowedBatchCount,
  FREE_MAX_BYTES,
  FREE_MAX_BATCH,
  type Plan,
} from '@/lib/plan';

// Why this file exists
// ────────────────────────────────────────────────────────────────────────────
// Adding a third paid tier turns `plan === 'pro'` from a correct check into a
// silent downgrade: it returns false for somebody paying MORE than a Pro
// subscriber, denying them every Pro feature they just bought — with a green
// build and passing tests, because no existing test asserts anything about a
// plan that did not exist when it was written.
//
// That is a defect no amount of care prevents on the next edit, so it is pinned
// here instead. See docs/designs/business-tier-pricing.html, trap one.

describe('plan tiers', () => {
  it('orders the tiers and knows which of them have paid', () => {
    expect([...PLAN_ORDER]).toEqual(['free', 'pro', 'business']);

    expect(isPaid('free')).toBe(false);
    expect(isPaid('pro')).toBe(true);
    expect(isPaid('business'), 'a Business subscriber has paid MORE than a Pro one').toBe(true);

    // Every paid tier must be paid. Stated as a loop over PLAN_ORDER so adding a
    // tier without adding it to PAID fails here rather than in production.
    for (const p of PLAN_ORDER) {
      expect(isPaid(p), `${p}: isPaid must be decided deliberately`).toBe(p !== 'free');
    }
  });

  it('answers "at least this tier" by order, not by name', () => {
    expect(isAtLeast('business', 'pro'), 'Business is above Pro').toBe(true);
    expect(isAtLeast('pro', 'business'), 'Pro is not Business').toBe(false);
    expect(isAtLeast('pro', 'pro')).toBe(true);
    expect(isAtLeast('free', 'pro')).toBe(false);
    expect(isAtLeast('free', 'free')).toBe(true);
  });

  it('keeps isExactly narrow, so reaching for it is a visible choice', () => {
    expect(isExactly('pro', 'pro')).toBe(true);
    expect(isExactly('business', 'pro'), 'Business is NOT exactly Pro').toBe(false);
  });

  it('gives every paid tier every Pro entitlement', () => {
    const big = FREE_MAX_BYTES + 1;
    const many = FREE_MAX_BATCH + 5;

    for (const p of ['pro', 'business'] as Plan[]) {
      expect(canProcessSize(big, p), `${p}: unlimited file size`).toBe(true);
      expect(canBatch(many, p), `${p}: batch`).toBe(true);
      expect(allowedBatchCount(many, p), `${p}: the whole batch`).toBe(many);
    }

    expect(canProcessSize(big, 'free')).toBe(false);
    expect(canBatch(many, 'free')).toBe(false);
    expect(allowedBatchCount(many, 'free')).toBe(FREE_MAX_BATCH);
    // The free caps still apply at the boundary, in both directions.
    expect(canProcessSize(FREE_MAX_BYTES, 'free')).toBe(true);
    expect(canBatch(FREE_MAX_BATCH, 'free')).toBe(true);
  });

  // ── The guard ──────────────────────────────────────────────────────────────
  it('never compares a plan to a tier name outside the places that mean to', () => {
    // Legitimate exceptions, each for a stated reason:
    //   lib/plan.ts        — defines the helpers; the comparisons live here
    //   site-header.tsx    — renders the tier NAME on the badge, which is the
    //                        one place the name itself is the point
    const ALLOWED = new Set(['lib/plan.ts', 'components/app/site-header.tsx']);

    const root = process.cwd();
    const dirs = ['app', 'components', 'lib'];
    const offenders: string[] = [];

    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        const full = join(dir, name);
        if (statSync(full).isDirectory()) {
          if (name === 'node_modules' || name === '.next') continue;
          walk(full);
          continue;
        }
        if (!/\.tsx?$/.test(name)) continue;
        const rel = relative(root, full).split('\\').join('/');
        if (ALLOWED.has(rel)) continue;

        const src = readFileSync(full, 'utf8');
        src.split('\n').forEach((line, i) => {
          // Strip comments: this file's own explanation of the trap must not
          // count as the trap.
          const code = line.replace(/\/\/.*$/, '').replace(/\/\*.*?\*\//g, '');
          if (/\bplan\s*(===|!==|==|!=)\s*['"](free|pro|business)['"]/.test(code)) {
            offenders.push(`${rel}:${i + 1}  ${line.trim()}`);
          }
        });
      }
    };
    for (const d of dirs) walk(join(root, d));

    expect(
      offenders,
      'Compare entitlement, not tier names: use isPaid(plan) for "has paid", ' +
        'isAtLeast(plan, "business") for a higher tier, or isExactly(plan, "pro") ' +
        'if you really do mean that one tier. A bare comparison silently denies a ' +
        'Business subscriber everything they paid for.\n' +
        offenders.join('\n'),
    ).toEqual([]);
  });
});
