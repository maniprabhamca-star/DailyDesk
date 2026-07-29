# DiemDesk — QA Master Plan

The single source of truth for how DiemDesk is tested. Paired with
[`test-catalog.md`](test-catalog.md) (every scenario, page by page) and
[`regression-issues.md`](regression-issues.md) (every issue we've hit → the test that
now guards it). Keep all three in sync with every ship.

> **Why this exists.** DiemDesk is 128 routes, 67 tools, 18 API modules, an auth
> layer, an E2E-encrypted vault, an AI suite, Stripe billing and a service worker.
> A converter that silently gets one number wrong lands in a customer's books; a
> privacy claim that's wrong once costs more than the feature earns. Manual spot
> checks cannot hold that surface. This plan makes coverage **systematic,
> automated, and regression-proof**.

---

## 1. Principles

1. **Test the promise, not just the code.** Our promises are specific — *files
   never leave the browser*, *balance-verified conversions*, *true redaction*,
   *no daily cap*. Each promise gets an automated test that would fail loudly if
   it ever stopped being true.
2. **Every fixed bug becomes a permanent test.** No issue the owner raises is
   "closed" until a test reproduces it and then proves the fix. See
   [`regression-issues.md`](regression-issues.md).
3. **Archetypes, not copy-paste.** 67 tools do not need 67 hand-written test
   files. Each tool belongs to an **archetype** with a shared scenario matrix;
   the per-route matrix records only what's *different*. This is how we cover
   "every single thing" without thousands of duplicated cases.
4. **Verify headlessly, the way we already do.** pdf.js/WASM tools are proven in
   Node with the real engines (the "don't make the owner re-test" method). E2E
   drives the real browser. Both run in CI.
5. **Fail the build, not the customer.** Functional + a11y + perf budgets +
   security headers run in CI on every PR. A red check blocks merge.

---

## 2. The test pyramid

| Layer | What | Tool | Count target | Runs |
|---|---|---|---|---|
| **Unit / pure-logic** | Engines & helpers with no DOM (compress ladder, table-extract, bates-core, speech-core, vault-crypto, sanitizers, xlsx/docx writers, tool-facts data) | **Vitest** | ~1 per pure module (start ~40) | pre-commit + CI, seconds |
| **Engine (headless real-WASM)** | pdf.js / pdf-lib / qpdf / mozjpeg actually run in Node and output is re-read & asserted | **Node harness** (existing pattern) | 1 per engine-backed tool (~25) | CI, minutes |
| **Component / DOM** | React components in jsdom (splash gating, upload-watch counter, keep-going handoff, panels) | **Vitest + Testing Library** | ~1 per stateful component | CI, seconds |
| **E2E (real browser)** | Full user journeys per archetype + per-page specifics, real file upload → download | **Playwright** (Chromium/Firefox/WebKit) | 1 spec per archetype + per-route data rows | CI + nightly, ~10–20 min |
| **API / integration** | Backend routes: auth, gating, quotas, rate limits, validation, webhooks | **Vitest + supertest** (or Playwright request) | 1 per route module (18) | CI |
| **Non-functional** | Perf budgets, throttle, load/stress, a11y, security, visual-regression | **Lighthouse CI, Playwright (throttle/axe/screenshot), k6/autocannon** | budgets per page-archetype | nightly + pre-release |
| **Production canary** | Live smoke of real tools every 30 min (already shipped) | **Playwright browser-canary + Node canary** | 27 tools today → grow to gated tools | cron on VPS |

**Golden rule:** most bugs should be caught by the cheapest layer that can catch
them. Push logic down to unit/engine tests; reserve E2E for journeys.

---

## 3. Tooling stack (to install)

```bash
# frontend/ — one-time
npm i -D vitest @vitest/coverage-v8 @testing-library/react @testing-library/dom jsdom
npm i -D @playwright/test && npx playwright install --with-deps chromium firefox webkit
npm i -D @axe-core/playwright          # a11y assertions inside E2E
npm i -D @lhci/cli                     # Lighthouse CI (perf/SEO/best-practices/a11y budgets)
```

Config lives under `frontend/tests/` (see [`test-catalog.md` §7](test-catalog.md)):
`vitest.config.ts`, `playwright.config.ts`, `tests/perf/lighthouserc.json`,
`tests/perf/budget.json`. Backend reuses its existing Node + Playwright setup.

**npm scripts to add** (`frontend/package.json`):

```jsonc
"test:unit":   "vitest run",
"test:watch":  "vitest",
"test:e2e":    "playwright test",
"test:e2e:ui": "playwright test --ui",
"test:a11y":   "playwright test tests/e2e/a11y.spec.ts",
"test:perf":   "lhci autorun",
"test:throttle":"playwright test tests/e2e/throttle.spec.ts --project=chromium-slow",
"test:all":    "npm run test:unit && npm run build && npm run test:e2e && npm run test:perf"
```

---

## 4. Environments

| Env | URL | Purpose | Notes |
|---|---|---|---|
| **Local dev** | `localhost:3000` (`next dev`) | authoring tests | ⚠ dev **service worker caches a stale shell** — unregister SW + clear caches, or test against prod build. Never mix `next build` into the dev `.next`. |
| **Local prod** | `localhost:3100` (`next start`) | the **reliable verifier** — matches production bundling | how E2E/perf should run locally |
| **CI** | ephemeral `next start` | gate every PR | headless, 3 browsers |
| **Production canary** | `diemdesk.com` | live smoke | read-only; blocks its own analytics beacons |

Owner-gated tools (Edit/Redact/AI/Vault/Notes/Habits/Budget/Link-in-Bio/Receipt)
need a **canary test user + `ddadmin=1` cookie** to be drivable — see the coverage
gap in [`regression-issues.md`](regression-issues.md).

---

## 5. Non-functional testing (explicit, per the owner's ask)

### 5.1 Performance budgets (Lighthouse CI — `tests/perf/budget.json`)
Enforced per page archetype; a regression fails the build.

| Metric | Landing / content | Tool page | Editor (heavy) |
|---|---|---|---|
| Performance score | ≥ 90 | ≥ 85 | ≥ 75 |
| LCP | ≤ 2.0s | ≤ 2.5s | ≤ 3.5s |
| CLS | ≤ 0.05 | ≤ 0.1 | ≤ 0.1 |
| TBT | ≤ 200ms | ≤ 300ms | ≤ 600ms |
| Total JS (first load) | ≤ 130 KB | ≤ 180 KB | ≤ 380 KB |
| SEO score | 100 | 100 | 100 (noindex tools exempt) |
| A11y score | ≥ 95 | ≥ 95 | ≥ 90 |

### 5.2 Throttle testing (Playwright CDP)
A dedicated `chromium-slow` project throttles **network = Slow 3G (400kbps/400ms
RTT)** and **CPU = 4× slowdown**, run against: home, one heavy tool
(`/compress-pdf`), one editor (`/edit-pdf`), one AI tool. Asserts: the page is
interactive, the dropzone appears, a small file still processes, and no operation
hangs past a timeout. Catches the "5–10s cold first-drop" class of issue.

### 5.3 Load / stress (large files & concurrency)
- **Large-file** (Playwright + generated fixtures): 100 MB PDF compress, 1 GB
  rotate (the documented 56s benchmark), 500-page detect in Edit, 200-row table
  extract — assert completion, no tab OOM, cancel actually stops.
- **Backend concurrency** (k6/autocannon against staging): burst the server
  conversion + AI endpoints; assert rate-limit 429s, quota enforcement, the
  degrade-don't-fail checkout path, and no 5xx.

### 5.4 Accessibility (axe-core in every E2E archetype)
Zero serious/critical axe violations. Plus keyboard-only journeys (tab order,
focus-visible, Esc closes dialogs), reduced-motion honoured (splash, animations),
and colour-contrast on both themes.

### 5.5 Cross-browser & responsive
E2E runs on **Chromium, Firefox, WebKit**. Responsive checks at **375 / 768 /
1280 / 1440**. Explicitly covers the cross-browser-font-fallback class of bug
(Edit PDF) and the `showSaveFilePicker`/OffscreenCanvas/WASM fallbacks.

### 5.6 Security
Automated: security headers present (CSP, HSTS, X-Frame-Options), no secrets in
the bundle, gated tools 402/coming-soon by direct URL, auth on protected APIs,
input sanitisation (bio/notes control chars, `javascript:`/`data:` URL drops),
rate-limit on `/api/auth*`. Pairs with `/code-review security` and the
`dd-audit` tooling.

### 5.7 Visual regression
Playwright screenshot snapshots per archetype in light + dark at 2 widths;
diff-on-PR. Guards the premium-toolbar standard and layout regressions.

---

## 6. CI automation

`.github/workflows/qa.yml` (to add) on every PR + push to main:

```
lint + typecheck  →  unit + engine + component  →  build  →  e2e (3 browsers)
                                                         →  a11y  →  lighthouse budgets
                                                         →  security-headers + secret-scan
nightly (cron):   throttle + load/stress + visual-regression + full cross-browser
pre-release gate: all green + manual real-phone sweep sign-off
```

Red = no merge. Flaky tests are quarantined + fixed, never `.skip`-and-forget.

---

## 7. Coverage model — how "every single thing" is guaranteed

Coverage = **Cross-cutting scenarios** (apply to *every* page) **×** **Archetype
matrix** (the tool's family) **+** **Per-route specifics** (what's unique/edge)
**+** **Regression seeds** (every raised issue). All four are enumerated in
[`test-catalog.md`](test-catalog.md). A route is "covered" only when it has:
- ✅ a cross-cutting pass (SEO/responsive/theme/a11y/console/perf),
- ✅ its archetype's functional matrix wired with the route's real fixture,
- ✅ every page-specific edge case listed, and
- ✅ any regression tests that touch it.

The [`test-catalog.md`](test-catalog.md) per-route table is the checklist; a route
is not shippable-tested until every column is green.

---

## 8. Cadence & ownership

- **Per PR:** author adds/updates unit + E2E for the change; CI enforces.
- **Per ship:** update the catalog row, add a regression test if a bug was fixed,
  update the changelog.
- **Nightly:** heavy non-functional suite.
- **Pre-release:** full green + real-device manual sweep.
- **Always:** the production canary + owner-alert-on-failure.

---

## 9. Phased build-out (this is a program, not one commit)

| Phase | Scope | Output |
|---|---|---|
| **0 — Foundation** *(this deliverable)* | Plan, catalog, regression seeds, tooling scaffold, artifact, memory | docs/qa/* + configs + starter specs |
| **1 — Guard the promises + raised issues** | Regression suite for every issue in `regression-issues.md`; the 4 privacy/quality promises | ~20 high-value tests, green in CI |
| **2 — Archetype E2E** | One robust spec per archetype, data-driven over its routes | ~9 specs covering all 67 tools + pages |
| **3 — Engine + unit backfill** | Headless real-WASM per engine tool; unit for every pure module | ~65 tests |
| **4 — Non-functional** | Lighthouse budgets, throttle, load/stress, a11y, visual, security in CI | nightly suite |
| **5 — API + gated-canary** | 18 API modules; logged-in canary for the 9 gated tools | closes the monitoring gap |

Each phase is independently shippable and leaves the suite greener than before.
