# DiemDesk — QA program

Everything about how DiemDesk is tested lives here. Read in this order:

1. **[qa-master-plan.md](qa-master-plan.md)** — the strategy: principles, the test
   pyramid, the tooling stack, environments, the non-functional specs
   (performance budgets, throttle, load/stress, a11y, cross-browser, security,
   visual regression), CI automation, cadence, and the phased build-out.
2. **[test-catalog.md](test-catalog.md)** — every scenario, curated:
   cross-cutting cases (run against all 128 routes) × per-archetype matrices +
   the full per-route checklist + the 18-module API matrix + fixtures.
3. **[regression-issues.md](regression-issues.md)** — every issue the owner has
   raised (and every historical bug) mapped to the automated test that now
   guards it. No bug is "closed" without one.

## Automation (scaffolded, runs after one install)

Config + starter specs are in [`frontend/tests/`](../../frontend/tests) and
`frontend/{playwright,vitest}.config.ts`.

```bash
# one-time, in frontend/
npm i -D vitest @vitest/coverage-v8 @testing-library/react @testing-library/dom jsdom
npm i -D @playwright/test @axe-core/playwright @lhci/cli
npx playwright install --with-deps chromium firefox webkit
```

```bash
npm run test:unit       # Vitest — pure logic + components
npm run test:sw         # service-worker regression (already existed, 17/17)
npm run test:e2e        # Playwright — journeys across 4 browsers/devices
npm run test:throttle   # Slow-3G + CPU 4×
npm run test:perf       # Lighthouse budgets
npm run test:all        # unit + sw + build + e2e
```

Starter specs already encode this session's regressions: `home.spec.ts`
(`SPLASH-001..003`, mobile chips, "+N more"), `smoke.spec.ts` (data-driven
cross-cutting), `throttle.spec.ts`, and `tests/unit/tool-facts.test.ts`.

## Status

**Phase 0 (foundation) complete** — plan, catalog, regression log, tooling
scaffold, starter specs. Phases 1–5 (guard-the-promises → archetype E2E →
engine/unit backfill → non-functional → API + gated-canary) are the build-out;
see [master plan §9](qa-master-plan.md#9-phased-build-out-this-is-a-program-not-one-commit).
