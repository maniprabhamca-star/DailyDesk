# DiemDesk — session handover (2026-08-06) · paste into a fresh session

## 0. HOW TO WORK (mandatory, from the owner)
- **Crisp only.** Every reply = short summary + action items. NO commentary, NO essays. (memory: dailydesk-feedback-crisp-replies)
- **Mock-first + PUBLISH the artifact** for any UI (owner can't see localhost/repo — only published artifacts). Match the approved mockup exactly; flag deviations.
- **Verify, don't trust** — the local dev **service worker caches a stale home shell** (unregister SW + clear caches, or test the prod build on :3100). `next start` caches the `public/` file list at boot → a new public file 404s until restart. Don't mix `next build` into the dev `.next`.
- **Never overwrite hand-maintained artifacts** — update in place.
- Auto-update: `/changelog` (frontend/lib/changelog.ts) on every user-facing ship; `/overview` + `docs/designs/master-roadmap.md`; commit designs under `docs/designs/`.
- Full memory lives at `C:\Users\Test\.claude\projects\C--Mani-Documents-MyBiz-DailyDesk\memory\` (index MEMORY.md) — read it; it's the source of truth.

## 1. WHAT DIEMDESK IS
Privacy-first document toolkit. 67+ tools, most run **100% on-device** (WASM/pdf.js/pdf-lib/qpdf/mozjpeg) — files never uploaded. Few server tools (Office conversions 3/day free→Pro, OCR, AI). Product = **DiemDesk**, live **https://diemdesk.com** (Cloudflare → nginx → Next). Business: JPNM Rapid Universe LLC (Marietta GA); public name DiemDesk.
- **Stack:** frontend Next.js 14 (app router, TS, Tailwind) `/var/www/dailydesk/frontend`; backend Express `/var/www/dailydesk/backend` (pm2 `dailydesk-backend`, Postgres + Redis); admin = SEPARATE app/repo (below).
- **Repos:** main `git@github.com:maniprabhamca-star/DailyDesk.git`; admin `git@github.com:maniprabhamca-star/DailyDesk-Admin-Portal.git`.
- **VPS:** `ssh root@2.25.71.126`, `/var/www/dailydesk`.
- **Deploy (main):** commit → push → on VPS `cd /var/www/dailydesk && git pull && cd frontend && npm run build && pm2 restart dailydesk-frontend`. Backend change → `pm2 restart dailydesk-backend`. Verify with curl + hard-refresh (SW). Local prod verify: `frontend-prod` on :3100.
- **HEAD = 756099d, pushed + deployed. Working tree: only untracked handoff/scratch files.**

## 2. ⭐ THE ONE REVENUE BLOCKER
Site is PUBLIC + free. Revenue gated ONLY by `WAITLIST_MODE = true` in `frontend/lib/flags.ts`. To go live: recreate Stripe prices **$5.98/mo · $60/yr** (live ones are stale $4.99/$49), set `STRIPE_PRICE_ID*`, then `WAITLIST_MODE=false`. Stripe billing chain is BUILT + proven in test. Owner doing this later — keep reminding.

## 3. SHIPPED THIS SESSION (all LIVE unless noted)
- **Edit PDF Part A** (owner-only/coming_soon): right properties panel, context bar, **document-wide find & replace**, added-text resize grip, **Times/Courier→Liberation Serif/Mono** preview fidelity. Core (Codex-stabilized) untouched.
- **Tool-page Part B** (all 67 pages): **live upload-counter** (measures real file bytes leaving; 0 on-device, counts up + says so on server tools), "What this does to your file", "Where this won't help", "Last improved" (from changelog). Data in `lib/tool-facts.ts`.
- **Mobile home:** centered trust chips, removed empty "+N more" tile.
- **First-visit splash** (`components/app/first-visit-splash.tsx`, home only): playful lifted-D build, SSR-rendered so it covers from first paint (fixed home→splash→home flash), once-only (localStorage `dd-splash-seen-v1`), skippable, reduced-motion, inline guard in layout. + PWA install-splash manifest (icons split any/maskable).
- **IndexNow key** `frontend/public/2501ebe93148e9c071c9e8a7bc9b4492.txt` (Serplytic/Bing verify) — served, safe (verification token, not secret).
- **QA program** `docs/qa/` (plan + 128-route test-catalog + regression-issues REG-NNN + dashboard artifact) + scaffold `frontend/tests/` (Playwright+Vitest+LHCI). **CI LIVE + GREEN:** `.github/workflows/qa.yml` — quality gate (tsc+unit+sw+build) BLOCKING; E2E best-effort (76/76) `continue-on-error` (no backend in CI). Deps installed: vitest, @playwright/test, jsdom.
- **Saved Workflows** — built + deployed DARK (below).

## 4. ⭐ SAVED WORKFLOWS (just built, gated dark)
`/workflows` = `coming_soon` (owner-only via ddadmin cookie until Pro launch); in PRO_TOOLS + catalog Workspace group; NOT in sitemap. Chain on-device tools, drop once, runs whole chain in browser (no upload between steps = the moat).
- `lib/workflows/steps.ts` — 8 WIRED steps over existing engines: merge, delete, rotate, page-numbers, remove-metadata, flatten, protect, compress-size. 4 `soon` (disabled): sign, watermark, share-safe, clean-scanned.
- `lib/workflows/index.ts` — runner + templates + localStorage persistence. `components/tools/workflows-tool.tsx` — UI. `app/workflows/page.tsx`.
- Verified prod-build as owner: Send-safe stripped metadata for real; page-numbers (worker engine) ran; batch→zip; mobile clean.
- **Fast-follow:** wire the 4 soon steps; account-synced workflows; changelog entry at un-gate. Mock: artifact e1704e2c / `docs/designs/workflows-mockup.html`.

## 5. NOW-PENDING (build)
1. **Wire Workflows' 4 `soon` steps** + account sync.
2. **Admin portal features** (SEPARATE repo `DailyDesk-Admin-Portal`, `/var/www/dailydesk-admin`, admin.diemdesk.com, pm2 dailydesk-admin, NO tests): **(a) AI Cost & Budget panel** — AI spend in **Redis** micro-dollars (`ai:spend:$day`, `ai:spend:m:$month`, `ai:u:$uid:$month`; TTL-expire; backend `aiBudget.js`); build read panel + optional kill-switch (Redis `ai:kill`, backend change → owner OK). **(b) Waitlist export** — Postgres `pro_waitlist` (email/user_id/feature); mirror the Users page + CSV. Full spec: `SESSION-HANDOFF-admin-features.md` (main repo root).
3. **Beyond-market uniques** (niche, unbuilt): PDF/UA accessibility, e-Invoice Factur-X/ZUGFeRD+GST (legal-sensitive), RFC-3161 timestamp, PDF→EPUB.
4. **PDF→Audio MP3 export** — needs server neural-TTS infra (cost decision). Free browser-playback version is live.
5. **TWA (Android)** — packaging/ops (Play Console, signing, assetlinks); gated behind SW soak + revenue flip.

## 6. NON-PRODUCT / PARKED
- **QA Phase 1:** write the regression suite for the logged REG-NNN issues (still 🔴), promote E2E to blocking once a backend/mock is in CI, wire nightly non-functional lane.
- **Home "bento" grand redesign** — PARKED, owner-approved direction (artifact 0a78c04c + `docs/designs/home-hero-bento.html`). Open Qs: bento as hero vs section; keep/drop the committed `showcase-wall.tsx` (currently OFF via `SHOW_SHOWCASE_WALL=false`). memory: dailydesk-home-grand-redesign.

## 7. OWNER-SIDE (remind)
- Revenue flip (§2). Bank Statement Converter: built, **un-gate blocked on owner Tally-import test** then set STATEMENT_QUOTA_ENABLED + un-gate + add to sitemap. Offline claim: re-advertise after SW soak (per-tool wording, never "fully offline"). Canary for the 9 gated tools (needs logged-in canary user). robots.txt AI-crawler decision (leave blocked = my rec). EIN PR #1 location = Atlanta.

## 8. KEY GOTCHAS
- Dev SW stale home shell (unregister+clear or use prod build). `next start` caches public/ at boot (restart for new public files). `users.id` is UUID. Vitest `pool:'threads'` (space-in-path breaks forks on Windows). Edit-PDF core = NEVER touch. Redis fails-open for AI per-user cap. Framer overlay needs an `animate` prop or AnimatePresence exit hangs.

## 9. FIRST MOVES IN NEW SESSION
Read MEMORY.md. Confirm HEAD `756099d` deployed. Ask owner which to pick: wire Workflows soon-steps · admin AI-cost+waitlist · QA Phase 1 · home bento build. Keep replies crisp.
