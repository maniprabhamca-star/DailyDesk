# Phase 3 — the form finder, and the packet

The part of the forms plan that is actually ours. Spec of record; mockup at
`designs/forms-finder-mockup.html`. Follows
[`forms-library-expansion.md`](forms-library-expansion.md) §4 Phase 3, and
settles its open decision **D3**.

Written 2026-11-24, after the owner chose Phase 3 over Phase 1 on the grounds
that it is the phase that converts.

---

## 1. The one-line case

Phase 1 and Phase 2 add forms. **Phase 3 adds the only thing a competitor
cannot copy**, and it adds it to the 62 forms already verified — so its first
ship creates *zero* new verification load.

| | pdfFiller / US Legal Forms / FormSwift | the agencies | us |
|---|---|---|---|
| A verified index with revisions read at source | no | n/a | **yes** |
| A fill engine | yes | no | **yes** |
| On-device chaining between forms | no | no | **yes** |

The finder needs all three. That is the whole argument, and it is why this is
worth building before more forms.

---

## 2. What it is

A reader arrives with a *task*, not a form number. "I am hiring someone."
"A client wants my tax number." "I cannot pay the IRS."

A task page gives them:

1. **The set** — every form involved, in the order it happens.
2. **Who fills each one, and where it goes.** Not always the agency: the W-9
   goes to the payer, the W-4 stays with payroll, the WH-381 is issued *to* the
   employee by the employer. This is the single most useful column and no
   competitor prints it.
3. **One click per form into the filler**, via the existing
   `/forms-api/file/<slug>` → `GetFormButton` → `lib/file-handoff.ts` path. The
   current version, fetched from the agency at click time, never stored.
4. **What this page does not cover** — above the fold, not in a footer.

13 tasks cover all 30 US forms. See §7.

---

## 3. ⚠⚠ The constraint that shapes everything: we do not give advice

A page that answers "what forms do I need to hire an employee" is one step from
practising law and tax. The standing invariant is that we are a **tool, not a
preparer**, and the competitors blur exactly this line.

The resolution that keeps the feature and the invariant:

> **A task page never says "you need". It states which forms are involved, who
> files each one and where it goes — and every line traces to a sentence we
> already verified at source for that form.**

The libraries already carry `what`, `who`, `when` and `gotcha` per form, each
read off the agency's own page or the PDF itself on `CHECKED_ON`. A task page
**composes verified per-form facts into an order. It does not generate new
claims.** That is a mechanical rule, and it is enforced three ways:

1. **There is no `required` in the vocabulary.** A form's relevance is
   `always` · `usually` · `sometimes`, and anything other than `always`
   **must** carry a `condition` string saying when. A test fails the build on
   the words "required", "you must" and "you need to file" in task copy.
2. **`notCovered` is a mandatory field**, rendered above the fold. The honest
   list every time: state and local forms, deadlines, eligibility, and anything
   industry-specific.
3. **Every task names its `sources`** and inherits the libraries' freshness —
   an ageing or stale check shows the same amber/red on a task page as on a
   form page.

§3 is not caution for its own sake. "Which forms are involved, and who files
each" is a genuinely useful page that nobody publishes well. "Here is what you
must do" is a page that already exists everywhere and that we are not qualified
to write.

---

## 4. ⚠ The second trap: a task set goes stale invisibly

The weekly sync job checks revisions, field counts and page counts. **It cannot
check that the set is still the right set.** If an agency retires a form or adds
one, the composed page is wrong and every number on it still verifies clean —
`drifts=0`, green run, wrong page.

So there are **two clocks, stated separately**, the same discipline the
expansion doc applies to the file versus the caption:

- the forms' `CHECKED_ON` — moved by the weekly job, means "these revisions are
  current";
- the task's own **`reviewedOn`** — moved only by a human, means "this set was
  last read against the agencies' guidance".

Both are printed. A task page with fresh forms and a year-old `reviewedOn` is
telling the reader something true. Collapsing them into one date would not be.

A third guard is cheap and worth having: a task may only reference slugs that
exist in the libraries, so deleting a form fails the build rather than
rendering a dead row.

---

## 5. ⚠ Route namespace

Tasks live at **`/forms/<task-slug>`** — short, keyword-bearing, and under the
hub that already parents the libraries. `/forms` stays the hub at sitemap 0.85;
tasks sit at 0.8 alongside the libraries.

A test must forbid a task slug from colliding with a form slug, with
`us-forms` / `india-forms`, or with any reserved segment. Two pages competing
for one URL is resolved silently by the router, and the one that loses is
invisible — there is no error anywhere.

Progressive disclosure on one URL, never `?page=`, per the standing list rule.

---

## 6. The data model

```ts
export type TaskForm = {
  slug: string;                 // must exist in US_FORMS / INDIA_FORMS
  library: 'us' | 'india';
  /** Why this form is in this set, in the agency's own terms. */
  role: string;
  /** Who fills it in. */
  filedBy: string;
  /** Where it goes. Often NOT the agency. */
  goesTo: string;
  /** Never 'required' — see §3. */
  applies: 'always' | 'usually' | 'sometimes';
  /** Mandatory when applies !== 'always'. */
  condition?: string;
};

export type FormTask = {
  slug: string;
  title: string;                // phrased as the reader would say it
  aka: string[];                // search phrasings, fed to the ⌘K matcher
  country: 'us' | 'india';
  audience: string;
  what: string;                 // one honest paragraph
  order: string;                // why the order is the order
  forms: TaskForm[];
  notCovered: string;           // §3, mandatory, above the fold
  gotcha: string;               // the mistake across the SET, not per form
  sources: { label: string; url: string }[];
  reviewedOn: string;           // §4, the human clock
};
```

---

## 7. The 13 tasks — all 30 US forms, no new ones

| Task | Forms | The set's own gotcha |
|---|---|---|
| Hire your first employee | I-9 · W-4 · SS-4 · 941 · 940 · W-2 | USCIS **rejects a superseded I-9 edition outright** — the one agency here where an old version is not merely frowned upon |
| Get paid as a contractor | W-9 · SS-4 · 1099-NEC · 1040 | The W-9 is how you avoid handing your SSN to every client — get an EIN and give that instead |
| Pay a contractor | W-9 · 1099-NEC · 1099-MISC · SS-8 | NEC and MISC are not interchangeable; rent and prizes are MISC |
| Employee or contractor? | SS-8 · W-4 · W-9 | Filing SS-8 tells the IRS you are unsure, and the answer binds both sides |
| Get a US taxpayer number | W-7 · SS-4 · SS-5 | Three different numbers for three different things; most wrong applications are the wrong form, not a wrong entry |
| Let someone handle the IRS for you | 2848 · 8821 | 8821 lets them **look**; 2848 lets them **act**. People file the one they did not mean |
| Change your address with the IRS | 8822 · 1040 | Filing a return with the new address does it too — the IRS says so |
| Fix a return you already filed | 1040-X · 4506-T | Get a transcript of what was *actually* filed before amending from memory |
| Set up an IRS payment plan | 9465 · 433-F · 433-A · 4506-T | **Page 1 of 9465 argues against itself** — under $50,000 the online application is cheaper |
| Sponsor a relative to immigrate | I-130 · I-864 · I-485 · I-765 | Edition dates; a superseded USCIS edition is returned |
| Apply for US citizenship | N-400 · SS-5 | The card does not update itself after a name change |
| Take family or medical leave | WH-380-E · WH-380-F · WH-381 | **WH-381 is the employer's notice to you** — not yours to fill |
| Claim VA disability compensation | 21-526EZ | — |

Every one of the 30 appears in at least one task. **A test asserts that**, which
turns "is the library reachable from the UI" from an opinion into a build gate.

India tasks (file a salary return · claim EPF · GST returns · PAN/Aadhaar) are a
second ship. India forms are mostly web filings, so a task page there is about
the PDF work *around* a filing — the shape holds, the copy does not transfer.

---

## 8. The packet — the Pro half (settles D3)

Pick a task, press **Fill this packet**, and:

1. one screen asks for the details that repeat across the set — legal name,
   address, SSN or EIN, employer name, employer EIN;
2. each form is fetched live from its agency, in order;
3. shared values are written into it **on your device**;
4. the set finishes through the existing workflow runner — merge, sign, flatten,
   compress — and comes back as one file or as separate files.

Gated on `isAtLeast(plan, 'pro')`, so a Business subscriber gets it
automatically. Ships `coming_soon` / owner-only until Pro launch, per the
standing rule.

### Decided, not asked: the shared details are never persisted

They live in memory for the duration of the packet. **"Entered once" means once
per packet, not once forever.**

A stored legal-name-plus-address-plus-SSN record in `localStorage` is readable
by any XSS on our origin and survives the session — we would be manufacturing
the exact artefact the product exists to avoid, on the pages that carry the most
sensitive data we touch. The saved signature is a different risk class: an image
the user chose to draw, with a one-click clear. If cross-visit persistence is
wanted later it belongs in the **E2E File Vault**, as its own decision with its
own design.

### ⚠ The packet's honest limit: USCIS forms are encrypted

Already recorded in `us-forms-library-scope.md` — most USCIS PDFs are encrypted,
`pdf-lib` reads **0** fields, and the filler degrades to the place-anywhere
overlay. So shared-field mapping ships for the **IRS forms first** (the group
where fields read reliably), and for the rest the packet still fetches the set in
order, into the overlay filler, without pre-filled values.

The first ship is therefore **"the set, in order, pre-filled where the fields
are readable, finished as one job"** — not "pre-fills everything", which is a
promise the encrypted forms break. The UI must say which forms it could
pre-fill, per form, rather than implying all of them.

---

## 9. Build order

**Ship 1 — the finder. Free, live, no gate.**

- `lib/form-tasks.ts` — the model plus the 13 tasks. The writing *is* the work.
- `/forms/<task>` page template; `/forms` hub gains "Start from what you are
  trying to do".
- Tasks into `/forms-api/index` and the ⌘K Forms section, through the existing
  `lib/form-search.ts` matcher.
- `sitemap.ts`, markdown twins (free, generated from the build).
- Tests: slug collision · every `slug` resolves in a library · all 30 forms
  reachable · no advice vocabulary · `notCovered` non-empty · `reviewedOn` a
  real past date · `condition` present whenever `applies !== 'always'`.

~10 h, mostly prose.

**Ship 2 — the packet. Pro, owner-gated.**

- shared-detail model; IRS field maps; `/forms/<task>/packet`.
- chains the existing runner for merge/sign/flatten.
- per-form "pre-filled / overlay only" honesty in the UI.

~12 h.

**Ship 3 — India tasks.** ~6 h.

---

## 10. Why this also feeds Phase 1

"Hire your first employee" has to say, in its `notCovered` block, that **the
state withholding certificate is not here yet**. That sentence, on a page with
hiring intent, is the strongest demand signal we could possibly have for
Phase 1 matrix 2 — and it is honest, which the alternative (quietly omitting it)
is not.

So Phase 3 does not replace Phase 1. It tells us which matrix to build first,
from behaviour rather than from a guess.

---

## 10b. ✅ Ship 1 is live (24 Nov 2026, `5a1e2a9`)

13 task pages at `/forms/<task>`, free and ungated. Sitemap 288 → 301 URLs,
301 markdown twins, 42 files / 422 tests. Verified from outside: all 13 routes
200 with the right `h1`, an unknown task 404s, 13 `Form checklists` rows in the
⌘K index, no horizontal overflow at 375px.

**Two deviations from this spec, both deliberate:**

1. **`sources` was dropped, not populated.** Writing agency URLs by hand would
   have meant publishing URLs that are *not* in the verified dataset, on pages
   whose entire argument is that every claim was read at source. Provenance is
   derived from the forms' own `authority` and `officialUrl` through
   `authoritiesFor()` instead, so there is nothing here for a human to get
   wrong.
2. **No "fill the whole set" button yet.** The packet is ship 2 and is
   Pro-gated. A live button for an unbuilt feature is worse than no button, so
   it arrives with the thing it opens.

**⚠ The guard that did not bite the first time.** The banned-vocabulary regex
was `\byou must\b`, so *"employers **who must** take on their first employee"*
walked straight through a test written to stop exactly that claim. Broadened to
the bare word in any person. **A vocabulary guard that only matches the second
person is not a guard** — the paraphrase is the likely failure, not the literal
phrase.

**⚠ Two copy defects that only reading the rendered page caught**, invisible in
the code and to all 422 tests: a two-authority list joined with a comma instead
of "and", and *"connected to Social Security Administration"* with the article
missing and "or" said twice. Both now go through one `listJoin()` helper, with
a test.

---

## 10c. ✅ Ship 2 is built AND LIVE (24 Nov 2026) — the Pro packet

**Deployed to production 24 Nov 2026**, prod HEAD `e23b9e8`. Verified from outside:
the 13 packet routes build and serve, the page is `noindex, follow` and absent from
the sitemap, the "Get all N in one go" CTA is on the task pages, the anonymous
visitor gets the waitlist wall, and all six blank forms still come back as real
PDFs through `/forms-api/file/<slug>` on prod.

`/forms/<task>/packet`. Fetches every form in a set, in the set's order, with
the details that repeat already in the boxes. Owner-only until Pro opens.

### The design decision that changed from §8

**Maps are keyed by (task, form), not by form.** §8 assumed one map per form.
That is wrong, and the W-4 shows why: inside *hire your first employee*, the
name and the social security number on a W-4 belong to **the person being
hired**. Pre-filling the reader's own number there is not a cosmetic bug, it is
a materially wrong federal filing. Only the employer block at the bottom of
that page is the reader's.

`filedBy` already records who puts the pen to each form, but it is prose
(*"Employee, then the employer"*), so it cannot carry a guarantee. Rather than
add a flag to 40 entries and rely on getting all 40 right, the lookup key does
the work: **a (task, form) pair nobody authored gets no pre-fill at all.** The
safe direction is the default, and the exact list of seven exceptions is pinned
in a test, so adding one is a deliberate act.

### What is mapped

| Task | Form | Boxes |
|---|---|---|
| get-paid-as-a-contractor | W-9 | 9 |
| get-paid-as-a-contractor | SS-4 | 6 |
| hire-your-first-employee | W-4 | 2 — *employer block only* |
| hire-your-first-employee | SS-4 | 6 |
| get-a-us-taxpayer-number | SS-4 | 6 |
| set-up-an-irs-payment-plan | 9465 | 5 |
| change-your-address-with-the-irs | 8822 | 2 |

36 boxes. Every other task still fetches its set in order, unfilled — which is
the §8 commitment, kept.

### ⚠ How the maps were authored, and why it had to be this way

IRS field names are opaque (`f1_01`, `f1_11`) and these PDFs carry **no `/TU`
tooltips**, so nothing in the file says what a box is for. A first attempt
derived labels from the position of nearby text runs; it was too ambiguous to
author from — a header above a box and a label beside it are indistinguishable.

So every entry was authored by **rendering the form with each box stamped with
its own id, and looking at it** (`scripts/probe-form-fields.mjs`). Then each box's
`maxLength` was read off the real file as a second, independent signal.

That second signal caught a real one. On the 8822 the field numbering suggested
`f1_2` was the reader's SSN; the rendering showed `f1_1`/`f1_2` are the
**decedent's** name and number, for the estate-tax case, and the reader's are
`f1_3`/`f1_4`. Two independent readings, agreeing, before an SSN is written.

### ⚠ Three places the packet refuses rather than guesses

1. **A box that moved.** Every entry pins the `maxLength` the real PDF must
   report. At fill time the map is compared against *the file the agency served
   a moment ago*, and any box that is missing or a different size is skipped
   and named on the page. A re-issued form that inserts one box renumbers every
   box below it; without this the packet would quietly write a taxpayer number
   onto the wrong line and nothing would look wrong.
2. **Two taxpayer numbers.** A W-9 takes an SSN **or** an EIN. If the reader
   gives both, neither is written — choosing between them is a tax judgement.
   The rest of the form still fills.
3. **An ambiguous box.** Form 8822 has two address boxes: 6a is where you used
   to live, 7 is where you live now. The packet writes **no address at all** on
   that form and says why. Pinned by a test, because it is exactly the kind of
   thing a later edit would "fix".

A box left blank because the reader typed nothing is not reported. A box left
blank because it *moved* is reported prominently — that distinction is the
difference between a packet that looks broken and one that explains itself.

### The live guard: `npm run verify:packet-maps`

Joined to the weekly `forms-sync` job as a third verifier. The other two check
a **claim** (a page states the revision the agency publishes). This one checks
an **action**: that `f1_11` on the W-9 is still the box the form prints
"Social security number" beside. It fetches each live PDF and proves three
things — every mapped box exists; it still reports the expected size; and a
write **round-trips** (set, save, re-open, read back) with **no field outside
the map changed**.

Verified failing before being trusted: two sabotaged entries (a changed length
and a renamed box) produced `drifts=2`.

**Two clocks again.** The robot can see that a form changed. It cannot see that
a box now *means* something else — that is a fact about ink beside a rectangle.
So each map also carries `verifiedOn`, which only a person moves, after looking
at a rendering. Printed on the page per form.

### Reuse, not reimplementation

- Blank forms come through the **existing** `/forms-api/file/<slug>` proxy — no
  new server route, no CORS, nothing added under `/api/` (nginx proxies that
  prefix to Express:4000 in production).
- Filling goes through the **existing** `exportFilledPdf()` in `lib/fill-pdf.ts`,
  so appearance generation, encryption handling and saving are the paths the
  form filler already uses rather than a second one that drifts.
- The forms stay **editable** after filling (`flatten: false`) — the reader has
  to finish them.

### Nothing is kept

The shared details live in one component's state. No storage, no request
carries them; the only call the packet makes is a GET for a blank public form.
Three tests enforce it: no storage API in the library, none in the runner, and
no POST / beacon / serialisation of the details anywhere.

### Tests

**480 passing, 43 files** (ship 1 left it at 422 / 42). 58 new, covering: map
shape and uniqueness; comb slices covering all nine digits exactly once, in
order, each exactly as wide as its box; the seven-pair allowlist; the W-4
personal-field ban; the 8822 address ban; every refusal path; the advice
vocabulary over the packet's own copy; noindex and sitemap absence; the
three no-storage guards; and the two presentation rules below.

The advice vocabulary list moved to `tests/unit/_advice-vocabulary.ts`, shared
by both suites — two copies of a safety rule is one copy that falls behind.

### ⚠ Five defects only the rendered page showed

None of these were visible in the code or to any test, and the first two were
wrong rather than merely ugly. This is the second ship running where reading
the actual page found what the suite could not.

1. **"Line Employers Only"** — the W-4's employer block is a section, not a
   numbered line, and the renderer prefixed everything with "Line". Now
   `lineLabel()`: a number gets the word, a name does not.
2. **A refusal printed five times.** The W-9's taxpayer number is five boxes,
   so "this form takes one number and you gave two" appeared once per box.
   `groupSkipped()` prints one line per (line, label, reason) — two lines.
3. **A filled number shown as fragments.** The same five boxes would have shown
   a reader "123", "45", "6789" as three rows. `groupWrites()` rejoins them
   into one row: *123456789, across 3 printed boxes*.
4. **"I-9 — Form I-9"** — `short` and `name` are near-duplicates. The heading is
   now the name, with the task's own `role` beneath it.
5. **The EIN box carried the SSN's placeholder**, and the "what this packet
   does not cover" notice opened mid-thought on "State and local forms."
   without its lead-in.

Also corrected: *"the 7 things this set asks for more than once"* was not true
of every field — the EIN appears once. It now reads "the 7 details these 4
forms draw on".

### Deviations from §8, recorded

1. **Keyed by (task, form)**, not by form — see above.
2. **No USCIS forms are pre-filled.** §8 anticipated this; the encryption is
   not the blocker (the proxy and `openPdfDoc` handle it), the absence of a
   verified field map is. They fetch in order, unfilled.
3. **The W-4 is in the set but only two boxes are mapped**, both the employer's.
4. **No changelog entry yet.** The feature is owner-only, and `lib/changelog.ts`
   holds back entries that point at a door the reader cannot open. Copy below.
5. **⚠ Step 4 of §8 is NOT built, on purpose — the owner's call to overturn.**
   §8 said the set "finishes through the existing workflow runner — merge,
   sign, flatten, compress — and comes back as one file". Having built the
   task pages, none of those four is right for a packet:
   - **Merge** is actively wrong. The whole insight of these pages is the
     column nobody else prints: *where each form goes*. A W-9 goes to the
     payer, an SS-4 to the IRS, an I-9 to nobody. Merging them produces one
     PDF that cannot be filed anywhere.
   - **Flatten** locks a form the reader has not finished. The packet
     deliberately leaves every form editable (`flatten: false`).
   - **Sign** is not wired as a step yet, and nothing here is ready to sign.
   - **Compress** saves nothing worth having on five small agency PDFs.

   So the set finishes as **separate files**: per-form download, download all
   as a zip, or hand one straight into the filler. `runWorkflow(files, steps)`
   is a clean API and wiring it later is an hour's work if this reasoning is
   wrong — the argument above is why it was not done, not that it could not be.

### 📋 Draft changelog entry — publish the day `WAITLIST_MODE` flips

> **Title:** The whole set of forms, filled once
>
> Hiring your first employee takes four federal forms. Getting paid as a
> contractor takes three. Nobody has ever enjoyed typing the same name, address
> and tax number into each of them in turn, and the copying is where the
> mistakes come from.
>
> Pro now fetches the whole set at once. You type the details that repeat once,
> and they land in every box we have read and confirmed on those forms. Each
> form still comes from the agency that publishes it, at the moment you ask for
> it, and the filling still happens on your own device — there is no account to
> save your tax number to, because we do not keep it.
>
> The part we are more pleased with is what it refuses to do. These forms carry
> no labels inside the file: a box is called `f1_11` and nothing else, so every
> box we fill was confirmed by rendering the form and looking at it. Agencies
> re-issue forms without telling anyone, and a form with one box inserted at the
> top renumbers everything below it. So the packet checks each box against the
> copy the agency served a second ago, and where anything has moved it leaves
> that box alone and says so on the page rather than writing your tax number
> onto the wrong line.
>
> It also stops where a form asks something only you can answer. Form W-9 takes
> either a social security number or an employer number, never both — give it
> both and it fills neither, because picking one is a tax question and we are a
> document tool. Form 8822 has two address boxes, one for where you used to live
> and one for where you live now, so it fills neither and tells you which is
> which. On the W-4 for a new hire, only the employer block at the bottom is
> yours; the rest belongs to the person you are hiring, and we leave it for them.

---

## 11. Open


- **F1** — India tasks in ship 1 or ship 3? *Recommend ship 3*: the US set is
  where the search volume and the fillable PDFs are, and India copy does not
  transfer.
- **F2** — does the packet count as a Pro *flagship* on `/pricing`, beside
  batch / redaction certificate / workflows / vault? *Recommend yes*, once
  ship 2 exists — it is more defensible than three of the four.
