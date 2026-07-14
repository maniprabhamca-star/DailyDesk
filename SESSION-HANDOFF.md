# DiemDesk — Session Handoff (2026-07-14)

Paste this into a fresh session to continue with full context.

---

## 1. Product & business
- **DiemDesk** — privacy-first, **on-device** document toolkit SaaS. ~45+ tools live, catalog is data-driven.
- **Live & public** at **https://diemdesk.com** (Cloudflare → nginx → app; basic-auth removed, crawlable, sitemap submitted to GSC).
- **GTM:** free-first worldwide launch → gather feedback ~3 months → then turn Pro on. EIN Presswire PR launched.
- **Legal entity:** JPNM Rapid Universe LLC (Marietta, GA) — IRS/legal fields only. Public/checkout name = **DiemDesk**. Support = support@diemdesk.com.
- **Pricing:** Pro $5.98/mo or $60/yr ($5/mo); founding $4.99/mo first 1,000 for life. Refund = 14 days all plans. `BILLING_ENABLED=true` in Stripe **test**; live keys/prices to create at Pro launch.

## 2. Infra & deploy (MEMORIZE)
- **Repo:** GitHub `maniprabhamca-star/DailyDesk`, branch `main`. Local: `C:\Mani Documents\MyBiz\DailyDesk`.
- **VPS:** `root@2.25.71.126`, app at `/var/www/dailydesk`. Frontend :3000, backend :4000, both under pm2 (`dailydesk-frontend`, `dailydesk-backend`).
- **Deploy flow:** `git push origin main` → `ssh root@2.25.71.126 "cd /var/www/dailydesk && git pull --ff-only origin main && cd frontend && npm run build && pm2 restart dailydesk-frontend"` (backend: `pm2 restart dailydesk-backend`).
- **Stack:** Next.js 14 App Router + TS (ES5), Tailwind, framer-motion, lucide-react; pdf-lib, pdf.js (`lib/pdf-render.ts` `openPdf`/`renderPage`, `lib/pdf-rasterize.ts`), mozjpeg/qpdf/libheif WASM, @napi-rs/canvas. Backend: Express + pg (Postgres) + ioredis.
- **CRLF warnings on every git add are normal** (Windows). Ignore.

## 3. Verification method (DO THIS — "no guesswork"; QA bar = only positive user feedback)
- pdf.js/canvas tools CANNOT be verified in the Node sandbox; verify **live via headless Playwright ON THE VPS**:
  `ssh root@2.25.71.126` → write a script to `/tmp/x.js` → `cd /var/www/dailydesk/backend && NODE_PATH=/var/www/dailydesk/frontend/node_modules:/var/www/dailydesk/backend/node_modules node /tmp/x.js`.
  Chromium cached at `/root/.cache/ms-playwright/`. `launchPersistentContext` to cache WASM/models. Fixtures via @napi-rs/canvas + pdf-lib. `exiftool` installed (for EXIF fixtures). Clean up `/tmp` after.
- Typecheck before deploy: `cd frontend && npx tsc --noEmit`. **`.next-*` dirs bloat Grep/Glob → scope searches to `lib`/`components`/`app`.**
- Screenshot for the owner: Playwright `page.screenshot` on VPS → `scp` to local scratchpad → Read it.
- Downloads in tools use a two-step pattern (an action button builds the result panel; a separate "Download" button fires the download) — Playwright must click the second one.

## 4. Tool expansion roadmap (THE current workstream) — see [[dailydesk-tool-expansion-roadmap]]
Decision: build 6 tools one at a time; **#1–5 free & public as finished**; **#6 PDF→Excel = Pro, gated until Pro launch**. Build EXACTLY to the approved mockup (flag deviations first). Each tool: mockup (Artifact + `docs/artifacts/`) → build → verify live → send owner screenshot + URL.

| # | Tool | Route | Status |
|---|---|---|---|
| 1 | Compress to target size | `/compress-to-size` | ✅ LIVE + verified |
| 2 | Passport & ID photo | `/passport-photo` | ✅ LIVE + verified |
| — | Fill a PDF form | `/fill-pdf-form` | ✅ LIVE + verified |
| 4 | Blur & remove metadata | `/photo-privacy` | ✅ LIVE + verified |
| 5 | Dev + CSV utility pack | — | **NEXT (mock first)** |
| 6 | PDF → Excel | — | Pro, GATED, unbuilt (Pro launch) |

### Code map of the new tools
- **#1** `lib/compress-to-target.ts` (image=mozjpeg quality binary-search + downscale ladder; PDF=pdf-lib lossless re-save, else `rasterizePdf` DPI/quality ladder + **fast-path** unreachable + **AbortSignal cancel**), `components/tools/compress-target-tool.tsx` (presets 50KB–2MB + Custom w/ smart KB→MB; global groups India-exams/passport-visa/everyday incl. UPSC/SSC/NEET/IBPS/SBI/RRB, US/India/China/UAE/Canada visa; "already under" + "smallest reached (the max possible)" msgs; Cancel + page progress). `lib/pdf-rasterize.ts` given additive `{dpi,quality}` + `signal`.
- **#2** `lib/passport-specs.ts` (**45 country specs**, data-driven; `VERIFIED_SPECS`+`isVerified()`), `lib/passport-photo.ts` (spec-exact crop export + size-to-KB + `removeBackground` bg-swap + `buildPrintSheet` 4×6), `components/tools/passport-photo-tool.tsx` (searchable picker, zoom/pan crop + guides, bg swatches, **auto face-place via FaceDetector**, verified note). Sources cited in `docs/passport-spec-sources.md`.
- **#3** `lib/fill-pdf.ts` (detect AcroForm count; export = element→supersampled PNG→embedPng→flatten), `components/tools/fill-form-tool.tsx` (toolbar Select/Text/Check/X/Date/Signature, click-place, drag, side edit panel w/ size/color/delete, page nav; flat-form banner; **typing bug FIXED** — focus effect deps `[selId]` only). Renders pages via `openPdf`/`renderPage`.
- **#4** `lib/photo-privacy.ts` (readMeta header-scan EXIF/GPS/Make/Date; `detectFaces` FaceDetector; `exportCleanImage` = draw + clip-blur + JPEG re-encode strips metadata), `components/tools/photo-privacy-tool.tsx` (metadata report chips, drag-blur boxes; FREE strip+manual, **PRO gated** auto-blur + batch via `usePlan`).

## 5. Other shipped this session
- **Capacity guard**: `lib/plan.ts` `deviceMemoryGB/browserSafeMaxBytes/exceedsBrowserCapacity`; `components/app/big-file-hint.tsx` two-tier (device-RAM ceiling ≈ navigator.deviceMemory×0.6 ÷3 heavy, cap 2GB ArrayBuffer). Tab realistically maxes ~1–2GB heavy ops; **5GB impossible in-browser** (only server-streaming, future Pro).
- **Size-bucket analytics**: `usage-beacon.tsx` doc-level listener → largest file BUCKET (<50MB/50-100MB/100MB-1GB/1-2GB/>2GB) → backend `file_size` event → `/dashboard` "File sizes" panel. (Answer to "who uses 1-4GB" ≈ almost all video.)
- **SEO landing pages** live (canonical + sitemap + FAQ JSON-LD): `/compress-pdf-to-100kb`, `/us-visa-photo`, `/remove-exif`, `/blur-image`, `/fill-pdf-form-online`, dynamic **`/passport-photo/[country]` ×45**. Component `components/app/keyword-landing.tsx`; `app/sitemap.ts` generates 50 country URLs.
- **Vault + Link-in-Bio → Pro**: added to `PRO_TOOLS` in `components/app/catalog.tsx` + artifacts.
- **Artifacts grouped** in `docs/artifacts/` (`overview-product.html`, `overview-status-board.html`, `mockup-toolNN-<slug>.html`) + `docs/artifacts/README.md` (file↔live-link map). Re-publish overviews to SAME artifact URL via `url=` param.
- **Stripe Customer Portal**: code done (`POST /api/stripe/portal` + "Manage subscription" on `/account` + `customer.subscription.deleted` webhook). Owner **ENABLED it in Stripe test** (redo in LIVE at Pro launch).

## 6. DiemDesk Studio (parked) — [[dailydesk-studio-idea]]
- Owner idea: Canva/Adobe-Express-style **on-device** design studio, **Pro**. Name = **DiemDesk Studio**.
- **Branch `diem-studio`** (pushed) seeds the base: `studio/base/hero-banner-generator.html` (owner's single-file **vanilla-JS HTML5-Canvas** banner generator — layers/opacity, logos, text, bg processing, toDataURL export) + `studio/README.md`. Concept: `docs/designs/diemdesk-studio-concept.md`.
- Plan: after roadmap tools ship, port its canvas/layer engine into Next + template presets + platform sizes + brand kit. Merge `main`→branch before resuming. **Do NOT touch until roadmap done.**

## 7. PENDING — issues & tasks
**Tool roadmap:**
- **#5 Dev/CSV utility pack** — NEXT. base64, hash(MD5/SHA), URL-encode, JWT decode, timestamp/epoch, UUID, diff, YAML↔JSON, CSV↔Excel/JSON, minifiers. Cheap pure-client keyword magnets. Mock first.
- **#6 PDF→Excel** — Pro, gated, unbuilt. Build at/near Pro launch.
- **v1.1 backlog:** fill-form **native AcroForm field click + Tab-through + "keep editable"**; photo-privacy **batch multi-file** + plate detection; fill-form/sign **draw-your-own signature pad**; passport **deepen sourcing for the ~25 non-verified exotic countries**.
**Phase 2 (after the 6):** Accessible/tagged PDF (PDF/UA — EU EAA live 28 Jun 2025) · Receipt→Spreadsheet (IDP/AI) · e-invoice (Factur-X) · AVIF/WebP · audio/subtitle · mail-merge · PDF→audio TTS. (§7 of roadmap doc.)
**Owner action items (at Pro launch):** create Stripe LIVE product/prices/coupon + live keys + **enable Customer Portal in LIVE** + flip billing; counsel review of claims/policies; USPTO/trademark; real-phone mobile QA spot-check; Cloudflare Full-strict SSL; Node 20→22; DMARC quarantine→reject.
**Big Pro pillars (designed, not built):** AI layer + File Vault ([[dailydesk-filevault-and-ai-design]], [[dailydesk-ai-cost-control]]).
**Monitoring:** self-healing canary (Node `canary.js` + Playwright `browser-canary.js`, 27 tools) + `/dashboard` (Pro stats, file-size buckets, "Run tests now"). Re-add `/redact-pdf` to browser canary when it launches. Add `pro_used` to OCR + AI when they ship.

## 8. Standing rules / constraints (from memory — DO NOT VIOLATE)
- **Secret keys NEVER in chat** (Stripe sk_/whsec_, SMTP pass, Google secret) — owner puts them in server `.env`.
- **NEVER auto-deploy fixes to prod without human approval** (self-healing); owner gives explicit deploy OKs.
- **NEVER touch Edit PDF's Codex-stabilized core logic** ([[dailydesk-editor-shell-plan]]).
- **Build EXACTLY to approved mockups; flag deviations for approval first** ([[dailydesk-feedback-match-mockup]]).
- **Any design discussed → committed to `docs/designs/` or `docs/artifacts/`** ([[dailydesk-feedback-commit-designs]]).
- **Every PR/press release saved in repo** ([[dailydesk-pr-archive]]).
- **No copy may read as AI-generated** ([[dailydesk-copy-voice]]). **On-page SEO on every route + add new routes to `app/sitemap.ts`** ([[dailydesk-seo-and-differentiation]]).
- **Checkout must NEVER fail from a system error** ([[dailydesk-checkout-reliability]]).
- **Review competitors (iLovePDF/Smallpdf/TinyWow) before each new tool** ([[dailydesk-feedback-competitor-benchmark]]). Every tool works cross-browser with fallbacks ([[dailydesk-cross-browser-fallbacks]]).
- **Be proactive**: problem→fix→quantified benefit→"want me to do it?"; just do cheap/reversible, ask on risky ([[dailydesk-feedback-be-proactive]]). Give the EXACT dashboard choice, not vague either/or ([[dailydesk-feedback-exact-guidance]]).
- **When context nears the limit, AUTO-post a dense paste-ready handover + ensure memory complete** ([[dailydesk-feedback-context-handover]]).

## 9. Immediate next step
Owner's last open choice: **start #5 Dev/CSV utility pack** (mock first), OR build the **fill-form native AcroForm v1.1** first. Awaiting the pick. Everything above is deployed & verified live on `main`.
