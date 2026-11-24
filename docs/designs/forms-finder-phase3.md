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

## 11. Open

- **F1** — India tasks in ship 1 or ship 3? *Recommend ship 3*: the US set is
  where the search volume and the fillable PDFs are, and India copy does not
  transfer.
- **F2** — does the packet count as a Pro *flagship* on `/pricing`, beside
  batch / redaction certificate / workflows / vault? *Recommend yes*, once
  ship 2 exists — it is more defensible than three of the four.
