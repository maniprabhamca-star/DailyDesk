# DiemDesk — Master Roadmap & Pending Tracker

_Single source of truth for everything shipped, in-flight, and pending. Every item below is tracked; update the status box as things move. Last updated: 2026-07-15._

**Legend:** ✅ shipped/live · 🌓 shipped-dark (owner-only until Pro launch) · 🔨 in progress · ⏳ pending · 💤 stubbed "coming soon" in catalog

Related: [tool-expansion-roadmap.md](tool-expansion-roadmap.md) · [status board](../artifacts/overview-status-board.html) · unit economics → `dailydesk-unit-economics` memory + [../artifacts/unit-economics.html](../artifacts/unit-economics.html).

---

## 0. Just shipped (2026-07-15)
- ✅ **Chat with PDF** (`/chat-pdf`) — 🌓 first AI/Pro tool, ships dark. On-device text extract → cited answers. Key live on VPS, owner can use now.
- ✅ **PDF → Excel** (`/pdf-to-excel`) — free, on-device table extraction → editable grid → .xlsx/.csv.

---

## 1. Core PDF catalog — parity gaps (Smallpdf/iLovePDF)
Mostly free/on-device unless marked.
- [ ] ⏳ Request e-signatures (Pro) + **certificate of completion** (audit trail + verification hash)
- [ ] ⏳ Repair PDF
- [ ] ⏳ Scan-to-PDF (camera/import → PDF)
- [ ] ⏳ PDF → PowerPoint (server, like PDF→Word)
- [ ] ⏳ PDF/A (archival) conversion
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
- [ ] ⏳ RFC-3161 trusted timestamp
- [ ] ⏳ Free **chained "one-drop" workflows** (merge·clean·sign·compress in one drop)

## 3. AI layer (Pro — needs the Anthropic key, now live)
- [x] 🌓 Chat with PDF
- [ ] ⏳ Summarize
- [ ] ⏳ Translate (output-heavy — most expensive AI action, see economics)
- [ ] ⏳ Auto-redact PII (also §2)
- [ ] ⏳ Question generation (study/quiz from a doc)
- [ ] ⏳ Natural-language ⌘K (also §2)
- [ ] ⏳ Semantic compare (also §2)
- [ ] ⏳ PDF→Excel **AI cleanup** for messy/scanned tables (Pro add-on)

## 4. Pro pillars & differentiators (the moat — rivals are server-first, can't copy)
- [ ] ⏳ **On-device batch** ⭐ flagship — "100 files at once, zero uploads"
- [ ] ⏳ **Encrypted File Vault** ⭐ — zero-knowledge E2E (Argon2 + AES-256, separate passphrase + recovery key); 1GB free / 100GB Pro fair-use cap (NOT literal unlimited — see economics)
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
- [ ] ⏳ Smart Notes
- [ ] ⏳ Habit Tracker
- [ ] ⏳ Budget Tracker
- [ ] ⏳ Receipt scanner
- [ ] ⏳ Link-in-Bio

## 7. Feature-pack polish (enhancements to shipped tools)
- [ ] ⏳ Edit-PDF: resize grip + right-side properties panel
- [ ] ⏳ Sign: draw-signature pad, initials/date, multi-field
- [ ] ⏳ Fill-form v1.1: native AcroForm Tab-through, keep-editable, radio/optionlist, checkbox mark-style
- [ ] ⏳ Fill-form batch / mail-merge + saved profiles (Pro hook)
- [ ] ⏳ Photo-privacy: batch multi-file + licence-plate detection
- [ ] ⏳ Wire Pro/server tools into the viewer "Do more" bar (redact/OCR/summarize)
- [ ] ⏳ Font-subsetting Path B (Edit PDF)

## 8. Infra · monitoring · go-live
- [ ] ⏳ Lift basic-auth → go public (Google can crawl) — **#1 growth action**
- [ ] ⏳ Set `NEXT_PUBLIC_SITE_URL` on VPS to the real domain (canonicals/sitemap)
- [ ] ⏳ Cloudflare Full-strict SSL upgrade
- [ ] ⏳ Node 20 → 22/24 on VPS (20 is EOL; below pdfjs engines)
- [ ] ⏳ DMARC reject · origin firewall to Cloudflare IPs · Bot Fight Mode
- [ ] ⏳ Submit sitemap to Google Search Console + Bing; Core Web Vitals pass on real domain
- [ ] ⏳ Monitoring V3: autonomous auto-PR, OCR canary, per-tool SLO alerts
- [ ] ⏳ Real-phone mobile QA sweep; install PWA + test Android "Share to DiemDesk" + desktop "Open with"
- [ ] ⏳ Native Capacitor **iOS + Android apps** (completes robust open-with, esp. iPhone) — **next agreed build**
- [ ] ⏳ OG images (branded 1200×630 + per-tool)
- [ ] ⏳ Full-site SEO validation pass (titles/desc lengths, canonicals, JSON-LD) before public

## 9. Business / billing (gates real revenue)
- [ ] ⏳ **Stripe LIVE**: create live product/prices ($5.98/mo, $60/yr, founding $4.99 coupon cap 1000) + Customer Portal + flip `BILLING_ENABLED`
- [ ] ⏳ Flip AI + Pro tools coming_soon → pro at launch; set `AI_ENABLED=true`
- [ ] ⏳ Reset test data (TRUNCATE user_events) + reset test Pro accounts to free
- [ ] ⏳ Top up Anthropic credits before public AI
- [ ] ⏳ Counsel review of Terms (billing/liability) · USPTO/trademark check
- [x] ✅ **Align AI per-user cap to the economics model** (2026-07-15) — now `AI_USER_MONTHLY_MAX=100`/month (was 40/day); ~$2 worst case/user. Added optional `AI_GLOBAL_MONTHLY_USD` — **set to ~20% of monthly Pro revenue at launch** (the "cost can't exceed revenue" guarantee). See `dailydesk-unit-economics`.

---

_Governance: nothing ships without the [QA bar], [SEO bar], mock-first approval, and being reflected here + on the public /overview. Design decisions committed under `docs/`._
