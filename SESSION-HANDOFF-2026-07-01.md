# DailyDesk — Full Session Handover (2026-07-01)

Paste this into a fresh session to continue. Memory files at
`C:\Users\Test\.claude\projects\C--Mani-Documents-MyBiz-DailyDesk\memory\` auto-load and
already hold most of this — read `MEMORY.md` first.

---

## 0. What DailyDesk is
All-in-one, **privacy-first, client-side** productivity web app (like Smallpdf/iLovePDF but
tools run 100% in the browser — files never uploaded). Pre-launch, **login-protected test
site** (NOT production). Stack: **Next.js 14 (App Router) + TypeScript + Tailwind + shadcn/Radix
+ framer-motion** frontend; Node/Express + Postgres + Redis backend (auth only so far).
Business: USA/Georgia. Eventually ~30-40 tools across PDF/image/generators/workspace.

## 1. Infra & deploy (CRITICAL — I do this myself every change)
- **Repo:** https://github.com/maniprabhamca-star/DailyDesk · local `C:\Mani Documents\MyBiz\DailyDesk`
- **Live preview:** http://2.25.71.126 (VPS, nginx + PM2: `dailydesk-frontend` :3000, `dailydesk-backend` :4000). Plain **HTTP** (no SSL yet) behind HTTP Basic Auth.
- **Deploy (run after every push):**
  ```
  ssh -i /c/Users/Test/.ssh/id_ed25519 -o StrictHostKeyChecking=no root@2.25.71.126 'cd /var/www/dailydesk && git checkout -- frontend/package-lock.json && git pull --ff-only && cd frontend && npm ci && npm run build && pm2 restart dailydesk-frontend'
  ```
- **Verify:** `curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:3000/<route>` → 200. (nginx basic-auth 401s in non-interactive SSH; hit :3000 directly.)
- Workflow: commit (trailer `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`) → push `main` → deploy → verify. Always `git checkout -- frontend/package-lock.json` before pull; use `npm ci` not `npm install`.
- I **can** SSH from the session via Bash. Auto-deploy is expected, not optional.

## 2. Sandbox limitations (learned the hard way — DON'T re-learn)
- **Claude preview sandbox backgrounds the page** (`document.hidden=true`): **IntersectionObserver, scroll events, timers/animations, and screenshots DO NOT fire/work.** So anything scroll-triggered, animation, or pdf.js-render **cannot be verified in-sandbox** — needs the user's real browser.
- **pdf.js worker hangs in the sandbox** → verify pdf render logic headlessly via the Node harness at `scratchpad/pdfrender` (`disableWorker:true`, `@napi-rs/canvas` + `pdfjs-dist@3.11.174` legacy + `standardFontDataUrl`). See memory `dailydesk-pdfjs-render-harness`.
- What IS verifiable in-sandbox: static layout, DOM structure, computed styles, bounding boxes (getBoundingClientRect works even when hidden), non-pdf.js React interactions via direct `.click()`.

## 3. User's standing preferences (MANDATORY — in memory)
- **Show a MOCKUP before any home/landing UI change** (use the visualize/show_widget tool). Do NOT edit-then-show.
- **Home/landing copy + numbers are PLACEHOLDER.** It's pre-launch; write copy for the LAUNCHED product (all tools eventually live). **No "coming soon / roadmap" hedging** in marketing copy. Don't police "overclaims" on marketing breadth.
- **Keep the WHOLE project flow in memory** — user should never have to re-explain settled decisions. Update memory same-turn.
- **Always write summaries/handoffs to a FILE** (like this one) so they can copy.
- World-class/premium bar; quality + performance heavily invested; never compromise privacy/security.
- Spacing on the hero tiles must come from a real `gap`, NOT `justify-between` (tiles are content-height on mobile → justify-between collapses).

## 4. Current state — what's LIVE (10 tools)
Live tool routes: `/merge-pdf /split-pdf /compress-pdf /rotate-pdf /delete-pages-from-pdf
/add-page-numbers-to-pdf /jpg-to-pdf /pdf-to-jpg /tools/qr-code /tools/password`.
Everything else in the catalog is `soon` (Office conversions, OCR, AI, Edit/Sign, Workspace/Vault).

### Compress PDF (the flagship)
- DPI-aware surgical image downsample (CTM tracking) + scan-page rasterizer + smart-skip; mozjpeg WASM (`lib/mozjpeg.ts`, wasm in `/public`). Levels Light/Recommended/Strong/Maximum + "Squeeze harder". Never corrupts, never returns bigger.
- **Multi-page preview strip + Before/After viewer with loupe** (side-by-side desktop / flip toggle mobile), animated **SavingsRing**, quality badges. Shared renderer `lib/pdf-render.ts` (open-once, on-demand, cancellable, LRU-cached, DPR-aware).
- **Free-tier 100 MB size gate** (soft, offline) — `lib/plan.ts` (`usePlan()` from cached `dd_user.plan`, `canProcessSize`, `FREE_MAX_BYTES`) + `components/app/upgrade-notice.tsx`. Free/anon >100MB → upgrade prompt; Pro bypasses. Verified.

### Home page structure (order): hero → All tools (`AllToolsDirectory`, `#tools` anchor) → FeatureSpotlights → Why → Stats → Pricing → Footer.
- Hero cluster: purple box | **HeroShowcase** (animated demo cycling tools, aurora glow + tool watermark) | **HeroPrivacy** (stat-led "100% in your browser" + shield watermark). `components/home/hero-tiles.tsx`.
- Contextual suggestions: `lib/tool-graph.ts` (per-tool NEXT adjacency) drives "Keep moving"/"Keep going".
- Dynamic tool count: `catalog.liveToolCount` (auto-updates as `soon` tools go live).
- Pricing: single source `lib/pricing.ts` used by home teaser + `/pricing` (in sync). Compression is FREE; Pro = Office/OCR/AI/Vault + unlimited size + batch.

### Command palette (`components/command-palette.tsx`) — just rebuilt
- ⌘K launcher on the REAL `catalog` (was stale tools-config). Sections: **Recent** (`lib/recent.ts` + `components/app/record-recent.tsx` in root layout tracks tool visits), **Workflows** (soon), **Actions** (theme/all-tools/pricing/privacy), **All tools**. Keyboard nav, privacy footer. Opens from hero search / header search / ⌘K.

### Header (`app/page.tsx`) — home only
- **Bold quick-tool shortcuts** (Compress teal / Merge crimson / QR indigo, white icons).
- **Scroll hand-off search** — hidden at top (hero owns it), reveals on scroll. ⚠️ SEE §6.

### PWA (`public/manifest.webmanifest`, `public/sw.js`, icons, `components/pwa-register.tsx`)
- Manifest + maskable icons + conservative service worker (network-first nav, cache-first static, offline fallback). Registered production-only. ⚠️ **Service workers require HTTPS** — DORMANT on the current HTTP site; activates once domain+SSL is set up. `/security#offline` explains offline honestly.

### Result actions (`components/app/result-actions.tsx`, in shared `PdfDone`)
Export as → Image (hands to /pdf-to-jpg; Office = soon), Share (Web Share + download fallback), Print (iframe + new-tab fallback). On all single-PDF tools.

## 5. Key files map
- `frontend/app/page.tsx` — home (header, hero, sections). `frontend/app/layout.tsx` — root (CommandPalette, RecordRecent, PwaRegister, ThemeProvider, AuthProvider).
- `frontend/components/app/catalog.tsx` — **canonical tool registry** (groups, colors, soon flags, `liveToolCount`). Nav mega-menu + AllToolsDirectory + palette read this.
- `frontend/components/app/tools-config.ts` — STALE/legacy registry; being phased out. Don't add to it.
- `frontend/components/pdf/` — compress-tool, tool-page (shared PDF tool shell — server component), page-strip, before-after.
- `frontend/components/home/` — hero-tiles, all-tools-directory, feature-spotlights.
- `frontend/lib/` — pdf-render, plan, pricing, recent, tool-graph, handoff, download, mozjpeg, auth(.tsx).
- Node harness: `C:\Users\Test\AppData\Local\Temp\claude\...\fdfd9579-...\scratchpad\pdfrender\` (render-multipage.js, tool-graph-check.js, make-icons.js).

## 6. OPEN ISSUES / BUGS (prioritized)
1. **🔴 Header scroll-hand-off search NOT WORKING (unresolved).** On home, the header search should fade in on scroll (hero search owns the top). Tried IntersectionObserver (commit c4b1b2b) then a scroll listener (0120bdf) — user reports still not appearing. I could NOT verify (sandbox kills scroll/IO events — proven `scrollEventFired:0`). **Next step:** debug in a real browser (is the scroll event firing? is `showHeaderSearch` flipping? is the element `opacity-0→100`?). If fiddly, **fall back to header search ALWAYS visible** (simplest, guaranteed). Element: `button[aria-label="Search"]` in `app/page.tsx` header; state `showHeaderSearch`; effect ~line 56.
2. **🟠 Search + quick-tools are HOME-ONLY.** Tool pages (`tool-page.tsx`), `/pricing`, `/security` have their own DUPLICATED headers without search/shortcuts. **Recommended next build: extract ONE shared `<SiteHeader>`** used everywhere (search always-visible off-home, scroll hand-off on home) — fixes consistency + header duplication in one move. User was choosing (a) build shared header vs (b) always-visible header search.
3. **🟠 Domain + SSL (HTTPS)** is the big pre-launch unblock: activates the PWA/offline (SW needs HTTPS), removes Chrome "insecure download" warnings + the basic-auth gate. Needs user's domain → point DNS at VPS → Let's Encrypt. I can't do the DNS part.
4. **🟡 Free/Pro enforcement not built** (beyond the 100MB compress gate). No backend `plan` field, entitlement middleware, Stripe, or usage metering. Server Pro features (Office/OCR/AI/Vault) not built → naturally gated when built. Decision made: gate SCALE (size/batch) not compression quality; soft-gate via cached plan. See memory `dailydesk-freemium-gating-status`.
5. **🟡 Recorded via memory but verify in real browser:** PWA install+offline; Export/Share/Print on results; compress page-switch flicker fix; the command palette Recent/scroll — all pdf.js/scroll/SW dependent = user's real-browser pass pending.

## 7. IMMEDIATE NEXT STEPS (recommended order)
1. **Fix the header search** (§6.1) — real-browser debug or fall back to always-visible.
2. **Extract shared `<SiteHeader>`** (§6.2) → search + quick-tools on every page.
3. Domain + SSL (§6.3) — unblocks PWA/offline for real + lifts download warnings.
4. Then: build the first server-side Pro feature (Office conversion PDF↔Word, or OCR) WITH the plan/entitlement backbone (backend `plan` + middleware + Stripe), so it ships already-gated.
5. Roll size-gate + Export/Share/Print onto more tools; keep adding client-side tools (Watermark, Protect, Sign — some are client-side-doable).

## 8. Gotchas
- Deploy: always `git checkout -- frontend/package-lock.json` before pull; `npm ci`.
- TS target here allows `for…of` over arrays/Map entries (build passes), but prefer arrays/indices for safety.
- Header has `backdrop-blur-xl` → creates a containing block; `position:fixed` children get trapped inside the header (that's why the mega-menu outside-click uses a ref handler, not a fixed backdrop).
- Two different "privacy pills" existed: `/pricing` hero pill (KEEP — main pages) and the tool-page pill (REMOVED). The "Private by design" TILE in the hero is NOT in the Tools dropdown — it just shows behind it.
- Preview `preview_eval` detaches on `window.location.assign` mid-eval — navigate, then read in a separate call.
