# DailyDesk — Session Handover 2026-07-03

Paste into a fresh session, or just say: **"read the memory, then continue with the pending list"** — everything below is already in the persistent memory files.

**WHAT IT IS:** Privacy-first, all-in-one, mostly in-browser PDF/productivity toolkit. PRE-LAUNCH, zero users, behind nginx basic-auth. **34 tools live** (37 keyword pages incl. /wifi-qr-code + /vcard-qr-code). Next.js 14 App Router + TS + Tailwind + shadcn; Node/Express + Postgres + Redis on VPS. Goal: world-class, beat Smallpdf/iLovePDF on provable axes.

**INFRA/DEPLOY:** Repo `github.com/maniprabhamca-star/DailyDesk` · local `C:\Mani Documents\MyBiz\DailyDesk` · live http://2.25.71.126 (pm2 frontend:3000 backend:4000). Deploy: ssh → `git checkout -- frontend/package-lock.json` → `git pull --ff-only` → **verify deployed hash == pushed hash** → `npm ci` → build → pm2 restart → curl 127.0.0.1:3000/<route>. Auto-allow permissions ON (permanent). Commit trailer: `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`. Local-only uncommitted: next.config.js, tsconfig.json (es5 — no `\p{}` regexes), .claude/launch.json (has `dailydesk-frontend-prod` for preview e2e).

**SHIPPED THIS SESSION (2026-07-02→03):**
1. `dbe0876` QR + Password onto shared PdfToolPage shell at keyword URLs **/qr-code-generator + /password-generator** (old /tools/* 308-redirect; old app-shell sidebar/bottom-nav/tool-header DELETED; login/register land on `/`).
2. `166339a` QR content types (Link/Text/**Wi-Fi**/Email/Call/SMS/**vCard**) via pure `lib/qr-payload.ts` (jsQR round-trip verified) + SEO pages **/wifi-qr-code /vcard-qr-code**; Password **passphrase mode** (`lib/eff-wordlist.ts`, EFF 7776 words, CC-BY 3.0 attributed, lazy chunk) + **time-to-crack estimate**.
3. `42bbb9e` **QR styling** — `lib/qr-paint.ts` (square/rounded/dots modules, square/rounded eyes, 2-color gradient; canvas + SVG twin). **GATE: dev-harness/qr-style-qa.js** (48 jsQR decode runs — rerun after ANY qr-paint change; caught 3 real bugs: dots need 100% inscribed circles, TIMING+ALIGNMENT patterns must stay solid squares in dots mode). Hero CTA compacted → "Start free" (120px).
4. `a2eac38` **REMOVE BACKGROUND (tool #34)** — `/remove-background`: ISNet isnet-general-use (Apache-2.0) QUInt8-quantized on the VPS (170→44MB, **MAE vs fp32 = 0.0008**), onnxruntime-web (MIT), model+runtime in `/public/models` + `/public/ort` with LICENSE files. **Inference in classic worker `public/bg-worker.js` (importScripts UMD) — LESSON: bundling onnxruntime-web into a webpack worker chunk FAILS (import.meta → Terser); use the qpdf public-classic-worker pattern.** Main-thread UMD fallback. Matte 1024²→original-res composite = full-res transparent PNG. Live e2e: bg alpha=0/subject 255, first run 67s (one-time 44MB download), cached 34s. **Perf levers logged:** COOP/COEP after SSL → multithread wasm; fp16 variant for WebGPU; BiRefNet-lite (MIT) HD mode.

**LICENSING (researched 2026-07-03, in memory):** ISNet/DIS = Apache-2.0 ✅ (build base) · BiRefNet = MIT ✅ (HD path) · MODNet = Apache but portrait-only · @imgly = AGPL ❌ · RMBG-1.4/2.0 = non-commercial ❌. Counsel note: DIS5K dataset terms PDF (weights-license-governs norm; flagged like HEIC).

**🎯 USER-APPROVED BUILD QUEUE (work top-down):**
1. ✅ Background remover — DONE.
2. **Flatten PDF** (qpdf-wasm already integrated — quick win) + **Scan QR from image** (jsQR proven in harness — quick win).
3. **Video pack**: Compress video + Video→GIF (ffmpeg.wasm — LGPL-ONLY build, no GPL x264).
4. **Feature packs**: Split by-max-size + multi-range; Page numbers facing-pages + font picker; Merge visual page-level; Sign initials/date/multi-field; Watermark multi-line/hex.
5. **HTML/TXT/RTF/ODT→PDF** (existing hardened soffice endpoint pattern; free until Stripe).

**BLOCKED ON USER:** Domain+SSL (#1 growth unlock — lifts crawler block, enables PWA/EyeDropper/secure downloads/COOP-COEP perf) · Stripe (unlocks Pro: OCR server, AI, batch enforcement).

**STANDING RULES (all in memory):** QA bar (harness on real bundled code + build + live-Chrome e2e + zero console errors + benchmark logged in dailydesk-test-results) · SEO bar (title/desc/canonical/H1/JSON-LD/OG + **add route to sitemap.ts**) · competitor scan before every tool · license-clean only (license text shipped) · honest/durable claims · never-hang mandate (workers, yields, caps) · handovers → file + auto-post at context limit · memory updated same-turn.

**KEY GOTCHAS:** pdf.js + workers dead in preview sandbox (use Node harness / live Chrome MCP) · onnxruntime-web never in webpack workers (public classic worker) · untracked VPS files silently block git pull (verify hash) · RegExp/components across server→client boundary hang builds · always clear input.value after file pick · Tailwind content globs must cover files with literal classes · CDP evals cap at 45s (poll in short calls).
