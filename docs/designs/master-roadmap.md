# DiemDesk — Master Roadmap & Pending Tracker

_Single source of truth for everything shipped, in-flight, and pending. Every item below is tracked; update the status box as things move. Last updated: 2026-07-15._

**Legend:** ✅ shipped/live · 🌓 shipped-dark (owner-only until Pro launch) · 🔨 in progress · ⏳ pending · 💤 stubbed "coming soon" in catalog

Related: [tool-expansion-roadmap.md](tool-expansion-roadmap.md) · [status board](../artifacts/overview-status-board.html) · unit economics → `dailydesk-unit-economics` memory + [../artifacts/unit-economics.html](../artifacts/unit-economics.html).

---

## ⭐ FLAGSHIP — Bank Statement Converter (the Pro conversion engine)
**Full spec: [bank-statement-converter.md](bank-statement-converter.md)** · owner spec 2026-07-16 · **status: specified, not started**

The paid flagship. Bank statement PDF → verified transaction table → **Excel / CSV / Tally XML / QBO / OFX**, India-first (SBI, HDFC, ICICI, Axis, Kotak, PNB, BoB, Canara, Union, IDFC/Yes). The 57 free tools are the funnel; **this is what people pay for.**
- **Wedge:** only converter that processes **locally**, **validates every row against the running balance**, and exports to **Tally** (which every Indian CA uses and no competitor supports).
- **Willingness to pay is proven:** DocuClipper $29–159/mo · CapyParse $29/mo · BankStatementLab $9/mo.
- **Pricing (NOT bundled into $5.98 Pro):** Free 5 pages/mo · credit pack ₹399/$4.99 = 20 pages · **Statements Pro ₹1,499/$19/mo** = 300 pages.
- **Head start:** ~70% of the extraction engine already shipped for PDF→Excel (`table-extract.ts`, `pdf-tables.ts`, `xlsx.ts`, editable grid, unlock-pdf, OCR, AI + cost caps, Stripe).
- **New work:** ~~bank fingerprinting~~ ✅ · ~~balance-validation engine~~ ✅ · ~~Tally XML writer~~ ✅ · ~~review-screen UI~~ ✅ · ~~password unlock~~ ✅ · ~~bank SEO pages~~ ✅ · ~~3 workflow SEO pages~~ ✅ · ~~page-quota meter~~ ✅ · **new Stripe tier ← the last piece before launch** · per-bank column maps (now an *optimisation*, not a blocker).
- [x] ✅ **Page-quota meter (2026-07-17)** — `backend/routes/statements.js` (`/quota` + `/consume`; sends only a page COUNT, never the file; per-user/IP monthly Redis tally; Pro/owner unlimited; fails open) + `lib/statement-quota.ts` + tool wiring (usage display + over-limit → upgrade prompt). Enforcement behind `STATEMENT_QUOTA_ENABLED` (default OFF) — records now, blocks over-limit free users only when flipped on. Verified: anon 3+3=6 pages persisted; owner unlimited. **AT LAUNCH: set `STATEMENT_QUOTA_ENABLED=true`.**
- [x] ✅ **Bank SEO landing pages (2026-07-17)** — 11 unique pages `/bank-statement-converter/<slug>` (sbi, hdfc, icici, axis, kotak, pnb, bank-of-baroda, canara, union-bank, idfc-first, yes-bank). `lib/bank-statements.ts` (per-bank download steps + password format + layout quirk) + dynamic route reusing `KeywordLanding` (h1/lede/bullets/body/FAQ JSON-LD). Content-rich + indexable (public), CTA → the gated tool; all in sitemap. Titles ≤60/desc ≤155 verified (11/11). Real-world statement bugs (Axis branch-code, Wells Fargo sparse balance, HDFC letterhead) already fixed via `test-balance` 58/58 + anchor validation.
- [x] ✅ **Balance-validation engine DONE (2026-07-16)** — `lib/banks/balance.ts` (pure). **⭐ This removes the "we have no samples" blocker.** The balance equation `bal[i] = bal[i-1] − debit[i] + credit[i]` is treated as a **solvable constraint**, not just a check: we try candidate column assignments and keep the one whose arithmetic holds down the page. One pass therefore (1) identifies date/debit/credit/balance **on a bank we've never seen**, (2) *proves* the extraction arithmetically, (3) acts as the accuracy oracle gating AI escalation. Handles 3 layouts (separate debit/credit · signed amount · Dr/Cr marker column), Indian lakh + Western grouping, ₹/Rs., parens & trailing-minus negatives. **Money is integer paise end-to-end — never floats.** Verified **58/58**: solved a *shuffled-column* grid with zero prior knowledge; a misread amount flags exactly 1 row and reports the expected balance; an invoice grid returns null (refuses to hallucinate a statement); `formatINR` does correct lakh/crore grouping.
- [x] ✅ **Bank fingerprinting DONE (2026-07-16)** — `lib/banks/fingerprint.ts` (pure, 11 phase-1 banks: IFSC prefix + brand + website + layout signals, weighted by **where** they appear) + `lib/banks/detect.ts` (pdf.js IO, reads the top 28% "identity band" of page 1). **The trap it solves:** narrations are full of *other* banks (NEFT/HDFC…, UPI/…/ICICI), so body matches are penalised 0.25× and header matches boosted 2×. Verified: **24/24 unit tests** (all 11 banks 0.94–0.98 conf; refuses to guess on prose/forms/invoices) + **5/5 end-to-end on real generated PDFs** (SBI 0.77 and HDFC 0.88 despite rival-bank narrations; invoice → null). Also ships `maskAccount()`.
- **Key idea:** balance validation doubles as a **free accuracy oracle** → local → Haiku → escalate to Sonnet **only when the balance fails** (keeps AI cost near zero).
- **Critical path:** collecting real statement samples per bank (not code) + validating Tally XML against a real Tally Prime import.
- [ ] ⏳ **Sequencing decision:** this is the revenue engine; native apps only distribute a product that doesn't monetise yet. **Recommend this ahead of native apps** — owner's call.

## 0. Just shipped (2026-07-15)
- ✅ **Chat with PDF** (`/chat-pdf`) — 🌓 first AI/Pro tool, ships dark. On-device text extract → cited answers. Key live on VPS, owner can use now.
- ✅ **PDF → Excel** (`/pdf-to-excel`) — free, on-device table extraction → editable grid → .xlsx/.csv.

---

## 1. Core PDF catalog — parity gaps (Smallpdf/iLovePDF)
Mostly free/on-device unless marked.
- [ ] ⏳ Request e-signatures (Pro) + **certificate of completion** (audit trail + verification hash)
- [ ] ⏳ Repair PDF
- [ ] ⏳ Scan-to-PDF (camera/import → PDF)
- [x] 🖥 PDF → PowerPoint (`/pdf-to-powerpoint` — server, LibreOffice impress_pdf_import → editable .pptx; 3/day free→Pro; prod e2e: 2-page PDF → 2 slides)
- [x] 🖥 PDF/A (archival) conversion (`/pdf-to-pdfa` — server, Ghostscript PDF/A-2b; 3/day free→Pro; prod e2e: valid PDF with pdfaid marker)
- [ ] 💤 Crop PDF (stubbed coming_soon)
- [ ] 💤 Compare PDF (stubbed) — basic visual/text diff (semantic AI compare is separate, §3)
- [ ] 💤 Clean scanned PDF (stubbed)
- [ ] 💤 HTML → PDF (stubbed, server)
- [ ] ⏳ Share-safe PDF check (stubbed `/share-safe-pdf-check`)
- [ ] ⏳ Client packet builder (stubbed — seed for saved workflows, §4)

## 2. Beyond-market differentiators (NOT on competitors — our edge)
- [x] ✅ Compress-to-target-size (exact KB)
- [x] ✅ Table → CSV/Excel extraction (= PDF→Excel)
- [ ] ⏳ **AI auto-redact PII** (Pro) — find names/SSN/emails/Aadhaar → redact
- [ ] ⏳ **Natural-language ⌘K commands** (semantic tier) — "delete blank pages", "redact emails"
- [ ] ⏳ **Sanitize / clean PDF** — strip metadata + embedded JS (privacy brand)
- [ ] ⏳ **Semantic AI compare** — "what actually changed" between two versions (Pro/AI)
- [ ] ⏳ **PDF → Markdown**
- [ ] ⏳ **PDF → audio (TTS)** + **speech-to-text** (Web Speech API, free)
- [ ] ⏳ **Bates numbering** (legal page-stamping, Pro)
- [ ] ⏳ **Accessibility / PDF-UA auto-tag** ⭐ (EU Accessibility Act enforcement live 28 Jun 2025 — no consumer tool exists)
- [ ] ⏳ **PDF → EPUB**
- [ ] ⏳ **Receipt / invoice / statement → spreadsheet** ⭐ (IDP — the 2026 wave)
- [ ] ⏳ **e-Invoice** (Factur-X / ZUGFeRD = CII XML in PDF/A-3; EU mandates live: DE, BE Jan 2026, FR Sept 2026)
- [x] 🌐 **Repair PDF** (`/repair-pdf` — free on-device: tolerant reload+resave rebuilds the broken xref that makes PDFs won't-open; 4/4 headless test)
- [x] 🌐 **Scan to PDF** (`/scan-to-pdf` — free on-device: phone camera → clean multi-page PDF, readability enhance, add-photos fallback)
- [ ] ⏳ RFC-3161 trusted timestamp
- [ ] ⏳ Free **chained "one-drop" workflows** (merge·clean·sign·compress in one drop)

## 3. AI layer (Pro — needs the Anthropic key, now live)
- [x] 🌓 Chat with PDF
- [x] 🌓 Summarize (`/summarize-pdf` — page-cited, audience/language/focus controls; PDF/DOCX/MD/TXT export on-device)
- [x] 🌓 Translate (`/translate-pdf` — tone, do-not-translate glossary, translator notes, side-by-side; weighted 3× vs the monthly AI cap; 30-page/run cap)
- [x] 🌓 Auto-redact PII ("AI find personal info" in /redact-pdf — review panel, approve-per-finding, boxes from page text positions, burn stays on-device)
- [x] 🌓 Question generation (`/pdf-question-generator` — 6 types, Bloom's levels, explanations; Anki CSV + Moodle GIFT + PDF quiz sheet)
- [x] 🌓 Natural-language ⌘K ("Ask AI" row for phrase queries — resolves to ONE existing command/tool, server-validated, never auto-runs; static commands stay free, semantic = Pro)
- [x] 🌓 Semantic compare (violet "What changed in meaning" section in /compare-pdf — amounts/dates/obligations, severity-ranked; weighted 2× vs the AI cap)
- [x] 🌓 PDF→Excel **AI cleanup** (Pro button + undo in /pdf-to-excel — fixes split columns/title rows, never values)

## 4. Pro pillars & differentiators (the moat — rivals are server-first, can't copy)
- [ ] ⏳ **On-device batch** ⭐ flagship — "100 files at once, zero uploads"
- [x] 🌓 **Encrypted File Vault** ⭐ — phases 1-3 SHIPPED dark at `/file-vault` (crypto core 9/9 unit tests · ciphertext-only backend 9/9 prod e2e · UI to the approved mockup: ceremony/unlock/grid + visible encrypt-steps + 15-min auto-lock). Phase 4 remains: sync polish, recycle bin, rename UI. Quota currently 10GB Pro (env-tunable; revisit free/paid split vs economics at launch)
- [ ] ⏳ **Redaction / clean certificate** ⭐ — signed proof "0 recoverable chars, metadata stripped"
- [ ] ⏳ **Saved workflows** ⭐ — one-click document assembly line over a batch
- [ ] ⏳ Self-destruct encrypted shares (expiring password-locked links we can't decrypt)
- [ ] ⏳ Brand kit (logo/header/footer/watermark presets across a batch)
- [ ] ⏳ True re-encode Edit tier (higher-fidelity in-place edit — see docs/edit-pdf-approach.md)
- [ ] ⏳ Offline PWA (installable, fully offline) — partially there (SW shipped for share)

## 5. Media & beyond-PDF (mostly free, ffmpeg.wasm / browser APIs)
- [x] ✅ HEIC→JPG · remove-background · video-to-gif · compress-video · compress/convert/resize/crop image
- [ ] ⏳ AVIF / WebP convert · RAW → JPG
- [ ] ⏳ Extract audio from video · audio convert / trim
- [ ] ⏳ Subtitle editor
- [ ] ⏳ Apple iWork → PDF/Office · Markdown → PDF/Word · mail-merge / doc-assembly

## 6. Tier-2 mini-apps (retention, account-based)
- [x] 🔵 Smart Notes (`/notes` — account-synced CRUD, autosave, search/tags; free ≤10 notes, Pro unlimited; prod e2e incl. cap boundary + Pro bypass)
- [ ] ⏳ Habit Tracker
- [ ] ⏳ Budget Tracker
- [ ] ⏳ Receipt scanner
- [x] 🌓 Link-in-Bio (`/link-in-bio` editor + public server-rendered `/u/<handle>` w/ OG tags; sanitized config, reserved handles, 7 themes, views; coming_soon until Pro; prod e2e-verified)

## 7. Feature-pack polish (enhancements to shipped tools)
- [ ] ⏳ Edit-PDF: resize grip + right-side properties panel
- [ ] ⏳ Sign: draw-signature pad, initials/date, multi-field
- [ ] ⏳ Fill-form v1.1: native AcroForm Tab-through, keep-editable, radio/optionlist, checkbox mark-style
- [ ] ⏳ Fill-form batch / mail-merge + saved profiles (Pro hook)
- [ ] ⏳ Photo-privacy: batch multi-file + licence-plate detection
- [ ] ⏳ Wire Pro/server tools into the viewer "Do more" bar (redact/OCR/summarize)
- [ ] ⏳ Font-subsetting Path B (Edit PDF)

## 8. Infra · monitoring · go-live
_Status re-verified against the live server 2026-07-15 — several items below were stale and are now corrected._
- [x] ✅ **Basic-auth lifted — site is PUBLIC** (verified: `diemdesk.com` → HTTP 200, no auth). EIN Presswire launch done.
- [x] ✅ **Sitemap live + submitted to Google Search Console** (`/sitemap.xml` → 200).
- [x] ✅ **OG images shipped** — generic `/og.png` **plus a per-tool branded card for all 57 live tools** (2026-07-16). `scripts/gen-og-images.mjs` parses the catalog and renders `/og/<slug>.png` (category colour + tool name + honest runtime promise + FREE chip); `npm run og` regenerates. **New tools get a card automatically.** Non-tool pages keep the generic card. Verified on prod: each tool's `og:image` = its own file.
- [x] ✅ **DMARC record exists** — `v=DMARC1; p=quarantine; rua=mailto:support@diemdesk.com`.
- [ ] ⚠️ **BLOCKED — DMARC `p=quarantine` → `p=reject`**: a DKIM-selector scan found **NO DKIM record** for diemdesk.com (mail runs through Hostinger: MX mx1/mx2.hostinger.com, SPF `include:_spf.mail.hostinger.com ~all`). With no DKIM, DMARC rests on SPF alone and `p=reject` risks **bouncing real mail** (password resets). **Do first:** enable DKIM in Hostinger hPanel → Emails → DKIM, confirm the `_domainkey` record resolves + rua reports show passes → *then* flip to reject.
- [ ] 🔨 **Cloudflare Full → Full (strict)** — **cert INSTALLED 2026-07-16, one owner click left.** Cloudflare Origin CA cert issued from our own CSR (key never left the VPS) and installed: `/etc/nginx/ssl/diemdesk-cf-origin.{crt,key}` (nginx conf backed up to `sites-available/dailydesk.bak.*`). Verified: cert↔key modulus MATCH, SANs `diemdesk.com` + `*.diemdesk.com`, valid to **2041**, `nginx -t` ok, origin presents the CF Origin CA cert, public site + tools still 200. **REMAINING (owner):** Cloudflare → SSL/TLS → Overview → set encryption mode to **Full (strict)**.
- [x] ✅ **Node 20 → 22 LTS on VPS** (2026-07-16) — now **v22.23.1** / npm 10.9.8 / pm2 7.0.3. No native modules (bcryptjs is pure JS) so no ABI rebuild was needed; backend+frontend `npm ci` + rebuild, `pm2 update`, `pm2 save`. Verified: health ok, site 200, AI chat answering. Also clears pdfjs-dist v6's ≥22.13 engine warning.
- [ ] ⏳ Origin firewall restricted to Cloudflare IP ranges · Cloudflare Bot Fight Mode
- [ ] ⏳ Core Web Vitals pass on the live domain (Lighthouse/PageSpeed)
- [ ] ⏳ Monitoring V3: autonomous auto-PR, OCR canary, per-tool SLO alerts
- [ ] ⏳ Real-phone mobile QA sweep; install PWA + test Android "Share to DiemDesk" + desktop "Open with"
- [ ] ⏳ Native Capacitor **iOS + Android apps** (completes robust open-with, esp. iPhone) — **next agreed build**

## 9. Business / billing (gates real revenue)
- [ ] ⏳ **Stripe LIVE**: create live product/prices ($5.98/mo, $60/yr, founding $4.99 coupon cap 1000) + Customer Portal + flip `BILLING_ENABLED`
- [ ] ⏳ Flip AI + Pro tools coming_soon → pro at launch; set `AI_ENABLED=true`
- [ ] ⏳ Reset test data (TRUNCATE user_events) + reset test Pro accounts to free
- [ ] ⏳ Top up Anthropic credits before public AI
- [ ] ⏳ Counsel review of Terms (billing/liability) · USPTO/trademark check
- [x] ✅ **Align AI per-user cap to the economics model** (2026-07-15) — now `AI_USER_MONTHLY_MAX=100`/month (was 40/day); ~$2 worst case/user. Added optional `AI_GLOBAL_MONTHLY_USD` — **set to ~20% of monthly Pro revenue at launch** (the "cost can't exceed revenue" guarantee). See `dailydesk-unit-economics`.

---

_Governance: nothing ships without the [QA bar], [SEO bar], mock-first approval, and being reflected here + on the public /overview. Design decisions committed under `docs/`._
