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

| | Them | Us |
|---|---|---|
| pdfFiller / US Legal Forms / FormSwift | Huge libraries, **hosted copies** that go stale, sign-up wall before download, your filled form sits on their server | Live fetch from the agency every time, nothing hosted, nothing uploaded |
| The agency's own site | Always current, authoritative | We can't beat that, and shouldn't try — we link to it on every page |
| pdf.net | 225-page forms library, badges "Official IRS form" while linking irs.gov zero times | We print the revision we measured, the date we measured it, and the agency link |

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

Call it ~3 matrices × ~45 cells ≈ **135 forms**. Verifiable with the machinery we
already have. SEO shape is a good one: a strong hub plus thin spokes, rather than
two thousand orphan pages.

**Start with matrix 1 only.** ~45 forms, closes the gap the owner found, and proves
the matrix shape before committing to the rest.

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

## 5. Keeping it in sync — the engineering answer

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
