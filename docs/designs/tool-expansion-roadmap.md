# Tool expansion roadmap — global file pain points → what to build next

_Written 2026-07-13. Grounded in real-world demand (search + competitor + regional-mandate
research), mapped to our model: **Free = on-device, costs-us-nothing, acquisition + SEO;
Pro = server/AI/compliance/workflow, real revenue.** New tools we agree on get built into the
catalog; this doc is the source of truth for the "why" and the priority order._

---

## 0. Decision (2026-07-13, owner — updated)
- **Build all six, one at a time**, each fully QA'd before the next.
- **Ship the five FREE tools (#1–5) PUBLIC as each is finished** (they're on-device acquisition tools —
  publishing them early starts their SEO traffic sooner). Add each to the sitemap + `/overview` on launch.
- **Keep #6 PDF→Excel GATED** (owner-only / `coming_soon`) — it's the **Pro** tool; reveal at the Pro launch.
- For **every** finished tool: send the owner a **screenshot + the live test URL**, and reflect it in
  **`/overview` (public)** + the **internal artifacts** (`docs/artifacts/` — overview + status board + mockups).
- After the six, the **Phase 2** list (§7) is the next slate.

## 1. Method

Three inputs:
1. **What people actually struggle with day-to-day**, worldwide (not what's fun to build).
2. **Where competitors already win and we have a gap** (iLovePDF, Smallpdf, TinyWow, Adobe, Sejda).
3. **Our unfair advantages** — on-device privacy, determinism, no upload — so we prioritise tools
   where those advantages actually matter (anything with a face, an ID, a bank statement, a contract).

Every recommendation is tagged **[Free]** or **[Pro]**, and **on-device** vs **server/AI**.

---

## 2. The day-to-day file problems (what the world fights with)

### A. "My file is the wrong size" — the single biggest global pain
Government/exam/visa/court/job portals demand **exact** byte limits, and they're brutal:
- India govt exams: UPSC photo **40 KB** (300×350 px), SSC **100 KB**, IBPS/SBI/Railways **20–50 KB**;
  document PDFs often **≤200–500 KB**. Whole cottage-industry sites exist only for this.
- Visa applications, court e-filing, older enterprise portals: **100 KB / 1 MB / 2 MB** hard caps.
- Email: 25 MB attachment ceiling → "compress this so it sends."

We compress well, but we compress to *"as small as possible,"* not *"to exactly under 100 KB."*
**That's the gap, and it's enormous SEO** ("compress pdf to 100kb", "photo 50kb", one query per size × per exam).
Sources: [PrepTools compress-to-KB](https://tools.indgovtjobs.net/pdf-compress/),
[ExamFormTools resize guide](https://examformtools.in/blog/how-to-resize-photos-for-government-job-applications/),
[iLovePDF "file too large"](https://www.ilovepdf.com/blog/file-too-large-to-upload-how-to-fix).

### B. "I need a photo to an exact ID spec"
Passport/visa/ID photos to per-country specs (US 2×2in/600px, Schengen 35×45mm, India, China, UK…),
right background, right KB. iLovePDF and Smallpdf both ship this and rank for it; it's explicitly sold as
"accepted for passport, visa, Aadhaar, PAN & official IDs." **Faces should never be uploaded — this is a
perfect on-device/privacy tool for us.** Sources:
[iLovePDF passport maker](https://www.ilovepdf.co.in/2026/06/passport-size-photo-maker-online-100.html).

### C. "Turn this document into an editable / usable format"
- **PDF → Excel** (extract tables) — accounting, bank statements, price lists. iLovePDF/Smallpdf have it; **we don't.**
- **PDF → PowerPoint** — we don't.
- **Fill a PDF form** — tax forms, applications, contracts. Smallpdf's "PDF Filler" is a headline free tool; **we have sign/edit/annotate but no dedicated form-fill.**
- OCR to *searchable Word/Excel*, multi-language (Arabic, Hindi/Devanagari, CJK, Cyrillic, Thai).
Sources: [Smallpdf PDF Filler](https://smallpdf.com/blog/pdf-filler),
[TinyWow vs iLovePDF feature set](https://creati.ai/ai-tools/tinywow/alternatives/tinywow-vs-ilovepdf-in-depth-pdf-tool-comparison/).

### D. Privacy chores people don't know they need
- **Strip EXIF/GPS from photos** before sharing (location leak) — nobody thinks about it; we're the privacy brand.
- **Blur faces / plates / sensitive text** in screenshots and photos.
- **Mask ID numbers** (India legally requires masking the first 8 digits of Aadhaar before sharing).

### E. Sign / approve / send for signature
Self-sign we have. **Request-signature (multi-party, DocuSign-lite)** is a high-value Pro workflow;
Smallpdf's eSign is a flagship. eIDAS (EU) qualified signatures are a compliance angle.

### F. Compliance & archival (region-driven, Pro)
- **PDF/A** for legal e-filing and government archives (US courts, EU public sector).
- **e-Invoicing mandates** are going live *now*: Germany (must *receive* structured e-invoices since Jan 2025;
  issue from 2027), **Belgium live Jan 2026**, France phasing from Sept 2026; EU **ViDA** adopted Mar 2025.
  Format = **Factur-X/ZUGFeRD = CII XML embedded in PDF/A-3**. A view/validate/extract/embed tool is a real
  Pro play in mandated markets. LatAm equivalents: Brazil **NF-e**, Mexico **CFDI** → human-readable PDF.
  Sources: [Novutech EU mandate guide](https://www.novutech.com/news/e-invoicing-in-europe-overview-of-mandates-2025-2027),
  [Peppol mandates by country](https://peppolvalidator.com/peppol-mandates).
- **Bates numbering** (US legal discovery) — already on our differentiator list.

### G. Everyday consumer & mobile
- **Scan with your phone camera → clean multi-page PDF** (deskew, perspective-fix, B/W). Huge where scanners
  don't exist (India, Africa, SE Asia). We have `clean-scanned-pdf` but not camera capture.
- HEIC→JPG (have), WhatsApp/email compress presets, screenshot→PDF, circle-crop profile pics,
  social-media image size presets, image→favicon/ICO.

### H. Developer / power-user long tail (cheap, pure-client, SEO gold)
base64, hash (MD5/SHA-256), URL encode/decode, JWT decoder, epoch/timestamp, UUID, case converter,
diff checker, YAML↔JSON, CSV↔JSON, minify/beautify (JSON/CSS/JS/HTML), regex tester, Markdown→PDF/HTML.
We already have JSON formatter, color-picker, password gen, word counter, unit converter — this is the
same cheap category, and each one is a keyword.

---

## 3. Where we stand vs the market

**We're strong** on core PDF (compress, merge, split, rotate, delete, reorder, crop, watermark, page numbers,
protect/unlock, metadata, sign, annotate, edit, redact*, OCR, extract-images, flatten), image basics
(compress/convert/resize/crop/HEIC/background-remove), convert-to-PDF (Word/Excel/PPT/HTML/JPG), QR family,
and a starter utility set. That already matches or beats most free tiers.

**Clear gaps vs iLovePDF/Smallpdf/TinyWow:** PDF→Excel, PDF→PowerPoint, dedicated **Fill-form**,
**passport photo**, **compress-to-target-size**, **compare PDFs**, **repair PDF**, request-signature,
translate, summarize/chat, PDF/A, and the broader dev-utility + CSV pack.

---

## 4. Recommendations — prioritised

Priority = (global demand × SEO) × (brand/privacy fit) ÷ effort. Top of each tier first.

### Tier 1 — build first: on-device, Free, huge demand, low effort (we own the engines)
| Tool | Why | Notes |
|---|---|---|
| **Compress to target size** (PDF + image: "under 50/100/200/500 KB, 1/2 MB") | #1 global pain (exams, visa, court, email); endless long-tail SEO | Reuse our compress engines + a size-seeking loop; add per-exam presets (UPSC/SSC/IBPS/Schengen) |
| **Passport / visa / ID photo maker** | Massive volume; faces = privacy-perfect on-device | Per-country spec presets + background replace (reuse remove-background) + size-to-KB |
| **Fill PDF form** | Universal; Smallpdf headline free tool we lack | Type/checkbox/date/signature on flat + AcroForm PDFs, then flatten |
| **Remove image EXIF/GPS** | Privacy flagship fit; trivial | Strip all metadata, show what was removed (GPS, device, timestamp) |
| **Blur / redact in image** | Privacy; screenshots & photos | Brush/box blur or black-box faces/plates/text |
| **Dev-utility + CSV pack** | Cheap, pure-client, keyword-per-tool | base64, hash, URL-encode, JWT, timestamp, UUID, diff, YAML↔JSON, CSV↔JSON/Excel, minifiers |

### Tier 2 — on-device, prosumer (Free or light-Pro)
| Tool | Why |
|---|---|
| **Compare two PDFs** (text + visual diff) | Contract/legal/business review |
| **Extract text from PDF** (→ .txt / copy all) | Simple, common |
| **Repair PDF** | iLovePDF has it; rescues "won't open" files |
| **Print imposition** — booklet / N-up / poster-tiling | Prosumer printing; split a big page across A4s |
| **Scan with phone camera → clean PDF** | Emerging-market flagship; deskew + B/W |
| **EPUB↔PDF** | eBook everyday need |
| **Social image presets / circle-crop / favicon** | Consumer, cheap |

### Tier 3 — Pro: server/AI/compliance/workflow (revenue)
| Tool | Why | Cost lever |
|---|---|---|
| **PDF → Excel** (tables; AI-accurate for bank statements) | Big finance gap vs rivals | Server/AI — meter like OCR |
| **Request signature** (multi-party eSign) | DocuSign-lite; high willingness-to-pay | Workflow + email |
| **Summarize / ask a PDF** (AI) | Ties to planned AI feature | Haiku + per-user cap + revenue-pegged budget (see AI cost-control memory) |
| **Translate document, keep layout** (AI) | Global | Same AI budget guardrails |
| **Advanced OCR** — multi-language, →searchable Word/Excel | Non-Latin scripts underserved | Server |
| **PDF → PowerPoint** | Completes the convert set | Server |
| **PDF/A convert + validate** | Legal e-filing / archival compliance | Server (true validation is hard in-browser) |
| **e-Invoice** (Factur-X/ZUGFeRD/XRechnung view·validate·embed; NF-e/CFDI→PDF) | Live EU/LatAm mandates | Niche-high-value Pro |
| **Bates numbering** | US legal discovery | Already on differentiator list |

### Regional cheat-sheet (for landing pages + SEO)
- **India:** compress-to-KB (exams), passport photo, Aadhaar/PAN masking, bank-statement→Excel, unlock bank PDFs (have).
- **EU:** PDF/A, GDPR redaction (have), Factur-X/XRechnung e-invoice, eIDAS eSign.
- **US:** Bates numbering, PDF/A court e-filing, IRS form fill, eSign.
- **Brazil/Mexico:** NF-e / CFDI → readable PDF.
- **MENA / CJK:** multi-language OCR, RTL, font embedding.
- **Africa / SE Asia:** phone scan, low-bandwidth compress, WhatsApp presets, HEIC (have).

---

## 5. My top 6 to do next (highest ROI, best brand fit)
1. **Compress to target size** (PDF + image) — biggest demand, we already have the engines.
2. **Passport / ID photo maker** — huge volume, privacy-perfect, reuses background-remove.
3. **Fill PDF form** — closes a headline free-tier gap.
4. **Remove image EXIF/GPS + Blur-in-image** — cheap, and *on-brand for privacy* (nobody else leads with this).
5. **Dev-utility + CSV pack** — a dozen cheap keyword magnets in one sprint.
6. **PDF → Excel** — the flagship **Pro** revenue gap (bank statements = willingness to pay).

Everything in 1–5 is on-device → free forever → costs us nothing and pulls organic traffic. #6 is the Pro hook.

---

## 7. Phase 2 — what to add AFTER the launch six (fresh research 2026-07-13)

Grouped by the pull that justifies each. Compliance + AI/data are the revenue-heavy ones.

### Compliance (Pro — deadline-driven, businesses must comply)
- **Accessible / tagged PDF (PDF/UA)** — the **EU Accessibility Act** began enforcement **28 Jun 2025**:
  customer-facing PDFs (invoices, statements, contracts, forms, reports) must be accessible — tagged tree,
  reading order, alt text, form labels. Real legal pressure on every EU-facing business; almost nobody makes
  this easy. A "check + auto-tag PDF for accessibility" tool is a strong Pro compliance play.
  Sources: [PDFix EAA](https://pdfix.net/european-accessibility-act-2025-are-your-pdfs-ready/),
  [iText EAA](https://itextpdf.com/blog/technical-notes/european-accessibility-act-compliance-itext).
- **e-Invoice** (Factur-X/ZUGFeRD/XRechnung view·validate·embed; NF-e/CFDI→PDF) — live EU/LatAm mandates (§2F).
- **PDF/A convert + validate** · **trusted timestamp (RFC 3161)** · **Bates numbering** (US legal).

### AI / data extraction (Pro — the 2026 wave: "Intelligent Document Processing")
The hottest trend in document tools right now is LLM+OCR turning docs/photos into structured data.
- **Receipt / invoice / statement → spreadsheet** (photo or PDF → clean CSV/Excel rows) — huge for
  bookkeeping, expenses, tax; the category everyone (Textract, Docsumo, Nanonets, Lido) is racing on.
- **Summarize / chat with a PDF · translate keeping layout** — already in our AI-layer plan; all run on
  Haiku + per-user cap + revenue-pegged budget ([[dailydesk-ai-cost-control]]).
Source: [Lido — best document AI 2026](https://www.lido.app/blog/best-document-ai-tools).

### Media (Free — everyday consumer, cheap on-device)
- **AVIF / WebP convert** (modern web formats) · **RAW photo → JPG** (photographers) ·
  **extract audio from video → MP3** · **audio convert / trim / compress** · **subtitle editor** (SRT/VTT, burn-in).

### Productivity / convert (Free + light-Pro)
- **Mail-merge / document assembly** (one template + a CSV → many personalised PDFs) — business/Pro.
- **Apple iWork → PDF/Office** (.pages/.numbers/.key — Windows users can't open these) · **Markdown → PDF/Word**.

### Accessibility / voice (Free — on-brand, and the EAA tailwind)
- **PDF → audio (text-to-speech)** · **speech-to-text** (Web Speech API) — accessibility + hands-free,
  and voice-driven document handling is explicitly a 2026 trend.

**Phase-2 top pick:** **Accessible PDF (PDF/UA)** — a hard legal deadline is already live across the EU and
there's no easy consumer tool for it, plus **Receipt→Spreadsheet** as the AI/data flagship.

## 6. What's still pending (so nothing's lost)

**Catalog gaps (this doc):** compress-to-size · passport photo · fill-form · image EXIF strip · image blur ·
dev/CSV pack · compare PDF · extract text · repair PDF · imposition · phone-scan · EPUB · PDF→Excel ·
PDF→PPT · request-signature · translate · summarize/chat · advanced OCR · PDF/A · e-invoice · Bates.

**Operational (tracked in the pending-tasks memory):** launch redact-pdf (gated) · add `pro_used` to OCR + AI
when they ship · owner-enable Stripe Customer Portal (test+live) · Cloudflare Full-strict SSL ·
DMARC quarantine→reject · Node 20→22 · autonomous auto-PR canary · real-device mobile QA · re-add redact to the
browser canary at launch.
