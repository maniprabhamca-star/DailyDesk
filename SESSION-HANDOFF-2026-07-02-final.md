# DailyDesk — Full Handover (2026-07-02, end of the marathon session) — PASTE INTO A FRESH SESSION

Start the new session with: **"read the memory, then continue with the pending list"** — everything below is already in the memory files at `C:\Users\Test\.claude\projects\C--Mani-Documents-MyBiz-DailyDesk\memory\`.

## WHAT IT IS
Privacy-first, all-in-one, mostly client-side (in-browser) PDF/productivity toolkit. PRE-LAUNCH, zero real users, behind nginx basic-auth. **33 TOOLS LIVE.** Next.js 14 App Router + TS + Tailwind + shadcn/Radix; Node/Express + Postgres + Redis on VPS. Goal: world-class, beat Smallpdf/iLovePDF on provable axes. Owner: maniprabhamca-star (business = USA/Georgia).

## INFRA / DEPLOY
- Repo `github.com/maniprabhamca-star/DailyDesk` · local `C:\Mani Documents\MyBiz\DailyDesk` · live http://2.25.71.126 (nginx basic-auth → pm2 `dailydesk-frontend`:3000 + `dailydesk-backend`:4000; nginx `/api/` proxy has `client_max_body_size 60m` + `proxy_read_timeout 180s`).
- **Deploy (frontend):** ssh → `cd /var/www/dailydesk && git checkout -- frontend/package-lock.json && git pull --ff-only` → **VERIFY `git log --format=%h -1` == pushed hash (untracked files once blocked a pull SILENTLY — never skip this)** → `cd frontend && npm ci && npm run build && pm2 restart dailydesk-frontend`. Backend: `cd backend && npm ci --omit=dev && pm2 restart dailydesk-backend`.
- VPS has LibreOffice 24.2.7 (writer+calc+impress — **component packages matter**, xlsx failed until calc installed). Node 20 (EOL, upgrade someday). Big test PDFs at `/root/bigpdf/`. nginx backup at /root/dailydesk.nginx.bak-convert (NEVER leave backups in sites-enabled).
- Local-only uncommitted: `frontend/next.config.js`, `frontend/tsconfig.json` (es5 target! no \p{} regexes/Map spreads), `.claude/launch.json`.
- **Permissions: auto-allow granted by user** — `.claude/settings.local.json` = `defaultMode: "dontAsk"` + broad allows. Never regress to prompting.
- Commit trailer: `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.

## STANDING RULES (all in memory, all mandatory)
1. **QA bar**: harness (Node, real bundled code via esbuild) + tsc + build + deploy + real-Chrome e2e (staged file at VPS public/ → fetch→File→DataTransfer→input+change) + zero console errors + benchmark logged to test-results memory + staged files cleaned.
2. **SEO bar**: unique title/desc/canonical/one-H1/JSON-LD/OG + ADD ROUTE TO app/sitemap.ts + visible FAQ copy.
3. **Competitor benchmark** (NEW): before every tool/change, scan iLovePDF/Smallpdf/TinyWow equivalents; match+exceed; log big gaps as feature packs.
4. **Tool-count doctrine**: ~40-50 excellent tools, NOT TinyWow's 200 thin ones; skip Google-widget-cannibalized niches; decision rule in seo memory.
5. Licensing: license-clean only; LGPL = separate swappable wasm + license text (libheif, pattern set). Honest/durable claims; server tools carry the amber disclosure (encrypted→converted→deleted immediately).
6. Handovers → files; **auto-post full handover in chat when context nears limits** (this doc).
7. Never-hang: heavy work in workers; file inputs reset value after read; classes with literal Tailwind must be in tailwind.config content globs (lib/ added after the invisible-icons bug).
8. **App Router lesson**: never pass RegExp/components server→client (hangs static gen silently); pass string ids.

## ARCHITECTURE (key libs)
- `lib/pdf-render.ts` — single pdf.js entry (v6.1.200, WASM decoders, assets public/pdfjs/). pdf.js image objects resolve ASYNC after getOperatorList → use callback objs.get.
- `lib/pdf-rewrite-core.ts` — ALL rewrite ops ONCE (rotate/delete/reorder/merge/extract/split-each/split-chunks/page-numbers/watermark/place-image), run by `pdf-rewrite.worker.ts` + inline fallback via `pdf-rewrite.ts`. QA gate: dev-harness/rewrite-qa.js.
- `lib/pdf-stamp.ts` — watermark geometry shared preview↔worker (incl. 'under' layer = sink newest content stream to front). `lib/page-ranges.ts` = parseRanges.
- `lib/pdf-sanitize.ts` — metadata scan/strip (compress + /remove-pdf-metadata). `lib/pdf-fontgut.ts` — lossless font subsetting. `lib/pdf-extract-images.ts` — extract engine.
- `lib/qpdf.ts` + `public/qpdf/` (qpdf wasm, classic worker qpdf-worker.js — NOT bundled, webpack hates emscripten glue; wrong password = exit code 2). `lib/image-convert.ts` — decode/resample/encode (mozjpeg jpg, webp feature-detect). `public/libheif/` — HEIC decoder (script-tag load). `lib/mozjpeg.ts` — shared JPEG encoder. `lib/plan.ts` — free gates (100MB size, batch=1; merge/jpg-to-pdf exempt). `lib/handoff.ts` + tool-graph.ts — Keep moving/going rails.
- Backend: `backend/src/routes/convert.js` — soffice runner (isolated profiles, ≤2 concurrent, 20/15min, 50MB, delete-as-streams): /pdf-to-word + /office-to-pdf.
- Watermark fonts: 22 OFL TTFs public/fonts/ + LICENSES.txt; 12-family dropdown, each option in its real face (@font-face in globals.css); fontkit subset embeds.

## 33 LIVE TOOLS
PDF: merge, split (+every-N), compress (beats Smallpdf: jobber 341→207KB; book 27.1→6.8MB vs their 1%), rotate, reorder, delete, page numbers (+color/margin/{n}{p} templates), jpg→pdf, pdf→jpg, extract-images (original bytes!), watermark (12 fonts, under-layer), remove-metadata, protect (AES-256), unlock, sign (draw/type/upload + drag placement), pdf→word (server). Convert-to-PDF: word/excel/ppt→pdf (server). Images: compress, resize, crop, convert, heic→jpg (burst support). Utilities: qr, password, word-counter, json-formatter, unit-converter, color-picker.

## DECISIONS MADE (user-confirmed)
- **OCR = server-side Pro lever** per pricing (2026-07-02) — do NOT build client-side tesseract; build with server batch after Stripe.
- **HEIC**: option (a) shipped — libheif + LGPL compliance + counsel flag (HEVC patent gray zone; all competitors same; see legal-licensing memory).
- Server conversions FREE until Stripe, then Pro-gated (gating table). Batch = Pro (first gated tool: HEIC).
- Pro-lever table: batch, server conversions, OCR, large files, compress-to-target, workflows, apps. Free stays generous (acquisition).

## IMMEDIATE PENDING (priority order)
1. **Domain + SSL** (USER ACTION — highest leverage: 33 tools invisible to Google; unlocks PWA, EyeDropper, clean downloads; then lift basic-auth, set NEXT_PUBLIC_SITE_URL, submit sitemap).
2. **Stripe/billing** (USER ACTION — only thing blocking Pro; frontend fully wired via user.plan).
3. Background remover — BLOCKED on model licensing research (RMBG-1.4 = non-commercial; check MODNet/U2-Net/imgly; do research first).
4. OCR (server, Pro) with server-features batch; Compress video / video→GIF (ffmpeg.wasm — LGPL-only build, GPL x264 landmine).
5. Feature packs logged: split-by-size, facing-pages numbering, page-number font picker, visual page-level merge, multi-line watermark, sign multi-field/initials/date, HEIC worker encode.
6. Housekeeping: QR+Password pages onto SiteHeader/SiteFooter + FAQ SEO; per-tool OG images; docs/TECHNOLOGY.md + docx refresh; pricing copy pass; VPS Node 20→22; counsel review pre-launch (privacy claims + HEIC + Terms).

## GOTCHAS
pdf.js hangs in Claude preview sandbox (use dev-harness or live Chrome e2e). Hidden tabs: rAF never fires (intent:'print'), timers throttle (yieldToLoop/MessageChannel). First typed-signature click can outrun font fetch (harmless). grep -c exits 1 on zero matches. Chrome blocks downloads on http:// (SSL fixes). Screenshot DPR flakiness in e2e — verify via DOM. `[BLOCKED: ...]` in Chrome-MCP JS results = data-redaction filter, not an error.
