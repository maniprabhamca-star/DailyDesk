# DailyDesk — Session Handover (2026-07-01, v2)

## 0. WHAT IT IS
Privacy-first, all-in-one, **client-side (in-browser)** productivity/PDF toolkit (Smallpdf/iLovePDF-style, but tools run 100% in the browser — files never uploaded for the in-browser tools). **PRE-LAUNCH, ZERO real users.** Login-gated preview only. Stack: **Next.js 14 App Router + TS + Tailwind + shadcn/Radix + framer-motion**; Node/Express + Postgres + Redis backend (**auth only so far**). Eventually ~30–40 tools **plus server-side features (AI, OCR, Office conversions, File Vault)**.

## 1. INFRA & DEPLOY (I do this every change)
- Repo: `https://github.com/maniprabhamca-star/DailyDesk` · local `C:\Mani Documents\MyBiz\DailyDesk`
- Live (preview, HTTP + basic auth): **http://2.25.71.126** — VPS, nginx + PM2 (`dailydesk-frontend`:3000 / `dailydesk-backend`:4000)
- Deploy after every push:
```
ssh -i /c/Users/Test/.ssh/id_ed25519 -o StrictHostKeyChecking=no root@2.25.71.126 'cd /var/www/dailydesk && git checkout -- frontend/package-lock.json && git pull --ff-only && cd frontend && npm ci && npm run build && pm2 restart dailydesk-frontend'
```
- Verify: `curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:3000/<route>`. Commit trailer: `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.
- **Uncommitted local-only files (intentional, do NOT commit):** `frontend/next.config.js` (has `distDir: process.env.NEXT_DIST_DIR||'.next'` so multiple `next dev` can run concurrently on preview ports), `frontend/tsconfig.json` (Next auto-churn), `.claude/launch.json`.

## 2. MEMORY SYSTEM (persists across sessions)
- Files live at `C:\Users\Test\.claude\projects\C--Mani-Documents-MyBiz-DailyDesk\memory\` (**NOT in the project repo** — hidden `.claude` folder).
- **`MEMORY.md`** = the index, the ONLY file auto-loaded (in full) each session. Individual `.md` files auto-recall relevant snippets OR are read on demand ("read the memory file").
- Everything from this session is saved. Key files: **`dailydesk-pending-tasks.md`** (the living tracker — this session's redesign, honest-claims, durability principle, launch checklist), **`dailydesk-freemium-gating-status.md`** (gating + enforcement). All facts below are in memory.

## 3. WHAT SHIPPED THIS SESSION (all LIVE on `main` + VPS; newest→oldest commits)
- `0e64a23`/`79ab781`/`bc8f5e7` footer wordmark: right-aligned to divider, **10px above the line** (MEASURED via preview_eval + Range glyph bbox), `lg`-only (hides on small screens where the bottom bar stacks taller and would cross).
- `b27bf6a` **durable privacy claims**: hero headline `None of it uploaded` → **`Your files stay yours.`**; subhead `100% on your device` → `private by default`; stats `0 Files uploaded`→`0 Ads or trackers`, `100% In your browser`→`100% Yours`; **removed tool-page privacy pill**; added **`/security` "Where your data goes" table** (id=`where-data-goes`: In-browser / AI / Office+OCR / Vault).
- `fbb2078` footer badge `100% in your browser` → **`Private by design`**.
- `2bd7e2f` **command-palette flicker fix**: centered dialog used `-translate-x-1/2` + `animate-fade-in` (keyframe set `translateY` → wiped centering). Added dedicated `dialog-in` keyframe (keeps `translate(-50%)`) in `tailwind.config.js`; palette uses `animate-dialog-in`.
- `c1ac499` **removed dead hero code**: deleted HeroV1/HeroV2/HeroVariant/bento + `components/home/hero-tiles.tsx` (HeroShowcase/HeroPrivacy). `page.tsx` renders `<HeroHybrid/>` directly. Hybrid is the ONE hero.
- `4edeb95` **batch gate** in `lib/plan.ts` (`canBatch`, `allowedBatchCount`, `FREE_MAX_BATCH=1`).
- `7bba303`/`c479c35` **honest "where it runs" badge taxonomy** in `catalog.tsx`.
- `2e3ea3f` shipped **Hybrid hero** as live default.
- `6265c6b`/`3a3e823` **Direction-1 header** (search-first) + shared `<SiteHeader>` + dark footer.
- `612fda7` fixed the **header scroll-search bug** (root cause: `overflow-x-hidden` on the root wrapper forced `overflow-y:auto`, hijacking the scroller so `window` scroll never fired → changed to `overflow-x-clip`).

## 4. KEY FILES
- `app/page.tsx` — home (renders `<SiteHeader/>`, `<HeroHybrid/>`, AllToolsDirectory, FeatureSpotlights, Why, Stats, Pricing teaser, **dark footer** incl. the wordmark)
- `components/app/site-header.tsx` — **shared header on every page**: logo, Tools mega-menu, Pricing, prominent ⌘K command search (search-first), `On your device` chip, theme, Log in, Get started, mobile menu. (heroSearchRef prop exists but unused now → header search always visible.)
- `components/home/hero-variants.tsx` — **only HeroHybrid** + deps (ProductCluster, FramedSlider = sliding browser-framed Compress→Merge→Convert showcase, ToolScene, SLIDES, TrustChips)
- `components/app/catalog.tsx` — **single source of truth** for tools + the "where it runs" `BADGE` taxonomy + `liveToolCount`
- `lib/plan.ts` — freemium gates (`usePlan`, `canProcessSize` 100MB, `canBatch`/`FREE_MAX_BATCH=1`)
- `lib/auth.tsx` — `User.plan` from backend `/api/auth`, cached in localStorage `dd_user` (offline)
- `app/security/page.tsx` (LegalPage) · `app/pricing/page.tsx` · `lib/pricing.ts`
- `components/pdf/tool-page.tsx` — shared PDF tool shell (uses SiteHeader; pill removed)
- `components/command-palette.tsx` — ⌘K palette (mounted in layout)

## 5. ⭐ DURABILITY / HONEST-CLAIMS PRINCIPLE (CRITICAL — user corrected me twice)
**Pre-launch, zero users → design ALL copy/claims for the DURABLE FUTURE, never "true today."** Server features WILL come (AI/OCR/Office/Vault), so never ship/defend a claim that's "true today but false once server tools ship."
- **Scoping rule:** absolute "never uploaded / in your browser" claims must be scoped to **in-browser tools** (done: footer proof line, pricing bullets/FAQs, hero tile). Hero headline now durable (`Your files stay yours`).
- **STILL BLANKET (open):** the header **`On your device` chip** (`site-header.tsx`) is on every page incl. future server-tool pages → should become durable (`Private by design`) or badge-aware.
- **Legal (pre-public-launch checklist):** truthful descriptive claims are fine; have counsel skim privacy/security claims + Privacy Policy/Terms; when server tools ship, their pages must disclose data IS sent (AI: sent for one request, not stored, never trained on; Office/OCR: processed then deleted; Vault: E2E encrypted).

## 6. FREEMIUM GATING (decided + wired; enforcement is SOFT/client-side)
- **Chain FULLY WIRED:** login → backend `user.plan` → cached localStorage (offline) → `usePlan()` → `canProcessSize`(100MB) + `canBatch`(free=1 file/job). "free=free, pro=pro" enforces the moment `plan==='pro'`.
- **Soft gate** (client-side JS, bypassable by a rare dev, esp. offline) — ACCEPTED because the gated client features (batch/size) cost **$0**; the money-costing features (Office/OCR/AI/Vault) are **server-enforced** (unbypassable).
- **ONLY missing piece to grant Pro = Stripe/billing backend** that sets `user.plan='pro'`. Until then everyone is `free`. No frontend change needed when billing ships.
- **Confirmed Pro-lever table (authoritative):** Pro = Batch/bulk (CLIENT-side, $0 margin), Server conversions (server, charge), OCR (server), Large file sizes (free ~50–100MB / Pro unlimited), Saved workflows, Desktop+mobile apps. KEEP FREE = unlimited single-file merge/split/compress/convert/rotate/QR/password (no daily limit, no ads). **Merge/JPG→PDF are EXEMPT from `canBatch`** (many-inputs→one-output = a single job, not batch).

## 7. BADGE TAXONOMY (`catalog.tsx` — drives every tile/legend, honest per tool)
`Badge = 'device' | 'server' | 'ai' | 'encrypted'`: device="Runs in your browser"(Lock,green); server="Processed on our servers"(Cloud,amber — Office conv + OCR + Link-in-bio); ai="AI-powered"(Sparkles,purple — Chat/Summarize/Translate); encrypted="End-to-end encrypted"(KeyRound,blue — File Vault). **OCR=server** (it's a paid Pro feature; I briefly mis-tagged client-side — reverted).

## 8. OPEN / PENDING (priority order)
1. **Header `On your device` chip → make durable** (Private by design / badge-aware) — last blanket claim (§5).
2. **Stripe/billing backend** — the ONE thing between now and real paying Pro users (§6). First server-Pro milestone.
3. **Build server features** (AI via Haiku, Office conversions, OCR, File Vault) WITH plan/entitlement + honest per-tool disclosure. Batch tool too (gate ready).
4. **Domain + SSL/HTTPS** — big unblock: activates PWA/offline, lifts insecure-download warnings + basic-auth gate; enables SEO/sitemap submission.
5. **Unify QR + Password pages** onto the shared `SiteHeader` — they still use the old `components/app/tool-header.tsx` (ToolHeader), so they didn't get the Direction-1 header.
6. **Real-browser QA pass** (sandbox can't do scroll/animation/pdf.js) on: header search scroll-reveal, hero slider motion, palette, PWA later.
7. Then: more tools, SEO (per-tool keyword URLs/schema/sitemap), pricing enforcement wider, app-shell vision.

## 9. IMMEDIATE NEXT STEPS
(a) Decide header chip wording (§8.1). (b) Domain+SSL (§8.4) OR (c) start the first server Pro feature + Stripe/plan backbone (§8.2–3). (d) Unify QR/Password header (§8.5).

## 10. GOTCHAS / SANDBOX LIMITS
- Preview sandbox backgrounds the page (`document.hidden`) → scroll events, IntersectionObserver, timers/animation, screenshots DON'T fire. Use `getBoundingClientRect`/`Range.getBoundingClientRect()` for layout math (that's how the wordmark was placed). Real-browser only for motion.
- pdf.js worker hangs in sandbox → verify render via Node harness `scratchpad/pdfrender` (disableWorker).
- Deploy quirk: after removing an import mid-edit, HMR logs a **stale** `ReferenceError` that lingers in the log tail even after the fix — check the LATEST `GET / 200` lines, not a grep for "error".
- `overflow-x-hidden` silently forces `overflow-y:auto` (hijacks the scroller) — use `overflow-x-clip`. Absolute-centering (`-translate-x-1/2`) + a transform keyframe conflict → give centered dialogs their own translate-preserving keyframe.
- Preview servers: launch on separate ports with `NEXT_DIST_DIR=.next-x NEXT_PUBLIC_HERO_VARIANT=…` (variant switch is now removed, so just for isolated builds). All were stopped at end of session.

## 11. STANDING USER PREFERENCES (MANDATORY)
- **Design for the durable future, not "true today"** (§5). Pre-launch, no users.
- Mock up before home/landing UI changes; iterate on preview ports; **don't contradict prior decisions without flagging** (I slipped on OCR + the tool-page pill — user rightly pushed back).
- Keep the whole project flow in memory; never make the user re-explain. Always write handoffs to a file.
- Assets license-clean/original (lucide ISC, Inter OFL); never copy competitor copy/assets.
