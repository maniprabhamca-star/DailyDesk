# DiemDesk — Session Handover (2026-07-24)

Paste into a fresh session to continue. Self-contained. Memory files hold durable detail; this is the map + exact current state + next steps. **Latest commit: `90841d4`. Working tree clean** (only `.claude/launch.json` + `frontend/tsconfig.json` show modified — pre-existing, not ours).

---

## 0. RULE #1 — verify, don't trust recall
On load-bearing facts (is X built? is a flag on? does the schema match?) **check first** (git log, grep, curl, ssh). Memory is point-in-time; multiple past sessions were wrong from memory and settled in seconds by a check.

## 0b. HOW THE OWNER WANTS ME TO WORK (mandatory, in memory)
- **Crisp replies** — summary + action items, no essays/running commentary. [[dailydesk-feedback-crisp-replies]]
- **Mock-first** — any UI/design change: build a mockup, publish as an **Artifact**, get approval, THEN code. Do NOT jump to code. [[dailydesk-feedback-match-mockup]]
- **Never overwrite detailed artifacts/docs — UPDATE in place.** A generator must never target a hand-maintained file. (I broke this once this session; see §6.) [[dailydesk-feedback-never-overwrite-artifacts]]
- **Changelog** entry with every meaningful ship (`frontend/lib/changelog.ts`). **Overview/roadmap/artifacts auto-current.** Counts are catalog-derived, never hand-typed. **SEO per tool** (title ≤60/desc ≤155/canonical/OG/JSON-LD + add route to `app/sitemap.ts`). **QA**: real e2e + mobile+desktop + no console errors before ship. [[dailydesk-changelog-rule]] [[dailydesk-feedback-keep-overview-current]] [[dailydesk-qa-testing-bar]] [[dailydesk-seo-and-differentiation]]
- **Be proactive**; **competitor-benchmark** before new tools; **human copy voice** (no AI tells); **handovers → write to a FILE** (this one). [[dailydesk-feedback-be-proactive]] [[dailydesk-copy-voice]] [[dailydesk-feedback-copyable-summaries]]

---

## 1. WHAT DIEMDESK IS
Privacy-first document/utility toolkit. **67 tools live** at **https://diemdesk.com** (public, HTTPS via Cloudflare). Product = **DiemDesk** (memory slugs still say `dailydesk-*`). Moat: on-device processing (files never uploaded for in-browser tools — verifiable in DevTools Network tab), honest server-tier for the few that must upload, AI that cites sources, India-first paid flagship. Legal entity **JPNM Rapid Universe LLC** (Marietta/Smyrna GA; never customer-facing). Owner: Mani (maniprabhamca@gmail.com).

## 2. STACK & DEPLOY
- **Frontend:** Next.js (app router) `frontend/`, PM2 `dailydesk-frontend` :3000.
- **Backend:** Express `backend/`, PM2 `dailydesk-backend` (cluster ×2) :4000 (localhost only).
- **DB:** Postgres (users.id = **UUID** — bit me twice). Redis for rate-limit + AI budget. Schema `backend/src/db/schema.sql` (applied by hand on VPS, not auto-migrated; watch for duplicate CREATE-IF-NOT-EXISTS blocks).
- **VPS:** `root@2.25.71.126` (key `~/.ssh/id_ed25519`). Shared box (Serplytic/BAP containers on other ports — NOT DiemDesk). Node = **v22.23.1**.
- **Deploy loop (memorize):** commit+push local → on VPS `cd /var/www/dailydesk && git checkout -- frontend/package-lock.json 2>/dev/null; git pull --ff-only` → `cd frontend && npm run build && pm2 restart dailydesk-frontend`. New backend dep → `npm ci`. Schema change → run block via node script on VPS.
- **Verify pattern:** real e2e before "done". Headless node tests via **sucrase/register** (set `NODE_PATH=".../frontend/node_modules"`, dynamic-import pdfjs by ABSOLUTE path); browser-pane **JS checks** (getBoundingClientRect/getComputedStyle) for layout — **the screenshot tool is flaky/times out**, use JS. Owner JWT for API tests; canary bypass header `x-canary: <CANARY_TOKEN>`.

## 3. ⭐ THE ONE THING BLOCKING REVENUE (unchanged)
Everything's built, live, Stripe-wired, but:
1. **`WAITLIST_MODE = true`** in `frontend/lib/flags.ts` → Pro CTA = waitlist, nobody can pay. **The single flag between brochure and business.**
2. **Live Stripe prices = OLD $4.99/$49**, not the decided **$5.98/mo + $60/yr** (founding $4.99 first 1,000). Stripe prices are immutable → create NEW prices + update `STRIPE_PRICE_ID`/`STRIPE_PRICE_ID_YEARLY` in VPS backend `.env` BEFORE flipping the flag. INR: **₹499/mo · ₹4,999/yr**; Statements Pro **₹1,499/$19/mo** (separate tier). [[dailydesk-freemium-gating-status]] [[dailydesk-pro-pricing-and-differentiators]]

**Owner's stated #1 goal (2026-07-23):** pull EVERY organic-traffic / SEO win; reach the most customers; convert them.

## 4. WHAT SHIPPED THIS SESSION (all prod-verified)
**Security / CF hardening (owner did the dashboard):** rate-limit rule `auth-brute-force` on `/api/auth*` (10 req/10s → Block; verified 429 on burst), Bot Fight Mode ON, Browser Integrity ON, Security Level = auto ("always protected"). Backend already had 20/15min auth limiter. [[dailydesk-security]]

**3 NEW FREE on-device tools** (approved-mockup → built one-at-a-time, full QA+SEO+sitemap+changelog):
- **PDF→Markdown** `/pdf-to-markdown` — `lib/pdf-markdown-core.ts` (pure; reuses table-extract's itemsToTable/looksTabular; headings by font-size/bold, lists, GFM tables from the tabular y-BAND only) + `lib/pdf-markdown.ts` (pdf.js IO, `extractPages` cached so toggles re-run only the pure core) + `lib/md-render.ts` (safe md→html preview) + tool component. 11/11 core + 6/6 full-pipeline with REAL pdf.js. **v1 = NO image extraction** (flagged; v1.1). Icon Hash.
- **Bates numbering** `/bates-numbering` — `lib/bates-core.ts` (pure label/geometry/range) + `lib/pdf-bates.ts` (pdf-lib IO, **continuous numbering ACROSS a file set**, multi→.zip). 6 corners, page range, live schematic preview. 23/23 incl. full IO proven (000001→000003 across 2 files). Icon ListOrdered. **FREE** (was planned Pro).
- **PDF→Audio** `/pdf-to-audio` — `lib/speech-core.ts` (pure sentence segmentation, 7/7) + `lib/pdf-speech.ts` (pdf.js text) + Web Speech player (voice/speed/pitch, sentence follow-highlight, tap-to-jump; sentence-by-sentence avoids Chrome long-utterance cutoff). Icon Volume2. **MP3 file export = deliberate future Pro add-on** (free v1 = playback only). [[dailydesk-pro-pricing-and-differentiators]]

**SEO + consistency:** gated the leaked `/annotate-pdf` `/redact-pdf` `/ocr-pdf` (were reachable by direct URL though catalog-`soon`); added WebPage+BreadcrumbList JSON-LD to 10 content pages via shared `components/seo/page-jsonld.tsx`; OG on /free + /feedback; killed the hard-typed "35+ tools" drift (home + about now derive `liveToolCount`).

**/compare:** added moat rows — PDF→Markdown (nobody has it), Bates free (paid desktop elsewhere), read-aloud (Adobe Reader only).

**Home page (see §5).** **Growth plan** committed `docs/designs/growth-distribution-plan.md`.

**Artifacts:** detailed status board + product overview restored & UPDATED in place to 67 tools + tiered Pro roadmap; **deleted the auto-generator that had overwritten them.**

## 5. HOME PAGE — current design state (all live; each has a revert switch) [[dailydesk-home-and-growth]]
- **Hero right = REAL working compressor** (`components/home/hero-live-demo.tsx` + `lib/hero-compress.ts`); floating brand tiles kept at CLASSIC CORNERS (hidden < sm). **⟳ Revert: `HERO_VARIANT = 'classic'` in `hero-variants.tsx`** (currently `'live'`).
- **Colour hierarchy fixed:** demo action colour = **green emerald-600 `#059669`** (was indigo). Rule adopted: **indigo = brand (logo/headline/"Start free"); green = action + privacy.** "One filled button per screen." Owner picked shade **B**; **D `#16a34a`** (exact "on your device" badge green) is the standing alternative. ⚠ "Start free" vs "No signup" copy contradiction flagged; **owner said DON'T change Start free** → left as-is.
- **"Three steps" section** (`components/home/tool-in-action.tsx`) after the tools grid, before ProofStrip; reuses the **exported `FramedSlider`** (cycling browser banner, no tiles), copy-left/banner-right, dynamic `{liveToolCount}`. ⚠ It sits ~36% down the page — owner found it hard to find; **I recommended moving it ABOVE the tools grid; owner hasn't decided.**
- **Category nav** (`all-tools-directory.tsx`): tab (count pills + colour) with desktop toggle to left-rail; mobile always tabs; tiles unchanged. **⟳ Revert: `USE_LEGACY_NAV = true`.** Persists in localStorage `dd-tools-view`.
- **ProofStrip already exists** ("Put to the test" / "The scans other tools give up on") — the real-benchmark proof-numbers idea is ALREADY on home. Don't rebuild.
- Editor showcase image is already a REAL pdf.js render (old to-do done).

## 6. GOTCHA I HIT THIS SESSION — READ
- I pointed a catalog auto-generator (`gen-status-artifacts.mjs`) at the two hand-authored detailed artifacts and **clobbered them** (37.8KB→7.5KB, 23.9KB→6KB). Restored from `git show dac3171:` + updated in place; **deleted the generator.** New MANDATORY rule in memory: never overwrite detailed files — update in place; a generator must never target a hand-maintained file. [[dailydesk-feedback-never-overwrite-artifacts]]
- I once pushed an **invalid JSX comment inside `return (`** → broke the VPS build (prod stayed up on last good build; next commit fixed). Lesson: re-run `tsc` after every edit before pushing.
- Commit `70d829a` has a stray `EOF` line in its message (cosmetic; not force-pushed).
- **Standing artifact cleanup for owner:** a stale artifact URL `.../019cf71f-...` ("DiemDesk — Tool Status Board", from the temp `-detailed` file) points at nothing; owner to delete it at claude.ai/code/artifacts (I can't delete artifacts).

## 7. PENDING — ranked by leverage
1. **⭐⭐ FLIP REVENUE ON** — create new Stripe prices ($5.98/$60 + founding coupon; INR too, RBI e-mandate for recurring INR) → update env price IDs → `WAITLIST_MODE=false`. Precondition for the entire growth plan. (§3)
2. **⭐ Un-gate Bank Statement Converter** (paid flagship, ~70% built). Owner precondition: import a generated **Tally XML into real Tally Prime**, confirm ledgers/debit-sign; run 3-4 real statements. THEN `STATEMENT_QUOTA_ENABLED=true` + `STATEMENT_FREE_PAGES=5`, flip `/bank-statement-converter` flag, add to sitemap. 11 bank landing pages rank toward a locked door until then. [[dailydesk-statement-converter]]
3. **Owner UI click-tests** (features are API-verified): real File Vault ceremony (SAVE recovery key — unrecoverable by design); AI trio; Redact AI-find; Notes/Habits/Budget/Receipt; incognito "Continue with Google" with a non-test Gmail (consent screen published?).
4. **Anthropic credit** ~$4.99 (fine for owner testing) — **top up before public AI launch**, then `AI_ENABLED=true` + flip 4 AI flags coming_soon→pro. [[dailydesk-anthropic-api-setup]]
5. **Home decisions:** move "Three steps" above the tools grid? green shade B vs D? "Start free" left as-is per owner.
6. **Growth plan execution** (`docs/designs/growth-distribution-plan.md`) — after revenue flip: Privacy Guides + Tier-1 directories, EIN PR (Atlanta vs Marietta location field), how-to guides, Show HN/Reddit, then TWA, then Product Hunt (only once billing converts). SEO gaps: thin internal linking, no how-to layer, CWV never measured, IndexNow for the 3 new tools.
7. **Platform:** Android via **TWA** (NOT native Capacitor) after SW soak (soak was 2026-07-20→27) + revenue flip. Extension deferred. [[dailydesk-platform-strategy]]
8. **New Pro roadmap (tiered, revenue-safe)** — deterministic first (pure margin): self-destruct encrypted shares (best idea, viral loop), saved workflows+presets, trust pack (redaction cert + RFC-3161), brand kit; then metered server/AI: send-large-file, PDF→Audio MP3, e-Invoice. All in the status board artifact + [[dailydesk-pro-pricing-and-differentiators]].

## 8. SMALLER / OPTIONAL
- Canary doesn't cover the 9 auth/Pro-gated tools (needs a logged-in canary user).
- CF Full-strict SSL (origin has a proper CF Origin CA cert now — owner confirm dashboard SSL mode); AI-crawler robots.txt decision (GPTBot/ClaudeBot blocked; ChatGPT-search/Perplexity allowed).
- Long-tail: PDF/UA, PDF→EPUB, e-Invoice, RFC-3161, chained one-drop workflows.

## 9. KNOWN GOTCHAS (save yourself the pain)
- **users.id = UUID.** Test-user inserts need `name` (NOT NULL, no default).
- **Headless tests:** sucrase/register + `NODE_PATH` to frontend node_modules; dynamic-import pdfjs by absolute file URL (NODE_PATH doesn't cover ESM dynamic import). pdfjs legacy in node needs `disableWorker:true` (+ `standardFontDataUrl` warning is harmless).
- **pdf-lib `Uint8Array`→`Blob`** TS error: wrap as `new Blob([new Uint8Array(bytes)])`.
- **Screenshot browser-pane tool flaky** — verify with `javascript_tool` bounding-rects/computed-styles.
- **`git pull` on VPS** conflicts on `frontend/package-lock.json` — `git checkout --` it first.
- **`.next-*` dirs** litter git status as untracked — ignore; only stage the exact files you changed.

## 10. SESSION HYGIENE
Owner is token-conscious: crisp replies, mock-first, verify-don't-trust. Compact at task boundaries. `/resume` to reread old sessions.

---
**Latest commit `90841d4`. 67 tools live. `WAITLIST_MODE=true` (revenue not on). All of the above deployed + verified. Memory index = `MEMORY.md` (~60 files, current).**
