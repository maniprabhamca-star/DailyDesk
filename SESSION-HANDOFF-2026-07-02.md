# DailyDesk — Session Handover (2026-07-02, end of day)

**WHAT IT IS:** Privacy-first, all-in-one, client-side (in-browser) PDF/productivity toolkit. PRE-LAUNCH, ZERO real users. Next.js 14 App Router + TS + Tailwind + shadcn/Radix + framer-motion; Node/Express + Postgres + Redis (auth only, VPS). Goal: ~30–40 tools + server features later (AI/Haiku, Office conversions, OCR, File Vault). Owner goal: world-class, beat big names (Smallpdf/iLovePDF) on provable axes, universal devices.

**INFRA/DEPLOY:** Repo `github.com/maniprabhamca-star/DailyDesk` · local `C:\Mani Documents\MyBiz\DailyDesk`. Live preview http://2.25.71.126 (nginx basic-auth → PM2 `dailydesk-frontend`:3000 + `dailydesk-backend`:4000). Deploy every change yourself:
`ssh -i /c/Users/Test/.ssh/id_ed25519 -o StrictHostKeyChecking=no root@2.25.71.126 'cd /var/www/dailydesk && git checkout -- frontend/package-lock.json && git pull --ff-only && cd frontend && npm ci && npm run build && pm2 restart dailydesk-frontend'`
(`npm ci` NOT install; verify via `curl 127.0.0.1:3000/<route>` on the VPS — the nginx route needs basic-auth). Commit trailer: `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`. Local-only uncommitted (don't commit): `frontend/next.config.js` (NEXT_DIST_DIR), `frontend/tsconfig.json`, `.claude/launch.json`. VPS Node = 20.20.2 (EOL; pdfjs v6 wants ≥22 — npm just warns; upgrade someday).

**MEMORY (auto-loads; ask "read the memory" for details):** `C:\Users\Test\.claude\projects\C--Mani-Documents-MyBiz-DailyDesk\memory\` — MEMORY.md index + per-topic files. Everything below is already saved there (pending-tasks = canonical tracker; test-results = permanent benchmark log to cite on tool pages).

**⭐ STANDING RULES (all in memory, all mandatory):**
1. Durable claims — design for the launched future, never "true today"; scope privacy claims to in-browser tools.
2. QA bar — code review + real e2e + mobile/desktop + edge cases + stress + no console errors before every ship.
3. SEO bar — every new page: unique title/desc/canonical/1 H1/JSON-LD/OG + **add route to app/sitemap.ts**; client pages get metadata via segment layout.
4. Never-hang/universal-device — workers for heavy work, hardwareConcurrency-scaled pools, LRU caches, MessageChannel yields (never setTimeout — bg-tab throttled), `intent:'print'` renders (rAF never fires in hidden tabs), dimension clamps.
5. License-clean assets only. 6. Mock up UI (or stage on localhost:3004 dev server) before changing pages — user approves first. 7. Write handovers/summaries to files. 8. Every file input must reset `e.currentTarget.value=''` after reading (same-file re-pick fires no change event). 9. Store every benchmark in test-results memory.

**LIVE TOOLS (16):** Merge, Split, Compress PDF, Rotate, Reorder pages, Delete pages, Page numbers, JPG→PDF, PDF→JPG, Watermark PDF, Compress Image, QR, Password (+ legal/pricing/home). Coming-soon groups displayed: Office conversions, OCR/AI, Edit/Sign, Images&media (HEIC→JPG, BG remover, video), Everyday utilities.

**ENGINE ARCHITECTURE (all shipped + live):**
- `lib/pdf-render.ts` — THE single pdf.js entry (pdfjs-dist **6.1.200**, WASM JPX/JBIG2 decoders = 16× faster scans; assets in `public/pdfjs/`, worker `/pdf.worker.min.mjs`): `getPdfjs()`, `pdfDocOptions(data)`, `openPdf`, cached `renderPage`, `useLazyPageThumb` (IO + LIFO queue, 3-concurrent, 8 eager, prefetchPageThumbs warms cache), `yieldToLoop()`.
- `lib/pdf-rewrite.ts` + `.worker.ts` — rotate/delete/reorder rewrites in a Web Worker (transferred buffers; inline fallback). **1GB PDF rotates in <1min, page responsive** (verified). Still main-thread: merge/split/page-numbers/watermark applies (queue item).
- Compress pipeline (`components/pdf/compress-tool.tsx`): classify (scan/image/text + p1StoredPx) → surgical image pass (DCT **and** FlateDecode office screenshots; DPI-aware, never-upscale) → **font subsetting `lib/pdf-fontgut.ts`** (lossless glyph gutting; guards in file header; harness `dev-harness/fontgut2.js` + pixel-diff QA gate `fontgut-qa.js`) → scan-page raster pass (parallel pool ≤4 pdf.js workers, per-page never-upscale targets, monotonic levels) → object-streams save; "Try a different level — same file" retry; live page-1 quality preview per level (scan files); never returns bigger.
- Brand A ("lifted tile") everywhere + favicon/icons/og.png (regen script `dev-harness/gen-brand.js`). Inline header search dropdown; ProofStrip + JumpBackIn on home; PageStrip stepper; $4/mo pricing framing.

**KEY BENCHMARKS (test-results memory has full list — cite only these):** 27MB JPX book: Rec 60% / Max 75% (competitors ~1%); office FTP file: 166→97KB **42%** ("4 images recompressed · 2 fonts slimmed · 2s"; was 6% two days ago; Smallpdf 82KB); image 8MB PNG→422KB; 1GB rotate 56s; 300MB rotate 51s (was frozen-4min pre-worker).

**IMMEDIATE NEXT STEPS (master priority in pending-tasks memory):**
1. **Extract images from PDF** (new tool — next up). Then PDF metadata sanitizer → HEIC→JPG (license-check decoder) → rewritePdf worker for merge/split/page-numbers/watermark → watermark layer-below-content.
2. Business blockers: **Stripe/billing** (only thing blocking Pro revenue; frontend fully wired via lib/plan.ts) and **domain+SSL** (lifts basic-auth → SEO starts accruing; PWA; recommended SOON — 16 tools invisible to Google). Then server features (Office/OCR/AI/Vault), QR+Password onto SiteHeader/Footer + FAQ copy, per-tool OG images, "On your device" chip durability, pricing copy (section B), counsel review.
3. Compress future: harsher image option to close Smallpdf's last 15KB; OCR'd-scan heuristic; qpdf-wasm structural.

**GOTCHAS:** pdf.js worker HANGS in the Claude preview sandbox (use dev-harness Node scripts, or e2e in user's real Chrome via extension: stage file at VPS `frontend/public/` + pm2 restart (public indexed at boot), `fetch→File→DataTransfer→input.files+change`; hidden tabs: IO needs a forced frame (screenshot), rAF never fires, timers throttle). Big-file test assets: VPS `/root/bigpdf/` (book/300MB/1GB + gen.js). Multi-port dev: `NEXT_DIST_DIR=.next-3004 npx next dev -p 3004` (user reviews there; Chrome extension can't open localhost). grep -c exits 1 on zero matches (breaks && chains). Never commit dev-harness/node_modules. Compress numbers on tool pages must stay honest if levels retuned.

Start the new session by reading the memory, then continue with queue item 1 (Extract images from PDF).
