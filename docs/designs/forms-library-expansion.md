# Forms: how far to take it, and where it should live

**Status:** proposal, 2026-11-23. Written in answer to two owner questions on the
same day — *"every US state has unique forms, do we have all? what about grouping
all the forms of all US states and probably top countries?"* and *"should the forms
website be new, or can we do it here in diemdesk?"*

Nothing in this doc is built. The weekly sync job described in §5 **is** built and
running (`.github/workflows/forms-sync.yml`, proven end to end on 2026-11-23).

---

## 1. The short answers

**Where should it live? Inside DiemDesk, as a subdirectory. Not a new domain, and
not a subdomain.** Reasoning in §2 — but the one-line version is that the only
thing we have that a forms directory can't buy is the fill engine, and the moment
the directory lives somewhere else, the one-click promise becomes a cross-domain
redirect to a company the reader has never heard of.

**Should we group all 50 states' forms? Not the way the question is framed.**
A per-state directory is 1,500–4,500 forms and it would destroy the only thing
that makes `/us-forms` better than the aggregators. The version of the idea that
works is a **form-type × state matrix** — one form, all fifty states, on one page —
and that is both smaller and more valuable. §4.

**Is there really no competitor? There is, it's just not framed as "state forms".**
pdfFiller, US Legal Forms and FormSwift all run large fillable-form libraries and
monetise exactly this funnel. What none of them does is publish a verified revision
and fill on-device. That — not breadth — is the wedge. §3.

---

## 2. Separate site, or here?

### The case for a separate site, taken seriously

- "US state tax forms" is a different search intent from "compress PDF", and a
  forms directory of 1,000+ pages would dominate our sitemap.
- It could be spun out or sold as its own asset.
- A content property runs on a different cadence from a tool property.

### Why it still loses

**1. The product is the handoff, and the handoff can't cross a domain.**
Our form pages aren't a directory with a download link. They fetch the blank form
live from the agency and drop it into our fill tool, in the reader's browser,
nothing uploaded. A separate site would have to either rebuild the editor (the
expensive half of this company) or bounce the reader to `diemdesk.com` — and a
redirect to an unfamiliar domain, on the page where someone is about to type a
Social Security number, is the worst possible place to spend trust.

**2. We'd be starting from zero authority against entrenched incumbents.**
`diemdesk.com` has 176 indexed pages, `llms.txt`, Markdown twins and a real
sitemap. A new domain has none of it, and form queries are contested by the
agencies themselves plus aggregators with a decade of backlinks. On a realistic
view that's 12–18 months before a new domain ranks for anything — against a
subdirectory that inherits what we already have on day one.

**3. A second surface costs what we already decided it costs.**
Second deploy, second CI, second nginx, second robots/sitemap/analytics, second
set of legal pages, second QA matrix. This is the same arithmetic that killed the
native Capacitor app (`dailydesk-platform-strategy`): the build estimate was never
the problem, the permanent multiplier on every future change was.

**4. A subdomain is the worst of the three.** Search engines treat it as
semi-separate, so authority transfers less well than a subdirectory — while the
operational cost is the same as a separate site. It buys the downside of both.

### Recommendation

Keep it at `diemdesk.com/us-forms/**` and `diemdesk.com/india-forms/**`, with the
new matrices as siblings (`/state-forms/<type>/`, see §4). Revisit **only** if the
forms section ever earns its own revenue line and brand — at which point you move
it with 301s from a position of strength instead of starting cold.

**One thing worth doing now regardless:** a single `/forms` hub that owns the whole
family (US federal · state matrices · India · passport photos) and is the page we
build links to. Today the libraries are siblings with no parent, so there is
nothing to point a link at that means "DiemDesk does forms."

---

## 3. What we are actually competing with

**Read at source 23 Nov 2026**, in the browser, because the first draft of this
section asserted it from memory and got it wrong in three ways. Corrections are
marked.

| | What they actually do | Us |
|---|---|---|
| **pdfFiller** | Library far larger than ours, and **already covers state forms** ("tax forms for each state… just choose the state and year"). Hosts year-archived copies. ⚠ **Does** link irs.gov, **does** carry a non-affiliation notice, and **warns you on an old year** with an interstitial: *"This is the 2014 version… Get the latest 2024 version / Edit the 2014 version."* | Live fetch from the agency every time, nothing hosted, nothing uploaded |
| **US Legal Forms** | Also year-labelled hosted copies, **also covers state forms** (a Georgia DOR T-239 from 2015 sits in its tax library). Links the issuing agency once; no non-affiliation notice on that page. Subscription **$8/mo and $15/mo**, with a pricing FAQ headed *"What if I only want one form and I don't want a subscription?"* | Blank form free, no account |
| **FormSwift** | ⚠ **Closed September 2026.** formswift.com serves a goodbye page pointing at Dropbox. Do not cite it as a competitor. | — |
| **pdf.net** | 225-page forms library; badges "Official IRS form" while linking irs.gov **zero** times. Still the sharpest contrast of the four. | We print the revision we measured, the date, and the agency link |
| The agency's own site | Always current, authoritative | We can't beat that and shouldn't try — we link to it on every page |

### ⚠ The correction that changes a premise

The idea behind this plan was partly *"nobody groups state forms."* **That is not
true — two live competitors already do.** What is true, and checked:

> **Not one of them prints the agency's own revision marker, a field count, or a
> date checked.** They label by *year*, which tells you which edition you picked
> but nothing about whether it is still the current one. And none of them can
> fill a form without it leaving the device.

So the matrix is still the right shape — but **it wins on the claim, not on being
first**, and the plan should be read that way. Being more careful than pdfFiller
is a narrower advantage than being alone in the field, and it has to be earned
every Monday rather than announced once.

So the claim is not *"we have the most forms."* It is:

> **The revision is the one the agency publishes today, we counted the fields
> ourselves, and what you type never leaves your device.**

Everything in §4 and §5 exists to keep that sentence true. **Any plan that adds
forms faster than we can verify them trades the moat for page count** — it turns
us into a smaller pdfFiller. That is the single trap to avoid, and it is the
honest reason the answer to "all 50 states" is no.

---

## 4. The plan

Ordered. Each phase is shippable on its own and the next one is optional.

### Phase 0 — close the gaps in what we already publish (do this first)

Fix-before-scale, the same call made on the passport specs.

- **`verify:india-forms`.** The 34 Indian form pages assert less than the US ones
  *by design* — most Indian filing is online and there is often no fillable PDF to
  measure, which `lib/india-forms.ts` says in its header and is correct about. But
  they do assert an authority and an `officialUrl`, and nothing checks that those
  still resolve. A link-reachability verifier on the same contract as
  `verify:us-forms`, wired into the same weekly job. **~2 h.**
- **`/forms` hub page** (see §2). **~3 h.**
- **Print the staleness.** Each page shows the date we checked. Once the weekly job
  is running, show *how long ago* instead, and let it go red past a threshold. A
  claim that rots silently is worse than no claim. **~2 h.**

### Phase 1 — the state wedge: one form type across all 50 states

**The reframe that makes this tractable.** Nobody needs "all Georgia forms." They
need *one* form and don't know which state publishes which version of it. So the
valuable unit is a **matrix** — one form type, every state, on one page — not a
per-state directory.

This is also exactly the gap the owner noticed: **ST-5 is one cell** in the
exemption-certificate matrix, and the MTC multijurisdiction certificate is the
matrix's header row.

Candidate matrices, best first:

1. **Resale / sales-tax exemption certificates.** The MTC *Uniform Sales & Use Tax
   Resale Certificate – Multijurisdiction* (last revised 14 Oct 2022) is accepted by
   36 states; the rest publish their own (Georgia's ST-5, and so on). One page that
   answers "which certificate does my customer in X accept" has an obvious reader —
   anyone selling B2B across state lines — and the MTC itself maintains a link hub,
   so provenance is tractable rather than fifty separate hunts.
2. **State employee withholding certificates** (the state W-4 equivalents). Every
   new hire needs one, HR looks it up constantly, and most are revised annually —
   which is precisely where a verified "current revision" is worth money. *VERIFY
   AT SOURCE before scoping: nine states have no income tax and several others
   accept the federal W-4 instead of publishing their own, so the real cell count
   is well under 50.*
3. **New-hire / onboarding packet per state** — assembled from (2) plus the federal
   I-9 and W-4 we already have. This is the one that leads naturally into Phase 3.
4. **State tax power-of-attorney / authorisation forms** — the state analogue of
   Form 2848 / 8821, which we already carry.

⚠ **A cell is not a form, and conflating the two is how this gets oversold.**
An earlier draft of this line read "~3 matrices × ~45 cells ≈ 135 forms", which
is wrong by roughly a factor of three. The MTC multijurisdiction certificate is
accepted by **36 states**, so in matrix 1 one verified form fills 36 of the ~45
cells and only the dozen-odd states publishing their own need a new entry.
Matrix 3 adds **no** new verification at all — it is matrix 2 plus the federal
I-9 and W-4 we already carry. And matrix 2's real count is well under 50, since
nine states have no income tax and several accept the federal W-4.

The honest projection, which is the one in
[forms-library-expansion.html](forms-library-expansion.html) and must stay in
step with it:

| After | Verified forms | Form pages |
|---|---|---|
| Today | 62 | 64 |
| Phase 1 · matrix 1 | ~77 | ~81 |
| Phase 1 · all | ~140 | ~150 |
| Phase 2 (UK/CA/AU) | ~190 | ~205 |

**Pages grow faster than forms, and that is the point** — a matrix is a page per
state whether or not the state publishes its own PDF, so the reader gets a
50-cell answer out of ~15 new verifications. Verifiable with the machinery we
already have. SEO shape is a good one: a strong hub plus thin spokes, rather
than two thousand orphan pages.

**Start with matrix 1 only.** ~45 cells but only **~15 new verified forms**
(62 → ~77), closes the gap the owner found, and proves the matrix shape before
committing to the rest.

### Phase 2 — more countries, chosen by publishing behaviour not by GDP

Two conditions, both hard requirements:

- forms published centrally by **one** authority at **stable** URLs, and
- the published PDF is actually **fillable** — if it's a scan, we'd be hosting a
  picture and the fill tool has nothing to fill.

On that test the realistic next pair is **UK (HMRC)** and **Canada (CRA)**: single
national authority, stable `gov.uk` / `canada.ca` URLs, English, clear version
markers. **Australia (ATO)** third.

Explicitly **not**: anything behind a login or a bot check. The State Department's
DS-11/DS-82 are already excluded for exactly this reason and that stays — we do not
bypass a Cloudflare challenge, on any site, for any reason.

### Phase 3 — the part that is actually ours

A **form finder**: you say what you're trying to do — "hire someone in Texas",
"sell to a reseller in Georgia", "change my address with the IRS" — and get the
*set* of forms, in order, each one click from being filled on your device.

Nobody else can build this, because it needs the verified index **and** the fill
engine **and** on-device chaining, and no competitor has all three. It is also the
natural paid shape:

- the directory stays **free** and is the funnel;
- the **packet** is Pro — multi-form, your business details entered once and carried
  across every form in the set, chained through **Saved Workflows** (already built,
  all 12 steps wired, owner-gated).

This is the only phase that justifies the content work in 1 and 2. Worth keeping in
view from the start so the data model doesn't foreclose it.

---

## 5. How a form reaches you, and how it stays current

Two things on two different clocks. Conflating them makes the rest of this
section unreadable, so: **the file is always the current one — there is no copy
on our server that could be anything else.**

### The file — always live, never stored

We host nothing. The moment someone clicks, our server requests the form from
the **issuing agency** — meaning literally the government body that publishes
it: `irs.gov`, `uscis.gov`, `dol.gov`, `va.gov`, `ssa.gov` — and passes those
exact bytes through.

All thirty source URLs are **version-free canonical paths** (`fw9.pdf`,
`i-485.pdf`, `ss-5.pdf`). The agency overwrites in place when it revises, so
the address always holds the current edition. No year or edition is baked into
any of them.

Nothing caches it. Verified on production rather than assumed:

| Layer | State |
|---|---|
| Our route | `export const dynamic = 'force-dynamic'` |
| Our fetch upstream | `cache: 'no-store'` |
| Response to the reader | `Cache-Control: no-store` |
| Cloudflare | `cf-cache-status: DYNAMIC`, no `Age`, on repeat requests |
| The bytes | SHA-256 identical to irs.gov's own file — `2d420cbb4123dcf1`, 140,815 bytes both |

### The caption — a snapshot, and the only thing that can drift

`Rev. March 2024 · 23 fillable fields · 6 pages · checked 23 Nov 2026` is
something we *measured* and wrote down. It is the claim no competitor makes, and
the only part of the page with a shelf life.

**The Monday job does not keep the forms current — they are never anything else.
It keeps our description of them honest.**

| When | The PDF you receive | The caption on our page |
|---|---|---|
| Today | Rev. March 2024 — correct | "Rev. March 2024" — correct |
| IRS publishes Rev. Dec 2026, a Tuesday | **Rev. Dec 2026 — correct, that same second** | still "Rev. March 2024" — **wrong** |
| Following Monday | Rev. Dec 2026 — correct | corrected |

Worst case: **a wrong caption on a correct document**, for at most six days —
never an old form in anyone's hands. The job also runs on any push touching the
form data, and a moved or retired URL is caught separately (the verifier checks
the agency page is reachable; the button falls back to a direct agency link
rather than dead-ending). Making those six days visible — *"checked 3 days
ago"*, going red past a threshold — is the Phase 0 item.

## 5b. Keeping it in sync at scale — the engineering answer

### What exists today (built, running)

`.github/workflows/forms-sync.yml`, Mondays 06:00 UTC plus on any edit to
`lib/us-forms.ts` or the verifier. It reads all 30 forms from the IRS, USCIS, DOL,
VA and SSA and compares revision, field count and page count against what our pages
claim. Two different emails, because they are two different pieces of news:

- **drift** — a page of ours states a revision that no longer exists. Red run.
- **unreadable** — a form couldn't be fetched, or printed its marker somewhere the
  script can't parse. Emailed, not failed. One week is noise; the same form twice is
  a claim nobody has checked.

First real run: `forms=30 drifts=0 unchecked=0`, 40 seconds. Test email proven to
arrive (`workflow_dispatch` → `test_alert`).

### Why "daily" is the wrong ask, and what to do instead

Daily is noisier without being faster in any way that matters — these forms change a
handful of times a year and the window that counts is "did we notice within days".
**Tiered, by how often that issuer actually revises, derived from observed history
rather than guessed:**

| Tier | Example | Cadence |
|---|---|---|
| A — annual, predictable | 1040 series, state withholding certificates | weekly Dec–Feb, monthly otherwise |
| B — irregular | USCIS editions, state exemption certificates | weekly |
| C — stable for years | MTC multijurisdiction | monthly |

### What has to change before this survives 2,000 forms

The current job makes ~90 requests. At 2,000 forms it would be ~6,000 requests
across ~150 hosts, many slow and some hostile. Four changes make that feasible:

1. **Conditional requests.** Store `ETag` / `Last-Modified` per form; a `304` skips
   the download *and* the parse. Turns 6,000 heavy requests into 6,000 cheap ones
   with maybe twenty downloads.
2. **Content hash as the primary drift signal.** Hash the PDF bytes. Cheaper and
   more reliable than parsing a revision marker, and it catches changes the marker
   misses. Parse the marker only when the hash moved.
3. **Per-issuer marker adapters, not one regex.** Five federal agencies already use
   five different version concepts — IRS `Rev.`, IRS annual `Form year`, USCIS
   `Edition date`, DOL `Revised`, VA/SSA `Form date`. Fifty states will be closer to
   fifty concepts. Each issuer gets a small pluggable reader with its own test
   fixture; a new state is then a data row plus one adapter, not a change to shared
   parsing.
4. **Shard by issuer** across a job matrix, so one slow state can't time out the run
   and we stay polite to each host.

---

## 6. Compliance and positioning

The owner's question was *"hope we are compliance and always general"* — yes, and
here is precisely why, so it stays that way as the library grows.

- **We host nothing.** Every file is fetched live from the issuing agency at click
  time. This is simultaneously the privacy story, the staleness answer and the
  copyright answer. **Keep this invariant absolutely** — the day we mirror a PDF, all
  three arguments weaken at once.
- **Copyright.** US federal government works are not subject to copyright
  (17 U.S.C. §105). **State and foreign forms get no such blanket exemption** — a
  second, independent reason that live fetch rather than mirroring is the only
  defensible model as we move into states and other countries.
- **Non-affiliation.** Every page naming an agency carries the shared
  `<ThirdPartyNotice>`: not affiliated, why the name is on the page, and what we
  actually are. Guarded by a test that lists every such file. Non-negotiable for
  every new page.
- **No legal or tax advice.** Pages describe what a form *is* and who publishes it.
  They never say whether you should file it, or what to put on it. The construction
  sector page's deliberate "this is not a compliance argument" stance is the
  precedent; keep it.
- **Not a preparer.** We supply a tool, not a service. Nothing may imply we review,
  check or submit anything on anyone's behalf.

---

## 7. What I'd do next

1. Phase 0 — `verify:india-forms`, the `/forms` hub, staleness on the page. ~7 h.
2. Phase 1 matrix 1 only — resale / exemption certificates, ~45 cells including the
   ST-5 the owner went looking for.
3. Stop and look at the numbers before matrix 2.

**Open decisions for the owner:**

- **D1** — Phase 1 matrix order: exemption certificates first (recommended), or
  state withholding certificates?
- **D2** — `/forms` hub: build it now with Phase 0, or wait until there is a third
  library to parent?
- **D3** — Phase 3 packet as Pro: confirm that's the paid line, since it decides
  the data model.
- **D4** — the owner's personal address is hardcoded in
  `.github/scripts/notify-failure.mjs` and three other tracked files in a **public**
  repo. The new alerter takes it from the `ALERT_TO` secret instead. Move the old one
  the same way?
- **D5** — pdfFiller also runs a **business-document template** catalogue (agendas,
  bills of sale, cover letters, CVs, invoices, budgets). Do we want that? My answer
  is yes, but **not in the forms library**: those have no issuing authority, no
  revision and no provenance, so not one line of the machinery in §5 applies to
  them, and shelving them beside government forms would blur the only thing that
  makes the forms credible. They belong to **DiemDesk Studio**
  (`diemdesk-studio-concept.md`), where a template is a design asset and a Pro
  feature rather than a commodity directory every competitor already has. Pipeline,
  not now.

---

## Phase 1 · matrix 1 — shipped 2026-11-25 (ship 1 of 2)

`/resale-certificates`. Data `frontend/lib/resale-certificates.ts`, contract
`frontend/tests/unit/resale-certificates.test.ts` (29 tests).

### The scope split, and why it is a split and not a cut

The plan assumed provenance would be tractable because "the MTC itself
maintains a link hub". **It does not.** The hub is 50 links to state revenue
department *homepages* — not to certificate pages. So each state's own form is
a separate hunt, and the hunts are expensive: of the first twelve URLs built
from prior knowledge, **four survived verification**. The rest 404'd, 403'd or
served HTML.

So matrix 1 ships in two:

| | Scope | State |
|---|---|---|
| **Ship 1** | The MTC acceptance matrix: all 51 jurisdictions, each verdict and caveat traced to the certificate's own notes. | ✅ live |
| **Ship 2** | Each jurisdiction's own certificate as a second column. | 8 of ~45 verified |

Ship 1 is complete rather than partial — every claim on it comes from one
document that was read end to end. A half-filled "own certificate" column
would have been the worse page.

**Verified at source and banked for ship 2** (form number confirmed printed on
the document itself, not merely a URL that resolved): CA `CDTFA-230`,
TX `01-339`, NY `ST-120`, PA `REV-1220`, AZ `5000A`, GA `ST-5`, ID `ST-101`,
IL `CRT-61`.

### ⚠⚠ The finding that is the page

"Accepted" is not one thing. Of the 38 jurisdictions printed on the
certificate, **26 attach a condition**:

- **9 take it for resale only** and say in terms that it is not valid as an
  exemption certificate — CA, CT, KY, MD, NV, PA, RI, TN, WI. A seller filing
  it against another exemption holds paper that does not cover the sale.
- **4 exclude a taxable service bought for resale** — CO, HI, IL, NM share
  note 5.
- **Florida needs a second artefact** — a resale authorisation number from the
  Department of Revenue, on top of the form.
- **Hawaii inverts it** — the *seller* claims a lower general excise rate
  rather than the buyer claiming an exemption.
- **13 are absent**, of which 5 have no general sales tax.

A page that printed a tick against 38 states would have been the wrong page.

### ⚠ Two errors on mtc.gov that must not be re-synced

Both are pinned by tests, because the obvious future "fix" is to rebuild the
list from their page:

1. Its California link points at the **Franchise Tax Board**, which administers
   income tax, not sales tax. Ours points at **CDTFA**.
2. Its state-links list **omits Nevada**, which is printed on the certificate
   (note 20). Ours includes it.

A third discrepancy is published rather than silently resolved: their prose
says **36 states**, their certificate prints **38 boxes** (37 states plus the
Alaska Remote Sellers Sales Tax Commission, a municipal body). We print what
the form prints and say the two disagree. A test asserts the two numbers stay
different — if they ever match, somebody re-synced from the prose.

### ⚠ A cell is not a form — restated, because it caused a 3× overstatement

Matrix 1 is ~51 cells and only **~15 new verified forms**, because one MTC
certificate answers 38 of them. See the corrected projection table above.

### Engineering notes

- **`<CheckedAgo>` now takes its date as a prop.** It imported `CHECKED_ON`
  from `lib/us-forms` directly, which is how the India task pages ended up
  printing the date the *IRS* library was last checked. A borrowed
  verification date is a false provenance claim on a page whose entire
  argument is provenance. It still defaults to the federal library; a caller
  with its own clock passes its own.
- **Counts derived, never typed** — including the SEO description, which is a
  template over `ACCEPTING.length` and is budget-tested (it built at 184
  characters first time and is now 150).
- **One URL, no pagination.** 51 rows is exactly the size that tempts a
  `?page=2`; splitting it would destroy the only reason to visit.
- **Advice boundary**: the shared `_advice-vocabulary` guard applies. Six rows
  were rewritten from "the buyer must enter a Kansas number" to "Kansas looks
  for a Kansas number" — one states a duty, the other describes a document.
- **Sabotage-tested**: stripping a caveat off a conditional row, re-syncing
  California to the FTB, and reintroducing "must" each fail the suite.

### What ship 2 needs

The 9 taxing jurisdictions absent from the certificate (DC, IN, LA, MA, MS, NY,
VA, WV, WY) publish their own and are the highest-value cells — a seller with a
customer there gets no answer from the MTC form at all. `NEEDS_OWN_FORM`
exports exactly that list and a test pins it at 9, so a scope change is a red
build rather than a quiet drift. `scripts/`-style harnesses used here live in
the session scratchpad; the durable artefact is the verified-form list above.

---

## Phase 1 · matrix 1 — shipped 2026-11-25 (ship 2 of 2)

Ship 1 published the MTC grid and left 13 rows saying only "not on it". Ship 2
answers them. **12 documents read at source**, the form number confirmed against
what is printed on the document itself, pages and fillable fields measured.

### ⭐⭐ The finding: there are two header rows, not one

The expansion plan assumed one multistate form per matrix. There are two. The
**Streamlined Sales Tax Governing Board** publishes **SSTGB Form F0003**,
accepted by all **24** member states (23 full + Tennessee as associate), read
at source from streamlinedsalestax.org.

It earns its place on the page for one reason: **Indiana, West Virginia and
Wyoming** are Streamlined members and are *not* on the MTC certificate. Three
of the nine jurisdictions the first grid could not answer are answered by the
second form. A matrix design that assumes a single header row would have
missed this entirely.

### ⚠ Half the remainder are not documents you fill in

Exactly the lesson the India library taught with `howFiled`. A column of
"download the form" links would have been wrong about the main thing it
described, so `OwnCert` is a discriminated union and `kind` carries the answer:

| kind | who | what it means |
|---|---|---|
| `form` | 11 states | a blank PDF anyone can download. Measured. |
| `issued` | LA, FL | the department issues it per business; no blank exists. LA expires annually via LaTAP. |
| `none` | MS | **no certificate exists.** The DOR does not accept or use blanket certificates; a buyer shows a permit or letter it issued. |
| `unverified` | DC | source 403s. No claim, and the variant has **no url field**, so there is nowhere to put a guess. |

### The 12 verified documents

| Code | Form | Pages | Fields | Revision, as printed |
|---|---|---|---|---|
| SST | SSTGB F0003 | 2 | 97 | Revised 12/21/2021 |
| AZ | 5000A Arizona Resale Certificate | 1 | 26 | ADOR 10316 (8/25) |
| CA | CDTFA-230 General Resale Certificate | 1 | 13 | *(none printed)* |
| GA | ST-5 Certificate of Exemption | 1 | **0** | Rev. 07/11/22 |
| ID | ST-101 | 4 | 69 | EFO00149 02-27-2025 |
| IL | CRT-61 Certificate of Resale | 1 | 27 | R-04/25 |
| IN | ST-105 | 2 | 23 | *(none printed)* |
| MA | ST-4 Sales Tax Resale Certificate | 1 | 17 | Rev. 8/16 |
| NY | ST-120 Resale Certificate | 2 | 25 | 1/26 |
| PA | REV-1220 | 2 | 48 | 07-23 |
| TX | 01-339 | 2 | 27 | Rev. 4-13/8 |
| VA | ST-10 | 1 | 11 | Rev. 05/26 |

286 fields across the 11 state blanks. **Georgia's 0 is a measurement**, not a
gap — the ST-5 is a flat print-and-sign form.

### ⚠⚠ Ship 1 published four claims ship 2 disproved

Ship 1 wrote *"Use &lt;State&gt;'s own."* against all nine MTC-absent taxing
jurisdictions **before any of those documents had been read**. Four were wrong:
Mississippi publishes none, the District's could not be opened, and West
Virginia and Wyoming have no own form at all — their route is Streamlined. The
`absent` group blurb carried the same claim ("the rest publish their own") and
a hand-typed "Five".

Both are now corrected, and a test (`an absent row promises no document`)
forbids the verdict prose from naming any document. The route is rendered from
`OWN_CERTS` and `SST_MEMBERS`, where every entry was read at source.

**The generalisable rule: a placeholder that reads like a finding is worse than
a blank.** "Not on the certificate" was true and useful. "Use Indiana's own"
looked like the result of research nobody had done.

### ⚠⚠⚠ Three guards that were not guards

Caught this ship, all three by the same habit — *sabotage the guard before
trusting it*:

1. **`adviceBreaches(text)` takes an ARRAY.** Passed a bare string, the
   function iterates its **characters**; no pattern can match one character, so
   it returns `[]` and the clean-prose test asserted nothing while reporting
   green. `tsconfig.json` excludes `tests` and `**/*.test.ts`, so nothing
   type-checks these files. Fixed with a **runtime** `TypeError` in
   `_advice-vocabulary.ts`, which protects every current and future caller.
2. **`\b` through a Bash→Python heredoc became a literal backspace (0x08).**
   The absent-row regex read `/\bown\b|…/` in review and contained control
   characters in the file, so it could never match. Third occurrence of this
   trap this session. **Do not put backslashes through a Python heredoc here** —
   use the Edit tool or a script file.
3. **A readiness probe answered by the thing being replaced.** `next start`
   failed with `EADDRINUSE` while the *old* server kept serving the *old* build
   on :3100 and answering the `curl` health check with 200. Two verification
   passes read stale output as fresh. Now the probe greps the new server's own
   log for `Ready in`, not the port.

### Found by reading the rendered page (six consecutive ships now)

- `STATUS_BLURB.absent` still carried the disproved claim and a typed count.
- `<ThirdPartyNotice because=…>` took a lowercase fragment, so the page read
  *"…named here. to describe a published form and…"*. **The component's test
  checked presence, not shape** — now it checks both, and `/resale-certificates`
  was not even on its list. Both fixed; both halves sabotage-tested.
- "District of Columbia refuses automated requests" — the place does not; its
  tax office does. Now renders the authority name.
- A chip read `ST-4 Rev. 8/16 17 fields`; the two numbers ran together.
  Separator added.
- **`/resale-certificates` was an orphan** — linked from `sitemap.ts` and the
  changelog and nothing else. `/forms` now carries a section for it,
  deliberately *not* a third library card: the FAQ below it explains why there
  are exactly two libraries, and a matrix is not a third one.

### On the form count

`FORM_COUNT` stays **62**. It counts the two libraries that have a page per
form; the matrix has no per-form pages and quoting 75 would be the same
cells-are-not-forms error corrected in §174. The matrix states its own numbers
(`OWN_FORM_COUNT`, `OWN_FORM_FIELDS`), derived.

Honest total today: **62 forms with their own pages, plus 13 documents verified
on the resale matrix** (MTC + SST + 11 state certificates).

### What a ship 3 would chase

`STILL_UNANSWERED` exports exactly the open list and is pinned by a test. It is
`['DC']`. That is the whole backlog for matrix 1.
