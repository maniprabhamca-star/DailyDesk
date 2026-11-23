# US forms library — scope for review

**Item 8 of the pdf.net response queue. Scoped 2026-11-23. Not built — this is
the list to approve or cut before any page is written.**

Every fact below was measured or read at source today. Where something could
not be verified, it says so rather than guessing.

---

## 1. The competitive reality, measured not assumed

pdf.net's forms library is their biggest content asset, and we are not going to
out-publish it. Read directly off their site today:

- **12 categories**: administrative, business, education, employment, financial,
  healthcare, legal, military, real estate, tax, travel & immigration, plus an
  AI form filler.
- **166 form pages in the tax category alone.** The full library is several
  hundred.
- They **host a fillable copy of each form** — "Each form is downloadable,
  fillable, and easy to customize".
- They are **not stale.** I assumed they would be and checked: their Form W-4
  page is stamped 2026, with a year picker offering 2026 and 2025. The current
  IRS revision of W-4 is 2026. Their W-9 is stamped 2024; the current IRS
  revision is Mar 2024. **Both correct.** The "their copies are out of date"
  attack does not work and should not be used.

### The one thing that is genuinely wrong with their pages

Their W-9 and W-4 pages both carry the badge **"Official IRS form"** and link to
**irs.gov zero times**. Checked on both pages: `irsLink: []`. They assert the
provenance of a federal form without sourcing it, and the reader has no way to
confirm they are being handed the current revision.

That is the opening, and it is the same rule the India library already runs on:
**we never host the form, we link to the authority, and we show the revision we
verified.** See `docs/designs/pdfnet-response-tracker.md` §7.

---

## 2. Where we actually win

Not on count, and not on freshness. Three real wedges:

**a. The data never leaves the device.** This is the whole point, and the forms
make the argument for us. A W-9 is an SSN or EIN. A 433-A is a complete
financial disclosure — every account, every vehicle, every source of income. An
I-9 is identity documents. An FMLA WH-380-E is a doctor's description of a
medical condition. Filling any of those in a cloud editor means those values
transit and are processed by a third party. Ours are typed into a page that
makes no network call, and the Network tab proves it.

**b. We link to the authority and never host.** A government form revised
without notice and served stale from our domain is worse than no copy, because
it looks current. Every page points at the issuing authority's own page.

**c. We can state and re-verify the revision.** `irs.gov/forms-instructions-and-
publications?find=<form>` returns a machine-readable table of Product Number /
Title / **Revision Date** / Posted Date. I used it today to pull live revisions
for 22 forms in one pass. That means a script can re-check every IRS form in
our library and a test can **fail the build when our stated revision drifts from
the IRS's.** Nobody else does this, and it is the honest version of the badge
pdf.net is wearing without a source.

---

## 3. ⚠ The engineering finding — this changes the scope

I probed the actual PDFs with pdf-lib, the library our Fill PDF form tool uses,
to answer whether we can fill these at all. The result was not what I expected.

### Most USCIS forms are encrypted, and our tool silently treats them as scans

| Form | pdf-lib fields | Encrypted? | pdf.js fields |
|---|---|---|---|
| USCIS I-9 | 128 | no | 130 |
| USCIS I-130 | **0** | **yes** | **450** (302 text · 128 check · 20 choice, 12 pp) |
| USCIS N-400 | **0** | **yes** | **440** (14 pp) |
| USCIS I-485 | **0** | **yes** | **730** (24 pp) |
| USCIS I-765 | **0** | **yes** | **161** (7 pp) |

The correlation is exact across all five: **unencrypted → pdf-lib reads the
fields; encrypted → it reads none.** These are standard-security PDFs that open
without a password; pdf-lib has no decryption support, so `ignoreEncryption:
true` loads the file but cannot read the field objects, which sit in compressed
object streams (I-485 has 92 of them).

Consequence today: `extractNativeFields` in `lib/fill-pdf.ts` returns `[]`, and
`fill-form-tool.tsx` falls back to the place-anywhere overlay — so the user can
still type on an I-130, but loses real fields, tab order, checkbox semantics and
validation. **Degraded, not broken.** The comment above that function says `[]`
means "a flat PDF (no form)", and that is now provably wrong: it also means
"an encrypted form we could not read".

### The unlock already ships with us

**pdf.js decrypts these and reads every field** — proven above, 450 on I-130
where pdf-lib saw zero. We already ship pdf.js for every PDF tool. pdf.js also
has `annotationStorage` and `saveDocument()`, which can write a filled form
back, including on an encrypted document.

**So this is feasible, but it is its own piece of work**, not a line in a forms
page. It is the difference between covering the four highest-volume immigration
forms in the country properly and covering them with an apology.

**→ Decision needed (§7).**

### Proven fillable today, no work required

| Form | Fields | Form | Fields |
|---|---|---|---|
| IRS 433-A | **515** | IRS 1040 | 199 |
| VA 21-526EZ | 345 | IRS 1099-NEC | 140 |
| USCIS I-9 | 128 | IRS 2848 | 92 |
| IRS SS-4 | 89 | IRS W-7 | 69 |
| DoL WH-380-E | 60 | IRS W-4 | 48 |
| IRS 9465 | 32 | IRS 4506-T | 29 |
| IRS 8822 | 25 | IRS W-9 | 23 |

### Not verified

- **SSA SS-5 and SSA-1696** came back flat from pdf-lib and the follow-up fetch
  was blocked by CORS from the origin I was on. Re-probe before committing them.
- **State Department DS-11, DS-82** — `eforms.state.gov` 404s, and
  `travel.state.gov` is behind a **Cloudflare bot check**, which we do not
  bypass. These need your own browser, or they stay out.

---

## 4. The form list — tranche 1, 30 forms

Grouped as the index page would group them. ✅ = fillability proven today.
🔓 = needs the pdf.js unlock. Revisions are live from irs.gov, 2026-11-23.

### A. Identity, TIN and authorisation — 9 forms
*The privacy wedge at its strongest: every one of these carries an SSN, EIN or ITIN.*

| # | Form | What | Revision | Fill |
|---|---|---|---|---|
| 1 | **W-9** | TIN certification. The most-requested form in US business, and it is a bare SSN/EIN on a page. | Mar 2024 | ✅ 23 |
| 2 | **W-4** | Employee withholding. | 2026 | ✅ 48 |
| 3 | **W-7** | ITIN application — and it travels **with your passport or a certified copy**. | Dec 2024 | ✅ 69 |
| 4 | **SS-4** | EIN application. | Dec 2025 | ✅ 89 |
| 5 | **2848** | Power of attorney — authorises someone to act on your tax matters. | Jan 2021 | ✅ 92 |
| 6 | **8821** | Tax information authorisation. The weaker sibling of 2848; people file the wrong one. | Jan 2021 | ✅ |
| 7 | **8822** | Change of address. | Feb 2021 | ✅ 25 |
| 8 | **4506-T** | Request for transcript — used in mortgage underwriting. | Apr 2025 | ✅ 29 |
| 9 | **SS-8** | Worker classification determination. | Dec 2023 | ✅ |

### B. Collection and hardship — 3 forms
*The most sensitive financial documents the IRS produces.*

| # | Form | What | Revision | Fill |
|---|---|---|---|---|
| 10 | **433-A** | Collection information statement. **515 fields** — every account, vehicle, asset and income source you have. | Jun 2026 | ✅ 515 |
| 11 | **433-F** | The short collection statement. | Jul 2024 | ✅ |
| 12 | **9465** | Installment agreement request. | Dec 2026 | ✅ 32 |

### C. Returns and information returns — 7 forms

| # | Form | What | Revision | Fill |
|---|---|---|---|---|
| 13 | **1040** | The individual return. | 2025 | ✅ 199 |
| 14 | **1040-X** | Amended return. | *re-check* | ✅ |
| 15 | **1099-NEC** | Non-employee compensation. | Dec 2026 | ✅ 140 |
| 16 | **1099-MISC** | Miscellaneous information. | Dec 2026 | ✅ |
| 17 | **W-2** | Wage and tax statement. | 2026 | ✅ |
| 18 | **941** | Quarterly federal tax return. | Mar 2026 | ✅ |
| 19 | **940** | Annual FUTA return. | 2025 | ✅ |

### D. Immigration — 6 forms
*Ties directly to the `/for/immigration` sector page and the passport photo tool.*

| # | Form | What | Fill |
|---|---|---|---|
| 20 | **I-9** | Employment eligibility verification. Every US hire. | ✅ 128 |
| 21 | **I-130** | Petition for alien relative. | 🔓 450 |
| 22 | **I-485** | Adjustment of status. | 🔓 730 |
| 23 | **I-765** | Employment authorisation. | 🔓 161 |
| 24 | **N-400** | Naturalisation. | 🔓 440 |
| 25 | **I-864** | Affidavit of support — a full financial disclosure by the sponsor. | *probe* |

### E. Employment, leave and veterans — 5 forms

| # | Form | What | Fill |
|---|---|---|---|
| 26 | **WH-380-E** | FMLA certification, employee's own serious health condition. **A doctor writes a medical condition on it.** | ✅ 60 |
| 27 | **WH-380-F** | FMLA certification, family member's condition. | *probe* |
| 28 | **WH-381** | FMLA eligibility and rights notice. | *probe* |
| 29 | **VA 21-526EZ** | Disability compensation claim — medical and service history. | ✅ 345 |
| 30 | **SS-5** | Social Security card application. | *re-probe* |

---

## 5. Deliberately excluded

- **Military DA/DD forms** (pdf.net has a whole category). High volume, but the
  privacy wedge is weak and the audience is not ours.
- **Lease agreements, bills of lading, employee evaluations, invoice templates.**
  These are not government forms — they are generic templates pdf.net authors
  and hosts. Publishing our own would mean hosting content, which breaks the
  rule in §2b, and competing on a commodity. Item 10 is already parked for this
  reason.
- **Death certificates.** pdf.net has a page for this. It is issued by a state
  registrar and is not a form a member of the public fills in.
- **State-level forms** (DMV, state tax). Fifty jurisdictions, each revising
  independently. Not until the federal set is proven.

---

## 6. Rules inherited from the India library, all test-enforced

`tests/unit/india-forms.test.ts` already enforces eight; the US set reuses them:

1. Unique url-safe slug per form.
2. Generated `<title>` inside its 60-char budget.
3. **Never hosts the form** — `officialUrl` must be an authority page, and not a
   direct link to a PDF. For the US set the allowed hosts are `irs.gov`,
   `uscis.gov`, `ssa.gov`, `dol.gov`, `va.gov`, `state.gov`.
4. **No deadline stated as a hard fact** — these move and are extended.
5. Every field specific enough to be worth the page.
6. **Every form gets its OWN gotcha**, no duplicates. This is the field that
   makes a page worth linking to.
7. Tool links use exact catalogue names.
8. Every form sits under a heading the index renders.

**Plus one new to this set:** a `revision` field, checked against the live IRS
table by a script, with a test that fails when the stated revision drifts.

---

## 7. ⚠ Decisions needed before I build

**D1 — the pdf.js field unlock.** Four of the highest-volume forms in the
country (I-130, I-485, I-765, N-400) are encrypted and our filler cannot read
their fields. pdf.js can, and we already ship it.
  - **(a)** Fix it first, then write all 30 pages. Best outcome, and it fixes a
    live limitation affecting any user who brings an encrypted form to the tool
    today — not just these pages.
  - **(b)** Ship 26 pages now, mark the four honestly as place-anywhere only,
    fix later.
  - **(c)** Drop the four.
  - *Recommendation: (a).* The bug exists whether or not we write these pages,
    and shipping a page that says "we cannot properly fill the form this page is
    about" is the kind of thing that costs more than it earns.

**D2 — tranche size.** 30 forms, or start with groups A+B (12 forms, the
strongest privacy argument and all proven fillable) and extend?
  - *Recommendation: A+B first.* It is the sharpest dozen, needs no engineering
    work, and proves the template before we commit to thirty.

**D3 — the honest flow tradeoff.** Because we never host the form, the user has
to fetch the official PDF themselves and bring it to our tool. pdf.net hands it
to them in one click. Our answer is that linking to the authority is the only
way to guarantee the current revision, and we show the revision we verified and
when. **Is that trade acceptable, or do you want to revisit the never-host
rule?** I would keep it — it is the thing their pages get wrong.

**D4 — State Department forms.** Blocked by a Cloudflare bot check we do not
bypass. Want to open `travel.state.gov/.../forms.html` yourself, or leave DS-11
and DS-82 out?

---

## 8. Effort

- Groups A+B (12 forms, no engineering): comparable to the India tranche —
  32 forms there, so roughly a third of that content work.
- Full 30 forms: the India library's scale.
- D1 pdf.js unlock: its own piece of work. Needs a read path, a write path via
  `annotationStorage`/`saveDocument`, and real-file tests on all four encrypted
  forms plus a regression that proves I-9 still fills the old way.

## 9. How every number here was obtained

- pdf-lib field counts: `scratchpad/probe2.mjs`, 22 forms fetched live from
  irs.gov, uscis.gov, ssa.gov, dol.gov, vba.va.gov.
- pdf.js field counts: `scratchpad/probe-pdfjs.mjs`, using the `pdfjs-dist`
  version we already ship.
- Encryption flags: byte-level inspection of each PDF for `/Encrypt`,
  `/AcroForm`, `/ObjStm`.
- IRS revisions: `irs.gov/forms-instructions-and-publications?find=<form>`,
  22 forms in one pass, 2026-11-23.
- pdf.net inventory and badges: read off pdf.net/pdf-forms, /tax-forms,
  /tax-forms/form-w-9 and /tax-forms/form-w-4, 2026-11-23.
