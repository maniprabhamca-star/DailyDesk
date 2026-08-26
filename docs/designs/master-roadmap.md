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

## 1. Core PDF catalog — parity gaps (Smallpdf/iLovePDF/PDF24)
Mostly free/on-device unless marked.
- [x] 📱 **Overlay PDF** (`/overlay-pdf` — shipped 2026-08-24, free, on-device). Stamps one PDF onto another: letterhead behind an invoice, pre-printed form background, DRAFT/PAID stamp page. Watermark does text and images; this takes a whole PDF so vectors, embedded fonts and transparency survive. On-top or behind, fit or actual size, first-page or page-for-page, page range, opacity. Verified: base 0 form XObjects → output 6 (matching the stamp); behind → 8.
- [ ] ⏳ **Webpage → PDF (Pro)** — archive a live URL. ⚠ BLOCKED ON INFRA: the VPS has **no headless browser** (no chromium/puppeteer/playwright; LibreOffice can't render a live page). Needs Chromium + Puppeteer installed on prod **and SSRF hardening** — the server would fetch user-supplied URLs, so private IP ranges, `file://` and redirect-to-localhost must be blocked. ~2–3 days, mostly hardening. Owner approval needed before installing a browser on the production box.
- [x] 📱 **Split pages in half** (`/split-pages-in-half` — shipped 2026-08-26, free, on-device). Book/spread scans → one page per side. Vertical or horizontal, auto-detect (only splits pages actually wider than tall), and a right-to-left option so Arabic/Hebrew/manga come out in reading order. Verified on a real 2-page landscape scan: aspect 1.29 → 4 pages at aspect 0.65, 2 form XObjects, no rasterisation.
- [x] 📱 **Pages per sheet** (`/pages-per-sheet` — shipped 2026-08-26, free, on-device). N-up: 2/4/9/16 pages on one sheet, auto or forced orientation, optional hairline separators. Pages are placed as real pages (form XObjects), so they stay vector-sharp when shrunk. Verified: 2 pages → 1 sheet, aspect 1.42 (A4 landscape, auto-picked).
- [x] 📱 **Change page size** (`/change-pdf-page-size` — shipped 2026-08-26, free, on-device). A4/Letter/Legal/A3/A5 + custom, or the more useful **unify** mode: find the size the document already mostly uses and make the stragglers match — the real fix after merging files from three sources. Scale-to-fit and centre, never crop. Verified: mixed input → all A4 portrait, aspect 0.707, page count preserved.
- [x] 📱 **Rasterize PDF** (`/rasterize-pdf` — shipped 2026-08-26, free, on-device). Every page becomes an image inside the same PDF — nothing selectable, identical rendering everywhere, no font surprises. 96/150/300 DPI, optional greyscale. Distinct from Flatten PDF (which flattens *form fields* and keeps text as text), and says plainly that it cannot be undone. Verified on a real 2-page PDF: 2 image XObjects, DCTDecode (JPEG), valid PDF 1.7, 220 KB.
- See **[pdf24-gap-analysis.md](pdf24-gap-analysis.md)** for the rest of the PDF24 comparison — halve-pages, N-up, page resize, bookmarks, document-info editing, rasterize, fillable-form authoring, invoice builder — plus the naming-only converter gaps.
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
- [x] ✅ **PDF → Markdown** (`/pdf-to-markdown` — free on-device: headings/lists/GFM tables from layout; Rendered/Raw preview + Copy/.md; 11/11 core + 6/6 real-pdf.js tests. v1 has no image extraction — v1.1)
- [x] ✅ **PDF → audio (TTS)** (`/pdf-to-audio` — free on-device: Web Speech read-aloud, voice/speed/pitch, sentence follow-highlight + tap-to-jump; 7/7 segmentation. **MP3 file export = deliberate future Pro add-on** — free v1 is playback only) · [ ] ⏳ speech-to-text (still pending)
- [x] ✅ **Bates numbering** (`/bates-numbering` — **FREE** on-device: prefix/start/digits/suffix, 6 corners, page range, **continuous across a whole file set**→PDF/zip, live preview; 23/23 incl. full IO proven w/ real pdf-lib+pdf.js. NOTE: was planned "Pro" — shipped free per gate-scale-not-quality)
- [ ] ⏳ **Accessibility / PDF-UA auto-tag** ⭐ (EU Accessibility Act enforcement live 28 Jun 2025 — no consumer tool exists)
- [x] ✅ **PDF → EPUB** (`/pdf-to-epub` — free on-device: reflowable EPUB 3 + NCX, chapters from the PDF's bookmarks → headings → fixed page blocks, page one as cover, editable title/author/language, live chapter preview. "Tidy for reading" drops running heads + page numbers and rejoins hyphens across line AND page breaks. **v1.1 shipped same day: in-book pictures** (pdf.js op-list, in draw order, repeated logos + sub-64px junk dropped, capped) **and proper RTL** (Arabic/Hebrew/Urdu → `dir="rtl"` + `page-progression-direction`). 28/28 core tests; 150-page book = 6.0s read + 1.3s pack → 190KB. Remaining: footnote linking, own-cover upload, multi-column reading order)
- [x] ✅ **HTML → Excel** (`/html-to-excel` — free on-device: drop a saved page, paste source, or try a URL → every real `<table>` found, **colspan/rowspan laid out the way a browser does** (the thing copy-paste gets wrong), named from caption/heading, editable grid → .xlsx one-sheet-per-table or CSV. Numbers coerced. First of the §5b spreadsheet pack)
- [ ] ⏳ **Receipt / invoice / statement → spreadsheet** ⭐ (IDP — the 2026 wave)
- [ ] ⏳ **e-Invoice** (Factur-X / ZUGFeRD = CII XML in PDF/A-3; EU mandates live: DE, BE Jan 2026, FR Sept 2026)
- [x] 🌐 **Repair PDF** (`/repair-pdf` — free on-device: tolerant reload+resave rebuilds the broken xref that makes PDFs won't-open; 4/4 headless test)
- [x] 🌐 **Scan to PDF** (`/scan-to-pdf` — free on-device: phone camera → clean multi-page PDF, readability enhance, add-photos fallback)
- [ ] ⏳ RFC-3161 trusted timestamp
- [x] 🌓 Free **chained "one-drop" workflows** (merge·clean·sign·compress in one drop — see §4 Saved workflows)

## 2b. Competitor-research findings ⭐ (2026-08-08 — what rivals structurally CANNOT copy)

Grounded in an actual read of sejda.com, ilovepdf.com and tinywow.com, not assumption.

**What they have that we do not:** Sejda 25+ languages, desktop app, dev docs, and
**4.5★ / 1,874 Google reviews on the homepage**. iLovePDF 23 languages, ISO27001 badge,
desktop + mobile, Workflows, batch, iLoveAPI, sibling brands. TinyWow 200+ tools,
ad-funded, $9/mo to remove ads.

**The finding that matters:** every rival's privacy claim is a RETENTION promise —
"all files deleted after 1 hour" (TinyWow), ISO27001 (iLovePDF), a policy page (Sejda).
Every one of those concedes **they received the file**. Ours is a different category of
claim, and we currently undersell it as a feature bullet.

| # | Item | Status | Why rivals can't follow |
|---|---|---|---|
| 1 | **Sector pages** `/for/legal`, `/for/accountants`, `/for/healthcare`, `/for/schools` | ✅ **SHIPPED 2026-08-08** | "The file never leaves your device" is the sentence that clears a compliance review. A product that uploads cannot write it. |
| 2 | Drop the practical file-size cap | ⏳ not started | Everyone caps free tiers because bandwidth costs *them*. Ours costs nothing. |
| 3 | Reframe the pitch against retention promises (on `/compare`) | ⏳ not started | "They delete your file after an hour. We never receive it." |
| 4 | Offline PWA done properly | ⚠️ **partial — see note** | iLovePDF *charges* for offline (Premium = "work offline with Desktop"). Ours could be free. |
| 5 | **Redaction certificate** | ✅ **SHIPPED 2026-08-08** — certificate + /verify-redaction | A signed receipt of what was removed + that it never left the device. A cloud tool cannot attest to this. |
| 6 | **Client-side SDK** (npm, runs in the developer's users' browsers) | ✅ **BUILT 2026-08-08** — `packages/sdk`, 11 tests green, docs at /developers. ⚠️ **NOT PUBLISHED**: the licence is a placeholder and needs a decision + legal review first (see packages/sdk/LICENSE). | The unoccupied quadrant: iLoveAPI is server-side and cheap; Nutrient/Apryse are client-side and enterprise-priced. Nobody is cheap + client-side + *operations*. Our engines are already client-side modules — packaging, not R&D. Zero compute cost to us; licence pricing, not metered. |
| — | Social proof (we show none; Sejda shows 1,874 reviews) | ⏳ gap to close before the revenue flip | — |
| — | Languages (we have **zero**; rivals have 23–25) | ⏳ post-revenue | Machine translation ranks badly; do 3 properly or none. |

⚠️ **Note on #4 (offline).** Half-true today, and the half matters. `public/sw.js` +
`manifest.webmanifest` exist and the app is installable, but **there is no precache** —
it was deliberately disabled after the stale-shell incident (REG-013), so offline only
covers pages already in the runtime cache. Do not put "works offline" in marketing copy
until precache is back and tested. Pairs with the existing offline-wording tripwire.

**The through-line:** on-device is not a privacy feature, it is an **economic** one. It
makes unlimited size, unlimited batch, offline and SDK licensing structurally cheaper for
us than for anyone with a server in the path. Rivals can copy any single tool in a week;
they cannot copy that without rewriting their business.

## 2c. Folder Preview ⭐ BUILT 2026-08-10 (gated, owner-only)

`/folder-preview` — the multi-file preview grid, built standalone rather than
straight into File Vault. Spec: [folder-preview-tool.md](folder-preview-tool.md),
mockup beside it.

The owner's observation is the product case: **Windows thumbnails pictures and
videos and gives everything else an identical grey icon**, so a folder of forty
PDFs and spreadsheets is forty indistinguishable rectangles. Nobody solves this
on the web, because solving it means reading someone's whole folder — exactly
what you would never do with a site that uploads.

Shipped:
- `lib/file-classify.ts` — three-way classify: render it / say why we can't / ignore it
- `lib/folder-read.ts` — webkitdirectory everywhere + the Chrome-only directory
  picker; deleting moves to `_trash` rather than destroying
- `lib/folder-pdf-thumb.ts` — page-one canvas via our own pdf.js
- The grid, and the **review queue** viewer: ←/→ to step, D to trash, Esc to leave
- 3 E2E tests driving a real mixed folder through the fallback path

**Free caps at 30 files; Pro removes it.** Gates scale, not quality — a purely
client-side tool costs nothing per use, so the free tier must be genuinely
useful and the cap should bite only on real bulk.

✅ The three pre-launch gaps are closed (2026-08-10):
1. Markdown now renders through `renderMarkdown()` — real headings and GFM tables
   at thumbnail size, scaled in CSS so the shared renderer stays untouched.
2. The PDF path is covered two ways. `dev-harness/folder-pdf-volume.mjs` proves it
   renders real ink at volume (12/12, ~150ms each). **It does NOT prove the rAF
   hang** — re-run with `intent:'print' deleted, it still passed, because Node has
   no rAF to pace against. The hang is covered by an E2E test that genuinely
   backgrounds the tab via a second page.
3. Reachability fixed: the folder chip is now a button, so changing folder no
   longer means hunting for a control at the bottom of the grid.

✅ **Manual pass done (owner, Chrome, 2026-08-11):** the directory-picker path and
`moveToTrash` verified against real files. That was the last thing Playwright
could not cover, so nothing is now unverified.

⚠️ **Write-path bug found by the owner and fixed 2026-08-22** (`f2f734f`, live on
prod). 24 files selected → **Move to trash** → nothing visible happened. Three
causes, all fixed:
1. `showDirectoryPicker({mode:'readwrite'})` does **not keep** its grant — Chrome
   downgrades it to `prompt`. `ensureWritable()` now checks + re-requests from
   inside the click (needs a live user gesture) and refuses in plain English.
2. The result line and the Undo button rendered **below the grid** — under up to
   2000 cards, i.e. invisible. Now a `fixed` bottom dock with a live progress
   count. (`sticky` cannot work: the tool card is `overflow-hidden`.)
3. The catch swallowed the real error, so a permission problem looked like a bug.

The write path had **zero** test coverage, which is why it reached the owner.
`tests/e2e/folder-preview.spec.ts` now stubs `window.showDirectoryPicker` with an
in-memory folder (`withFakeFolder`); permission `'prompt'` reproduces the bug.
14 folder-preview tests, CI green on chromium/firefox/webkit/edge/mobile.

**Ready to un-gate.** Five edits when you want it public:
1. `lib/tool-flags.tsx` — drop the `'/folder-preview': 'coming_soon'` line
2. `components/app/catalog.tsx` — drop `soon: true` (keep `newUntil`)
3. `app/sitemap.ts` — add `/folder-preview`
4. `app/folder-preview/page.tsx` — drop `robots: { index: false }`
5. `lib/changelog.ts` — retitle from "Coming soon:" to shipped wording

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
- [x] 🌓 **Saved workflows** ⭐ — one-click document assembly line over a batch (`/workflows`, dark until Pro launch: 12 on-device steps — merge · delete · rotate · clean scan · watermark · page numbers · sign · flatten · remove metadata · share-safe clean · protect · compress-to-size — 7 templates, batch→zip, saved on-device. Remaining: account sync)
- [ ] ⏳ Self-destruct encrypted shares (expiring password-locked links we can't decrypt)
- [ ] ⏳ Brand kit (logo/header/footer/watermark presets across a batch)
- [ ] ⏳ True re-encode Edit tier (higher-fidelity in-place edit — see docs/edit-pdf-approach.md)
- [ ] ⏳ Offline PWA (installable, fully offline) — partially there (SW shipped for share)

## 5. Media & beyond-PDF (mostly free, ffmpeg.wasm / browser APIs)
- [x] ✅ HEIC→JPG · remove-background · video-to-gif · compress-video · compress/convert/resize/crop image
- [ ] ⏳ AVIF / WebP convert
- [ ] ⏳ Subtitle editor
- [ ] ⏳ Apple iWork → PDF/Office · mail-merge / doc-assembly
- ~~RAW → JPG~~ · ~~MOBI/AZW3~~ — **deliberately not building** (heavy decoders; Amazon deprecated MOBI). Anything needing a server round-trip is out too: it breaks the on-device promise.

## 5b. Converter expansion ⭐ (agreed 2026-08-06 — the next build queue, in order)
> **⚠ ALL FIFTEEN TOOLS SHIPPED 2026-08-06 ARE GATED `coming_soon` (owner-only)** — `/pdf-to-epub`, `/html-to-excel`, `/video-to-mp3`, `/audio-converter`, `/excel-to-csv`, `/csv-to-excel`, `/json-to-excel`, `/xml-to-excel`, `/svg-to-png`, `/svg-to-pdf`, `/epub-to-pdf`, `/pdf-to-text`, `/markdown-to-pdf`, `/subtitle-converter`, `/favicon-generator`. **The whole converter queue is now BUILT.** Owner asked for this: new tools stay private until they have click-tested them. **Un-gating each one is three edits** — remove its line from `lib/tool-flags.tsx`, drop `soon: true` in `components/app/catalog.tsx`, add the route back to `app/sitemap.ts` — **plus its changelog entry** (held back deliberately; draft copy below).
> **Held changelog copy — PDF→EPUB:** "Turn a PDF into a real e-book" — reflows to any screen, chapters from the PDF's own bookmarks, page one as the cover, pictures carried across in place, right-to-left languages laid out properly, and a tidy-up pass that drops running heads/page numbers and rejoins hyphenated words. **HTML→Excel:** "Web page tables, straight into Excel" — merged cells handled properly, which is exactly what copy-paste gets wrong; several tables become several named sheets; numbers stay numbers. **Video→MP3 + audio converter:** "Pull the audio out of a video — without uploading it" — MP4/MOV/WebM/MKV in, MP3 or WAV out, mono fold for speech, mm:ss trim; free because it runs on your computer. **Spreadsheet pack:** "Four spreadsheet conversions that don't need an upload" — Excel→CSV with dates that read as dates instead of five-digit numbers, CSV→Excel with the separator detected so nothing lands in column A, JSON→Excel with nested fields flattened to dotted columns, XML→Excel where the repeating record becomes the rows.

Every one is on-device, reuses an engine we already ship, and targets search terms where every current result is an upload site.
- [x] ✅ **1. Video → MP3 + audio converter** ⭐ (`/video-to-mp3` + `/audio-converter` — free on-device: browser decoders read MP4/MOV/WebM/MKV/M4A/AAC/OGG/Opus/FLAC/WAV, with a play-through capture fallback for codecs that won't decode directly; out to **MP3** (LAME, 96–320 kbps) or **WAV**, mono fold + mm:ss trim; 90-min cap because PCM is held in memory). ⚠ **ffmpeg.wasm is NOT and must not be in this stack** — the video tools deliberately avoid it (GPL/x264). MP3 uses lamejs (**LGPL-3.0**) served from `public/lame/` as a standalone replaceable file with its LICENSE beside it — the same compliance pattern counsel already accepted for libheif. v1.1: M4A/Opus output (WebCodecs + the muxers we already ship).
- [x] ✅ **2. Spreadsheet pack** — `/excel-to-csv` · `/csv-to-excel` · `/json-to-excel` · `/xml-to-excel`, all free on-device, all `coming_soon`. New `lib/sheet-io.ts` = **our own .xlsx READER** (jszip + DOMParser: sharedStrings incl. rich-text runs, inlineStr/str/b/e/n, sparse cells by `r` ref, **date styles resolved via numFmt → serial converted**, workbook/rels sheet order with a fallback), an RFC-4180 CSV parser **with separator sniffing** (`,` `;` tab `|`), JSON record-finder + dotted flattening, and an XML repeating-element finder. Shared UI `components/tools/sheet-convert-tool.tsx` (file OR paste → sheet tabs → editable grid → .xlsx/CSV/JSON). `sheetName` de-duplicated out of html-tables into sheet-io.
- [x] ✅ **3. SVG → PNG/JPG/PDF** (`/svg-to-png` + `/svg-to-pdf` — `lib/svg-convert.ts`: **forces explicit width/height from the viewBox before drawing**, which is why viewBox-only files export blank elsewhere; scripts + `on*` handlers stripped; PNG keeps alpha, PDF page takes the drawing's own point size)
- [x] ✅ **HTML → Excel** (see §2) — first of the spreadsheet pack, shipped 2026-08-06.
- [x] ✅ **EPUB → PDF / Word / TXT** (`/epub-to-pdf` — `lib/epub-read.ts` follows the **spine**, not file names, so chapters never arrive shuffled; headings/lists/quotes/tables → the existing makeTextPdf + makeDocx writers; non-Latin text steers you to Word/TXT)
- [x] ✅ **PDF → plain text** (`/pdf-to-text` — reuses the PDF→Markdown layout model + the EPUB tidy pass: running heads, folios and hyphen breaks removed; out as .txt/.docx/.pdf)
- [x] ✅ **Markdown → PDF / Word** (`/markdown-to-pdf` — new `lib/md-blocks.ts` parses MD → the shared block model; tables kept in Word, flattened for PDF)
- [x] ✅ **Subtitles SRT ↔ VTT ↔ TXT** (`/subtitle-converter` — `lib/subtitles.ts`: real rewrite not a rename (WEBVTT header + separator), NOTE/STYLE blocks and cue settings handled, **timing shift**, transcript mode)
- [x] ✅ **Favicon pack** (`/favicon-generator` — `lib/favicon-pack.ts`: 6 PNG sizes each labelled with what asks for it, **a genuine multi-image .ico** (16/32/48, PNG-in-ICO) not a renamed PNG, web manifest, HTML snippet, README; non-square logos fitted never cropped)

## 6. Tier-2 mini-apps (retention, account-based)
- [x] 🔵 Smart Notes (`/notes` — account-synced CRUD, autosave, search/tags; free ≤10 notes, Pro unlimited; prod e2e incl. cap boundary + Pro bypass)
- [x] 🔵 Habit Tracker (`/habits` — account-synced, toggle-per-day + server streaks, 21-day grid; free ≤5, Pro unlimited; prod e2e incl. streak=2 + cap)
- [x] 🔵 Budget Tracker (`/budget` — account-synced expenses, monthly total + category bars, month nav; free ≤50/mo, Pro unlimited; prod e2e incl. totals + validation)
- [ ] ⏳ Receipt scanner (Pro; NOT built — expenses.receipt_file_id column ready to link one in later)
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
