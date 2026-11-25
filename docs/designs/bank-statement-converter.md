# Bank Statement Converter — the Pro conversion engine

**Status:** ✅ Built and verified (see §6, 2026-11-24) — the only thing left before revenue is the Stripe flip · **Owner spec v1.0 (2026-07-16)** · Source: `MyBiz/SystemTools/DiemDesk-Statement-Converter-Spec.md`
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

---

## 6. OFX / QuickBooks Web Connect export — shipped 2026-11-24

The last item on the Week 5–6 line above ("QBO/OFX"), closed. It was not picked
off the list because it was next; it was picked because it had become a
**published promise the product did not keep**.

### 6a. What the gap actually was

`/pricing` sells **"Export to Tally, QuickBooks (QBO) & OFX"** as a Business
feature, and the live changelog entry announcing the Business tier repeats it.
The converter wrote Excel, CSV and Tally XML. Meanwhile
`lib/statement-workflows.ts` told readers QBO/OFX was "on the way".

So the site contradicted itself, and **the half that takes money was the wrong
half**. That is the whole reason this jumped the queue: a Business tier cannot
open while one of its three named exports does not exist.

### 6b. ⚠⚠ INTU.BID — the constraint that shaped the file

A `.qbo` is OFX 1.0.2 SGML plus Intuit's `<INTU.BID>`, a numeric id for the
financial institution. QuickBooks matches it against Intuit's own directory
**before it reads a single transaction**. An id we are not entitled to use
produces either a rejected file or, worse, a clean import filed under somebody
else's bank.

Converter vendors routinely paper over this by defaulting to a real bank's id
(3000 is the one that circulates). **We do not, and the refusal is structural
rather than a policy note**: `buildOfx` throws an `OfxError` when the flavour is
`qbo` and `intuBid` is missing or not 1–6 digits. There is no default and no
fallback.

Research note: every source describing INTU.BID values is a commercially
interested converter vendor; **none is Intuit**. That is itself the argument for
refusing — we cannot verify an id we did not receive from the institution.

The honest route, which the UI implements: the user reads the id out of a `.qbo`
their own bank gives them and pastes it in. Most Indian banks are not in
Intuit's directory at all and never will be, so for them the answer is OFX,
Excel or Tally — and the tool says that rather than inventing an id to make a
button work.

### 6c. Design decisions worth keeping

| Decision | Why |
|---|---|
| One writer, two flavours (`'ofx'` / `'qbo'`) | The only difference is one line. Two files would drift. |
| Reuses `toTallyDate` from the Tally writer | Two exports describe the same rows; **the day a row lands on is not something two files of ours may disagree about**. |
| `FITID` = FNV-1a over (date, signed minor amount, narration, sequence) | Importers dedupe on FITID. An id that moved between exports would **silently double every transaction** in somebody's books, and nothing in our own product would look wrong. Derived only from facts about the row. |
| Money out is **negative** `TRNAMT`, derived from debit/credit, never copied | An inverted sign imports cleanly and is wrong in exactly the way nobody notices until reconciliation. |
| Non-Latin-1 folded to ASCII (₹ → `Rs.`) | The header declares `USASCII`/`1252`. Emitting a rupee sign after declaring that makes the file lie about itself. Currency is carried by `<CURDEF>`. |
| `bankId` = the IFSC we parsed | OFX wants a routing-style id and has no Indian concept for one; the IFSC is the closest true thing we hold. |
| Rows that cannot be written are **reported, not dropped** | See 6e. |

### 6d. ⚠ The sabotage test, and the guard that did not bite

Three deliberate breakages were injected into `lib/banks/ofx.ts` to check the
tests were load-bearing:

| Sabotage | Caught? |
|---|---|
| Default `intuBid` to `'3000'` | ✅ two tests failed |
| Invert the sign convention | ✅ failed |
| Add `Date.now()` to the FITID basis | ❌ **all green** |

The FITID test compared two exports built with different `now` options — and
two builds inside one test run land in the same millisecond, so `Date.now()`
was identical in both. **Comparing two outputs can only prove determinism
across whatever actually varied between them, and in-process almost nothing
does.** The test was replaced with one that reads `fitId`'s source and refuses
the ingredients (`Date.now`, `Math.random`, `performance.now`, `new Date`,
`crypto.randomUUID`), plus a check that the caller does not quietly pass one in.
That version fails when it should.

A second guard had the opposite fault: the "no hard-coded institution id" scan
used `/intuBid\s*(?:\?\?|\|\|)\s*['"]/`, which flagged the **validation line
itself** (`String(o.intuBid ?? '').trim()`). A guard that fires on correct code
teaches the next person to weaken it. Tightened to require a digit.

### 6e. ⚠ Found by running a real statement, not by a test

Six rows in, five transactions out — silently. Only rows that move money can
become OFX transactions, so the opening-balance line is dropped. Correct
behaviour, invisible failure mode: it surfaces at a reconciliation months later,
to someone with no reason to suspect the converter.

The export now returns `skipped[]` and the UI prints it, naming each row **by
its printed date and narration** rather than by `row`, which is a parser-internal
0-based index ("Row 0" is not something a person can find on their statement).

This is the **fourth consecutive ship** where reading the rendered page caught
something no test did. The other one here: the converter page's step 3 still
read *"export to Excel or CSV (Tally XML coming next)"* — stale twice over,
since Tally had already shipped. Page copy lives in
`app/bank-statement-converter/page.tsx`, not in `lib/statement-workflows.ts`,
and only the second was rewritten.

### 6f. Verification

- `tests/unit/ofx.test.ts` — 21 tests. Suite now **523 / 45 files** (was 502 / 44).
- Production build clean, 379 static pages.
- Driven end to end in a real browser against the production build: a synthetic
  HDFC-layout statement parsed (95% confidence, 6 rows, balance verified), the
  `.qbo` refusal rendered on an empty id, a `.qbo` with a user-supplied id
  produced the correct header, `<INTU.BID>4321`, 5 transactions and the right
  signs, and the skipped-row note rendered.
- ⚠ **Not verified, and cannot be here**: that QuickBooks or Xero *accepts* the
  file. Only a real import proves that — the same honest limit already recorded
  on the Tally writer. Do not let the green suite talk anyone out of that check.

### 6g. What this does not do

No direct QuickBooks Online / Xero API connection (that is an OAuth integration
and a different product decision), no CAMT.053 or MT940, no multi-currency
statement in one file.
