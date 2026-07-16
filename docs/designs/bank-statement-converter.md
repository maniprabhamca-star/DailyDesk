# Bank Statement Converter — the Pro conversion engine

**Status:** 📋 Specified, not started · **Owner spec v1.0 (2026-07-16)** · Source: `MyBiz/SystemTools/DiemDesk-Statement-Converter-Spec.md`
**Strategic role:** the flagship *paid* tool. The 57 free tools are the funnel; **this is what people pay for.**

> **One-sentence wedge:** the only statement converter that (a) processes **locally** for privacy, (b) **validates every row against the running balance**, and (c) exports directly to **Tally** for the Indian market.

---

## 1. Why this is the right bet (owner's strategy — endorsed)

- **Free PDF tools cannot win.** "Merge PDF" is owned by iLovePDF/SmallPDF/Adobe, and those users don't pay. More free tools ≠ revenue. (Revenue to date: ~zero.)
- **This searcher is a business with money and a deadline** — CAs and bookkeepers who bill hours. Competitors prove the willingness to pay: DocuClipper **$29–159/mo**, CapyParse **$29/mo**, BankStatementLab **$9/mo**.
- **Regional gap:** every competitor is tuned for Chase/BofA/Wells Fargo. **Indian banks + Tally export are underserved.** Nearly every Indian CA runs Tally; *none* of them export to it.
- **Privacy finally becomes load-bearing.** A bank statement is the most sensitive document a person uploads, and every rival uploads it to a server. Our "never leaves your browser" claim stops being a nice-to-have and becomes the reason to choose us.
- **Self-serve:** SEO → free trial → credits/subscription. No sales motion.

## 2. Product shape (from the spec)

**Flow:** drop PDF (password prompt handled locally) → auto-detect bank → extract → **review table with balance validation** → export.

**Review table columns:** Date · Description/Narration · Ref/Cheque No · Debit · Credit · Balance, plus detected bank + masked account + period + opening/closing balance. Inline cell editing.

**⭐ The trust feature — balance validation:** recompute the running balance from the transactions and reconcile it against the statement's own balance column. Show *"✅ All 214 transactions verified against running balance"* or flag the offending rows. **Make it prominent — it is the product's credibility.**

**Export formats:** `P0` XLSX · CSV (configurable date format) · **Tally XML** (the differentiator) — `P1` QBO · OFX — `P2` JSON.
**Tally XML:** `<ENVELOPE>` vouchers for Tally Prime; user sets company name, bank ledger (e.g. "HDFC Bank A/c"), default contra ledger. Debits→Payment, Credits→Receipt, overridable per row. **Must be validated against a real Tally Prime import before launch.**

**Phase-1 banks:** SBI, HDFC, ICICI, Axis, Kotak, PNB, Bank of Baroda, Canara, Union Bank, IDFC First/Yes.

**Parsing tiers:** ① pdf.js text layer + bank fingerprint + per-bank column parser (100% local) → ② scanned → OCR → tier-1 logic → ③ unknown format → AI extraction (**explicit opt-in, never silent**).

**Pricing (deliberately NOT bundled into the $5.98 Pro):** Free 5 pages/mo (no signup) · Credit pack ₹399/$4.99 = 20 pages, never expires (tax season!) · **Statements Pro ₹1,499/$19/mo** = 300 pages/mo · existing Pro gets 20 pages/mo included.

> **⭐ Why a separate price (owner, 2026-07-16 — the whole thesis in one line):**
> *"The person converting bank statements is a business saving hours of paid work — the person merging a PDF is not."*
> Bundling the converter into $5.98 gives our **most valuable feature to our least valuable price**. DocuClipper charges $29–159/mo for exactly this, so **$19 is already the cheap option in the buyer's eyes**. And it doesn't cannibalise: the existing $5.98 plan gets **20 statement pages/mo included**, so the old plan becomes *more* attractive, not less.
>
> **Architecture: same site, same account system, same Stripe — separate price.** No second website, no separate login, no restructuring. Concretely it's just: **one new tool page** with its own upgrade prompt, **two new Stripe prices** (one-time pack + $19 recurring), and a **page-quota counter**.

**India parsing gotchas (bake into tests):** DD/MM/YYYY (never assume MM/DD) · Indian lakh grouping `1,23,456.78` · single amount column with Dr/Cr markers · multi-line UPI/NEFT narrations · `UPI/DR/527XXXXX/PAYEE/BANK` counterparty parsing · repeated page headers/footers · password-protected e-statements are the norm.

---

## 3. Engineering addendum (what the codebase already gives us — added by Claude, 2026-07-16)

**We are further along than the spec assumes. Roughly 70% of the extraction engine shipped this week for PDF→Excel.**

| Spec need | Already built | Where |
|---|---|---|
| pdf.js text + **positions** | ✅ done | `lib/pdf-tables.ts` (`extractTables`) |
| Row/column reconstruction from layout | ✅ done + hardened | `lib/table-extract.ts` — line grouping by y, cell splitting by x-gap, column clustering |
| **Phantom-column suppression** | ✅ done | `dropPhantomColumns()` (≥15% row support) — built after a real form exported as 19 junk columns |
| **Form-vs-table detection** | ✅ done | `looksTabular()` — dominant row-shape ≥50%; a statement scores ~70%, a form ~31% |
| XLSX + CSV export | ✅ done | `lib/xlsx.ts` (jszip, no new dep) + `coerce()` numeric typing |
| Editable review grid + page preview | ✅ done | `components/tools/pdf-to-excel-tool.tsx` |
| Password-protected PDF decrypt | ✅ exists | `/unlock-pdf` (pdf.js, local) |
| OCR for scanned | ✅ exists | `/ocr-pdf` (Tesseract) |
| AI structured extraction + cost caps | ✅ exists | `backend/routes/ai.js` + `utils/aiBudget.js` (per-user monthly cap + global budget kill-switch) |
| Free quota keyed without signup | ✅ pattern exists | `routes/convert.js` `dailyQuota` (IP-keyed, Redis, fails open) |
| Stripe | ✅ integrated | needs new Products/Prices only |

**What's genuinely NEW to build:** ① bank **fingerprinting**, ② per-bank **column maps**, ③ **balance validation** engine, ④ **Tally XML** writer, ⑤ bank SEO pages, ⑥ page-quota + new Stripe tier.

### ⭐ The idea worth stealing from our own architecture: balance validation as a free accuracy oracle
The running-balance check is not just a trust badge — it's an **automatic correctness test with no human in the loop**. That unlocks a cost/quality ladder the competitors can't cheaply copy:

```
local parser → balance validates?  ── yes ─→ done, $0, fully private
                     │ no
                     ▼
        Haiku structured extraction → balance validates? ── yes ─→ done, ~$0.02
                     │ no
                     ▼
        Sonnet (escalate) → balance validates? ── yes ─→ done
                     │ no
                     ▼
        show flagged rows for human review (honest, never silently wrong)
```
**Why it matters:** the spec proposes Sonnet for tier 3. Sonnet on every fallback page is the one thing that could break the unit economics (300 pages × Sonnet ≈ eats the $19). Escalating *only when the balance fails* keeps the blended cost near zero while making the top of the ladder as accurate as needed. **Meter AI pages separately and peg them to the Statements-Pro price** — see `dailydesk-unit-economics`.

### ⚖️ Legal / branding rules (owner-approved 2026-07-16 — binding)
1. **NO bank logos. Ever.** Text names only ("SBI", "HDFC Bank") to describe which formats we read. The original spec §5.1 said "supported banks logos/names" — **logos are dropped.** Using a bank's mark risks implying endorsement; naming them in text to describe compatibility is normal nominative use.
2. **Independence disclaimer, on the tool page and every bank landing page:** *"DiemDesk is not affiliated with, endorsed by, or connected to any bank. Bank names are used only to describe supported statement formats; all trademarks belong to their owners."*
3. **Accuracy disclaimer:** *"Check the output before you file anything."* A conversion aid — not accounting/tax/financial advice, not a substitute for the bank's statement of record. The balance check catches most errors; it is not a guarantee.
4. **Privacy claim scoped honestly:** local for tiers 1–2; tier-3 AI = explicit consent, never silent.
5. **Counsel review required before launch** — banking + trademarks + financial output raises the stakes above our other tools. On the legal checklist.

### 🔒 Marketing the on-device promise (owner decision 2026-07-16)
Showcase privacy **harder here than on any other tool** — for Compress PDF it's a bonus; for a bank statement it's the **purchase reason**. Every rival uploads the most sensitive document a person owns. Put it in the `<h1>`, the `<title>`, and above the fold — not a footer badge. Give users the falsifiable proof line ("open DevTools → Network, zero requests"), because a claim they can verify is worth more than one they must trust.

### Risks / critical path (call these early)
1. **Sample collection is the bottleneck, not code.** Parsers need real layouts per bank (netbanking export, e-statement, passbook). Without samples, parsers are guesses. Start collecting on day 1; build synthetic fixtures matching real layouts for the test suite.
2. **Tally XML must be validated by a real Tally Prime import** — owner-dependency; a "looks right" XML that Tally rejects is worthless.
3. **Privacy claim must stay literally true.** Tier 1/2 local = the claim holds. Tier 3 sends data → explicit consent, never silent, never logged. One sloppy upload destroys the brand this is built on.
4. **Never log statement contents.** Log only: bank detected, page count, success/failure, duration.

### Sequencing note (for the owner to decide)
The spec's own logic is that **revenue needs this tool**, and it lists mobile apps as out-of-scope for v1. Our current build order puts **native apps next**. Native apps *distribute* a product that doesn't monetise yet; this tool *is* the monetisation. **Recommendation: this jumps the queue ahead of native apps** — but it's the owner's call.

---

## 4. Build plan (owner's, compressed by what exists)

- **Week 1** — sample collection (10 banks) + fixtures · bank fingerprinting · reuse `extractTables` for the generic pass · review-table skeleton *(the table UI already exists — fork `pdf-to-excel-tool.tsx`)*
- **Week 2** — SBI/HDFC/ICICI parsers + **balance validation engine** · XLSX/CSV *(export already done)*
- **Week 3** — **Tally XML** (+ real Tally Prime import test) · Stripe credit packs + page quota · Axis/Kotak
- **Week 4** — AI fallback with the balance-gated escalation ladder + consent flow · OCR path · remaining parsers
- **Weeks 5–6** — 10 bank SEO pages + 3 workflow pages · QBO/OFX · cross-promo banners on the free tools · community launch

## 5. Success gates (60 days post-launch)
| Metric | Green | Red |
|---|---|---|
| Bank-page organic impressions | growing WoW | flat ~0 after 8 weeks |
| Parse→export completions | 100+/mo | <20/mo |
| Paying customers | ≥5 | 0–1 |
| **Balance-validation pass rate** | ≥90% | <75% (parser quality problem) |

Green → invoice extraction · Gulf/SEA banks · API · QuickBooks/Zoho direct.
Red → keep the engine, attack an adjacent commercial keyword (invoice→Excel, GST extraction). **The parsing engine carries over either way** — that's what makes this a low-regret bet.

---

_Full original spec: `MyBiz/SystemTools/DiemDesk-Statement-Converter-Spec.md`. Tracked in [master-roadmap.md](master-roadmap.md) §Flagship. Economics: `dailydesk-unit-economics` memory._
