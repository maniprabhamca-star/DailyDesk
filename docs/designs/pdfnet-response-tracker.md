# pdf.net response — work tracker

**Started:** 2026-08-29 · Live status. Update the Status column as each item moves.

Background: [competitor-pdfnet-gap-analysis.md](competitor-pdfnet-gap-analysis.md)
· [content-seo-strategy.md](content-seo-strategy.md)

Status values: `todo` · `in progress` · `shipped` · `blocked` · `parked`

---

## Board

| # | Item | New pages | Status | Shipped |
|---|---|---|---|---|
| 0 | `llms.txt` + 176 Markdown twins | 0 | **shipped** | 2026-08-29 |
| 1 | Centralise file-accept lists (+`.ppsx`, HEIC everywhere) | 0 | **shipped** | 2026-08-29 |
| 1b | HEIC in the 5 PDF-embed tools (sign/watermark/annotate/edit/signature) | 0 | **shipped** | 2026-08-29 |
| 2 | Stripe ToS consent checkbox | 0 | **shipped** | 2026-08-29 · self-arming when the URL is set |
| 3 | Passport differentiation + verify 21 specs | 0 | **in progress** | Tier 1 2026-08-29 · 2026-11-19/21: **25 countries read at source, 12 spec errors fixed** (3 wrong SIZE), 12 photograph on site. **Only Qatar + UAE left.** Also surfaced an engine bug (file-size cap) |
| 4 | Bank statement guides 11 → 40 | 28 | **shipped** | 2026-08-29 · 39 pages |
| 5 | Competitor alternatives 4 → 10 | 5 | **shipped** | 2026-08-29 (9 of 10; Canva pending a source) |
| 6 | Sector pages 4 → 12 | 5 | **shipped** | **13 of 12** · 2026-11-23: +immigration, journalism, insurance, construction · government renamed to public-sector |
| 7 | Indian statutory forms library | 33 | **shipped** | 32 forms + index · 2026-08-29 |
| 8 | US forms library (privacy wedge) | ~30–60 | **done** | Scoped 2026-11-23 — `us-forms-library-scope.md`. **D1 done** (the encryption blocker that broke 10 tools). **All 30 forms shipped** across five groups and five agencies, every revision/edition/field/page count read off the file at source (`npm run verify:us-forms`: forms=30 drifts=0 unchecked=0). One-click fetch straight into Fill PDF form; searchable in ⌘K. **Weekly sync job running** — reads all 30 at source every Monday and emails on drift (proven end to end). DS-11/DS-82 stay out (Cloudflare bot check). Next: `forms-library-expansion.md` |
| 9 | "What comes next" dock | 0 | **shipped** | 2026-08-29 |
| 10 | AI document generator / invoice builder | 0 | **parked** | commodity — see gap analysis |
| 11 | Multi-document AI chat | 0 | **blocked** — File Vault | |
| 12 | MCP server | 1 | **shipped** | 2026-08-29 · 9 tools, server-side only |

### Owner actions (not code — only you can do these)

| Item | Where | Status |
|---|---|---|
| Unblock AI crawlers | Cloudflare → diemdesk.com → Security → Settings → Bots → **AI Scrapers and Crawlers = Off**; content signals `ai-train=yes`, `ai-input=yes` | **open** |
| Terms of Service URL for the checkout consent box | Stripe Dashboard → Settings → Business → Public details → Terms of service URL = `https://diemdesk.com/terms` | **open** — no longer BLOCKING: the code ships the consent box and drops it if Stripe refuses, so setting the URL arms it with no deploy |
| Admin portal bind | commit `"start": "next start -H 127.0.0.1 -p 3100"` to `DailyDesk-Admin-Portal` | **open** |

---

## 1 — Centralise the file-accept lists

**Problem.** Every tool hand-writes its own `accept=` string. That is a bug
class, not a bug: `.ppsx` is missing from the presentation converter and
`compress-image` takes only `jpeg,png,webp` despite us shipping libheif — so a
HEIC photo, the single most common mobile input, is refused by a tool that can
decode it. Two independent regressions from the same cause.

**Fix.** One shared module of named accept groups, imported everywhere, with a
test that fails if a tool hand-writes an accept string again. Same rule already
used for tool counts: derived, never typed.

**Acceptance:** `.ppsx` converts · HEIC accepted by every image tool · no
literal `accept="` string outside the shared module · guard test.

### Shipped 2026-08-29 — and it was bigger than the accept lists

There were **five separate image decoders**, four of which called
`createImageBitmap`, and none of those can open a HEIC. So Compress, Convert,
Crop, Resize, Remove background, the passport photo maker, the EXIF cleaner and
the QR reader all refused iPhone photos. One of them told the user to go and
convert the photo with our own HEIC to JPG tool first.

On Android it was worse than a refusal: the phone labels a HEIF as `image/jpeg`,
so the file passed the picker and then failed at decode.

- `lib/accept.ts` — named accept groups, with the rule written down: a narrow
  image accept is a bug, not a safety feature. `accept` is a picker convenience;
  the real check is the byte sniff, because the name and the type both lie.
- `decodeToBitmap()` exported from `lib/image-for-pdf.ts`. It returns a real
  ImageBitmap, so every caller changed one import and nothing else — libheif
  returns ImageData and `createImageBitmap` accepts ImageData, so there is no
  re-encode in the middle.
- Adopted by `image-convert`, `image-compress-core`, `qr-decode` and the four
  phone-photo tools. Compress Image's "before" pane needed changing too: it
  pointed an `<img>` at the raw picked file, which renders nothing for a HEIC.
- `.pps`/`.ppsx` added to the picker, the frontend extension gate AND the backend
  `OFFICE_RE` — widening only the picker lets a file be chosen and then rejected.
- `tests/unit/file-accepts.test.ts` (6 assertions) now fails the build on a
  narrow image accept, on a user-file `createImageBitmap` outside the shared
  decoder, and if `.ppsx` drops out of either gate.

**Left open as 1b.** The five tools that embed an image INTO a PDF (sign,
watermark, annotate, edit, signature-maker) load through `new Image()` and a data
URL, which fails on HEIC the same way. They are listed by name in the test's
`KNOWN_NARROW`, with a second assertion that the list SHRINKS rather than
becoming permanent furniture. Widening their pickers before fixing the loader
would turn "greyed out" into "picked, then error", which is worse.

---

## 1b — HEIC in the five PDF-embed tools · shipped 2026-08-29

These five were the ones where the refusal was most visible: photographing a
signature on paper and uploading it is the obvious way to sign a PDF, and from an
iPhone it did not work. The picker greyed the photo out with nothing on screen
explaining why.

**They are a different problem from item 1.** The rest of the image tools only
need pixels, so `decodeToBitmap()` was enough. These hand the image to **pdf-lib**
(`embedPng`/`embedJpg`) or composite it onto a page canvas — both of which only
speak JPEG and PNG. A bitmap does not help; they need *bytes* in one of two
formats.

**`pickedImageForPdf(file)` in `lib/image-for-pdf.ts`** normalises once, at pick
time, so every step afterwards — preview `<img>`, canvas draw, pdf-lib embed,
saved editor session — is guaranteed to work. It returns `{ bytes, isPng,
aspect }`, routed by magic bytes:

| Sniffed | Path | Why |
|---|---|---|
| JPEG / PNG | passed through byte-for-byte | no re-encode, no quality loss |
| HEIC / TIFF / BMP | `rasterize()` → JPEG | photos; reuses the shipped libheif path and the phone canvas cap |
| WebP / GIF / AVIF / unknown | decode → PNG | **may carry transparency** — a logo or a signature on a clear background |

That last row is the one worth keeping: the PNG branch deliberately does **not**
white-fill the canvas the way `rasterize()` does. Flattening a transparent
signature onto a white box defeats the reason people export one as a PNG.

- All five pickers now use `ACCEPT.image`; `KNOWN_NARROW` is **empty**.
- Annotate and Edit keep placed images as data URLs (via `pdfImageDataUrl`) —
  they must survive in a saved session, where an object URL dies with the tab.
  Only the loader changed; Edit's core logic was not touched.
- `components/tools/signature-pad.tsx` (Saved Workflows) went through too. It
  stores a canvas PNG in `localStorage`, not pdf-lib bytes, so it uses
  `decodeToBitmap` — capped at 1600px, because a full 12MP photo as a PNG data
  URL would blow the ~5MB quota.
- Failures now report through `describeImageFailure`, naming what the file
  turned out to be rather than refusing on the filename.
- `tests/unit/file-accepts.test.ts` — 7 assertions. `KNOWN_NARROW` emptied, and a
  new one requires all five to route through `pickedImageForPdf` (and the
  signature pad through `decodeToBitmap`), so the hole cannot reopen. **167 unit
  tests pass.**

**Verified in the browser**, not just by test: a PNG named `signature.heic` with
`type: image/heic` is accepted where the old name check refused it; a transparent
WebP comes back as a PNG with the corner pixel still at alpha 0 and its 200×80
dimensions intact; Sign exports a valid PDF whose image object is `FlateDecode`
(the PNG path, transparency kept, not flattened to JPEG); Watermark accepts a
mislabelled logo and stamps it.

---

## 2 — Stripe ToS consent checkbox

We use Stripe **hosted** Checkout (`mode: 'subscription'`), so the recurring
terms are already disclosed automatically. What is missing is an explicit
acceptance record: `consent_collection: { terms_of_service: 'required' }`.

Blocked on the owner setting the ToS URL in the Stripe dashboard (see above) —
Stripe rejects the parameter without it.

**Deliberately NOT copying** pdf.net's offer: $0.95 for 14 days auto-renewing at
$49.88/month. Their consent wall is loud because that model attracts chargebacks.
Ours is flat $5.98.

---

## 3 — Passport differentiation + verify 21

The blocker for every later content item, and it adds **zero pages**.

- 21 of 46 specs are unverified (`VERIFIED_SPECS` lists 25).
- 5 countries still generated by `schengen()`, which encodes the **visa**
  standard and has been wrong 6 times out of 10.
- The 35×45 cluster deduplicates in Search Console. Japan vs Nepal 80.3% similar.

Scope and method already written up in
[passport-photo-editorial-scope.md](passport-photo-editorial-scope.md): five
editorial fields per country, each sourced from the issuing authority with the
URL and read-date recorded in `docs/passport-spec-sources.md`. Aggregator sites
are acceptable for finding a rule and unacceptable as the source of one.

### Americas tranche — 2026-11-19

Brazil, Mexico, Argentina, Chile, Colombia, each read at the issuing authority.
**Four of the five do not ask for a photograph at all** — they photograph you at
the appointment — and our pages said nothing about it.

- **Brazil** · 5×7 cm white confirmed, but **only for under-fives**; everyone else
  is captured at the Polícia Federal counter. Verified + editorial.
- **Argentina** · 4×4 cm white confirmed **in law** (Decreto 749/2019 art. 30).
  Verified + editorial. The decree says “medio busto” rather than a chin-to-crown
  band, so a caveat went on the head figure instead of a guessed conversion.
- **Mexico** · the SRE publishes **no size**, only rules about you: no glasses,
  head uncovered. Left unverified, row relabelled generic.
- **Chile** · the Registro Civil's list has **one item**, a valid cédula. Left
  unverified, row relabelled generic.
- **Colombia** · **blocked.** Resolución 10829 de 2024 reportedly says 4×5 cm,
  not the 35×45 mm we ship — so this one may be actively wrong. The Cancillería
  sits behind a Cloudflare bot check we do not bypass. Row left alone and
  flagged in code; it needs a human to open the page.

Guard countdown **24 → 19**. Full detail and URLs in
[passport-spec-sources.md](../passport-spec-sources.md).

### Asia tranche, part 1 — 2026-11-19

**Two live spec errors found and fixed.**

- **Singapore** · ⚠ ICA publishes the face as **25–35 mm** chin to crown; we
  shipped 0.66–0.80, whose ceiling sat **above ICA's maximum**. Fixed, plus the
  white-hair/light-grey background rule and an 8 MB upload cap. Verified.
- **Malaysia** · ⚠ published head height is **30–35 mm on 50 mm**; we shipped
  0.66–0.80. And the background is **white, not blue** — blue is an alternative
  for one visa category only. Fixed. Verified.
- **Philippines** · the DFA captures your photo and says in its FAQ not to bring
  one. Relabelled generic.
- **South Korea** · attempted, **left alone** — no domestic passport spec page
  found on MOFA, only embassy and visa pages.

### Asia pt.2 + Oceania — 2026-11-19

- **New Zealand** · ⚠ we said **White**; the DIA asks for a plain light colour
  and its form says **not white**. We were steering people at the one excluded
  colour. Fixed; its digital spec is an aspect ratio and pixel bounds, not mm.
  Verified.
- **Indonesia** · photographed at the office. Relabelled generic. Brings the
  most missable rule yet: **no contact lenses**, even natural-coloured.

**Background is now the dominant failure mode** — wrong more often than size.
Malaysia, New Zealand, Spain, Poland, Australia, the UK. One word on a page that
nobody re-checks, and every aggregator copies the others.

Guard countdown **24 → 4**.

### Tranche 6 — 2026-11-21: the blocked list, mostly unblocked

The owner opened Pakistan in their own browser; the rest came out of ours.

- **Bangladesh** — wrong on both counts, and the strongest “no photo” finding in
  the audit. The e-passport form takes **no photograph at all** (instruction 3),
  and the only photo asked for anywhere is instruction 21: under-6s, **3R lab
  print on GREY**. We shipped 45×55 mm on white.
- **Nepal** — `photographedOnSite`. Step 3 of the appointment is live enrolment:
  taking the photograph and the biometrics. No spec published, because none is
  received.
- **Pakistan** — size confirmed (35×45 white), plus a **20 KB** file ceiling,
  the tightest of any country on the list.
- **India e-Visa** — re-read and confirmed; background corrected to “plain light
  colour **or** white”, which is more forgiving than we were showing.
- **Saudi Arabia** — publishes **no photo rule at all**; the tourist eVisa asks
  for no photograph. Our 2×2 in is the Enjaz convention, and the page now says
  so instead of presenting it as a rule.

**A spec audit found an engine bug.** Pakistan's 20 KB is below what the encoder
could reach: it floored at JPEG quality 40 and, when that was still over the
cap, returned the oversized file while the UI said “meets Pakistan”. Fixed, and
the result line now warns rather than asserting. This is the argument for
reading specs at source — the data work shook out a correctness bug in the tool.

**Running tally for item 3:** 25 countries read at source, **12 spec errors
fixed** (three the wrong photo SIZE), **12 countries found not to accept a
supplied photo**. Only **Qatar** and **UAE** remain, and both are genuinely
blocked rather than unresearched.

### Tranches 4 and 5 — 2026-11-20

Nine more countries read at source. Four more errors:

- **Kenya** — wrong size *and* wrong head band. We shipped a 2×2 inch square;
  the Directorate publishes **5.5×5.5 cm, face 70–80%**. Four millimetres out,
  which is the worst kind of wrong: it looks right in the hand. Relabelled
  **Kenya visa**, because the guideline the Directorate publishes is the visa one.
- **South Africa** — head band ceiling above the maximum (now 29–34 mm), and the
  background is light grey or cream, **not white**.
- **South Korea** — head band fixed to 32–36 mm, plus the 413×531 px online file.
- **Sri Lanka** — not a measurement error. **A printed photograph has not been
  accepted since 2015.** The photo must come from a Department-authorised studio
  that uploads it directly. Nothing you print is usable for the passport.

**Türkiye** needed no size change but is the single best piece of copy we found:
NVİ tells you to remind the photographer *not* to cut the photo to 35×45 mm,
because 50×60 is the Turkish size and the wrong one gets the card cancelled at
quality control. **Thailand** and **Nigeria** joined the photograph-on-site and
hybrid lists. **UAE** stays unresolved — the ICP's own documents disagree with
each other on the size.

**Running tally for item 3:** 20 countries read at source, **10 spec errors
fixed** (two of them the wrong photo SIZE), 10 countries found not to accept a
supplied photo at all. Seven countries remain and every one of them needs a page
opened in a human browser, not more searching.

### Colombia — unblocked by the owner, 2026-11-20

⚠ **It was wrong.** 35×45 mm shipped; Resolución 10829 de 2024 says **4×5 cm
(40×50 mm)**. Wrong SIZE — the Greece class of error, and the second one in
this audit.

The Cancillería blocks automated readers, so this row was flagged and left
alone on 19 Nov. The **owner opened it in their own browser** on 20 Nov and sent
the text. The fallback worked, and it mattered: the aggregator consensus
*agreed with the wrong figure we already had*, so no amount of searching would
have caught it.

**Process change:** when a spec is flagged possibly-wrong and the source is
unreadable, ask the owner **immediately**, not at the end of the tranche. We
shipped a wrong size for an extra day.

---

## 4 — Bank statement guides 11 → 40

Today: SBI, HDFC, ICICI, Axis, Kotak, PNB, Bank of Baroda, Canara, Union Bank,
IDFC First, Yes Bank. Every page funnels into the flagship paid tool.

To add — banks: IndusInd, Federal, RBL, Bandhan, AU Small Finance, IDBI, Central
Bank, Indian Bank, UCO, South Indian, Karnataka, CSB, DCB, Standard Chartered
India, HSBC India, Citi India. Payments/neobank: Paytm Payments Bank, Airtel
Payments Bank, Fi, Jupiter, slice. Cards (separate query, separate parsing
problem): Amex, HDFC card, SBI Card, ICICI card, Axis card. Adjacent: Razorpay
settlements, PhonePe/GPay history, Zerodha ledger.

Each page needs the portal-specific download path and the password format —
those are the parts nobody else writes and the ones people search for.

---

## 5–8 — Content families

See [content-seo-strategy.md](content-seo-strategy.md) §4–5 for the full lists
and reasoning. Item 7 (India) precedes item 8 (US) because India is an open
field and joins the flagship; the US entry is on the privacy wedge, not coverage.

---

## 9 — "What comes next" dock

**Not** a grid of 8 tiles. Their grid works because they have 35 tools; with 114
it hides 106, and it gets worse with every tool we add.

Instead: after a tool produces a file, offer the tools that usually follow it, on
that file, with no re-upload — plus "save this as a Workflow" so the second time
is one drop. Builds on Saved Workflows and the existing no-re-upload chain.

---

## 10 — AI document generator

Both halves already exist: `ai.js` has eight Claude endpoints with cost caps, and
`markdown-to-pdf` renders. Prompt → Markdown → existing renderer.

The prompt-driven version is a commodity — Claude already writes an invoice. The
version worth shipping is **template-driven**: a real invoice builder with saved
clients and line items, where AI fills gaps rather than inventing layout.

---

## 12 — MCP server

The objection is that MCP has no browser, so every tool would need a server
rewrite. **We already run headless Chrome for Webpage → PDF** — the same WASM
tools can execute there. One engine, no divergence.

Honest caveat: a file sent through MCP does reach our server, so MCP tools carry
the `server` badge, not `device`. Say it plainly rather than blurring the claim.

---

## 3 — Passport differentiation · in progress

**Where it stands.** The editorial mechanism was already built and 15 of 50
countries had entries. This pass took the Tier 1 traffic countries, which had
none, and did them from the issuing authority's own page:

| Country | Source read | Outcome |
|---|---|---|
| UK | GOV.UK photo requirements + digital photos | Editorial written. Head band corrected to the published 29–34 mm; background corrected from "Light grey" to **"Cream or light grey"**. |
| Canada | IRCC passport photo requirements | Editorial written, incl. the separate online-renewal digital spec (3:2, chin-to-crown 45–50%). Spec confirmed correct. |
| Australia | Australian Passport Office | Editorial written. Head band corrected to the published 32–36 mm; background corrected from off-white to **white** — off-white is not one of the two options APO states. |
| Sweden, India (passport) | Polismyndigheten; Passport Seva FAQ | Existing entries were below the 150-word bar. Both expanded with sourced detail and re-checked. |

**Blocked, and honestly so.** `travel.state.gov` (US passport and US visa)
serves a Cloudflare bot interstitial, and Japan's specification is a 10.8 MB PDF
that is not retrievable outside a browser session and did not yield its text.
Neither has editorial, so neither page asserts anything unsourced — both still
show the "double-check your portal" banner. They need a manual read.

**A guard test now exists.** `tests/unit/passport-editorial.test.ts` fails the
build if an entry lacks a source URL or a checked date, if it cites one of the
known aggregator domains instead of the authority, if it falls under 150 words,
or if a new country is added into a shared-spec cluster without editorial to
separate it. The last assertion carries a countdown of pages still to write; it
is allowed to fall and not to rise.

**Two findings that changed the copy, not just the data.** Canada and Australia
both refuse edited photographs, and Canada counts cropping and background
replacement as editing. Saying nothing would have sold people a rejected
application, so both pages now state what the tool should and should not be used
for there. Australia separately warns against online photo services as an
identity-fraud risk — a fair warning about anything that uploads a face to a
server, and the page answers it directly rather than omitting it.

---

## 5 — Competitor alternative pages · shipped 2026-08-29

Four became nine. New: **PDF24, Foxit, Soda PDF, pdfFiller, pdf.net** — all on
the existing `AlternativePage` shell, all added to `sitemap.ts`.

**Sourcing.** Every competitor claim was read from the vendor's own page on
2026-08-29, and each page links to the page it was read from:

| Page | Read | Load-bearing facts taken from it |
|---|---|---|
| PDF24 | tools.pdf24.org | "You can use all PDF24 tools free of charge and without any restrictions… via some advertising"; files encrypted in transit and "completely removed from our servers after a short time"; PDF24 Creator is the Windows-only way to keep files local |
| Foxit | foxit.com/pdf-editor | From $10.99/mo; PDF Editor+ $159.99/yr per user; perpetual $209.99; 14-day trial, no card |
| Soda PDF | sodapdf.com/pricing | Pro / Team / Business; Windows desktop **and** browser; cloud storage bundled. Prices sit behind a "see prices" step, so the page links rather than quotes |
| pdfFiller | pdffiller.com | Owned by airSlate; cloud platform; account required; 30-day free trial |
| pdf.net | our own scan, [gap analysis](competitor-pdfnet-gap-analysis.md) | ~35 tools; all server-side; 225 forms pages; 7 languages |

**Canva was dropped from this batch, deliberately.** Its PDF editor page returns
403 to every automated read, and the honest options were to guess at its
behaviour or leave it out. Left out. It is the tenth page whenever someone can
open that page and note what it says.

**Where a price could not be sourced, the page does not invent one.** Soda PDF's
row reads "See their pricing page" and the FAQ explains why in a sentence. That
is better than a number that silently goes stale and makes every other figure on
the site less trustworthy.

**Each page names something the competitor does better**, because a comparison
page that finds no merit in the alternative reads as marketing and converts like
it. Foxit's maturity, pdfFiller's team routing and audit trails, pdf.net's forms
library and seven languages, PDF24's genuine no-limits generosity — all stated.

---

## 6 — Sector pages · SHIPPED (4 → 13)

New: **`/for/hr`** and **`/for/tax-practitioners`**. Both sit on the existing
`SECTORS` data file, so `/sitemap.xml` picked them up without an edit.

The `duty` field is what makes these pages worth anything — it names the rule
the reader is actually bound by instead of gesturing at "compliance". Both new
citations were read from source on 2026-08-29:

| Page | Cited | Read from |
|---|---|---|
| HR & recruitment | GDPR Art. 5(1)(f) integrity and confidentiality, Art. 5(2) accountability, Art. 9(1) special categories | gdpr-info.eu, quoting the official text |
| Tax practitioners | IRS Publication 4557 — "Protecting taxpayer data is the law" — and the FTC Safeguards Rule obligation to create and enact a written security plan | The publication itself (irs.gov/pub/irs-pdf/p4557.pdf), text extracted with pdf.js |

The HR page exists because HR inboxes concentrate exactly the categories
Article 9 prohibits by default — health, beliefs, trade union membership,
ethnicity — and no competitor whose product uploads the file can make the
argument this page makes.

**Why only two, and not the eight the plan named.** The remaining six —
banking/NBFC, insurance, government, architecture/engineering, journalism,
non-profits — each need a *named, verified* rule to be worth publishing, and
those are the ones where a plausible-sounding citation is worst: insurance is
state-regulated in the US rather than FTC-regulated, government varies by
agency, and journalism's source protection is not a data-security regime at all.
Writing them from memory would put a confident legal citation on a page aimed at
compliance-minded readers, which is the one audience that will check. They are
worth doing properly, one verified regulation at a time.

---

## 2 — Stripe ToS consent · shipped 2026-08-29

**The trap.** `consent_collection: { terms_of_service: 'required' }` is a single
line, and adding it plainly would have broken every checkout on the site the
moment it deployed. Stripe **rejects the parameter outright** unless a Terms of
service URL is configured on the account, and ours is not set. That is the exact
failure mode the checkout-reliability rule exists to prevent: a customer who was
ready to pay, meeting a 500 caused by our configuration.

**What shipped instead.** The parameter is applied as a strippable layer. If
Stripe refuses it, the route retries without it and the customer pays normally —
we lose the acceptance record, never the sale. The consequence worth noting:
**the owner action is no longer blocking.** The day the ToS URL is set in the
dashboard, the checkbox starts appearing with no deploy and no code change.

**The record is persisted, not just collected.** Stripe keeps consent on the
session, which is no help at 2am during a dispute, so the webhook mirrors it to
`users.tos_accepted_at` / `tos_accepted_session`. That write sits **after** the
plan upgrade and in its own try/catch — a missing column on a database that has
not run the latest `schema.sql` must never be why someone paid and stayed on
free. Absent consent is a footnote; a failed upgrade is an incident.

**`npm run test:checkout`** (17 assertions, no Stripe account, no network, no
database) proves every configuration failure still ends in a checkout URL: no
ToS URL, no ToS URL + dead coupon, no ToS URL + stale customer id, and three
different wordings of Stripe's rejection, because they have reworded it before.
It also asserts the two things a careless fallback would get wrong — a genuine
error is still raised rather than swallowed, and a coupon failure alone does
**not** drop the consent box.

**Not copied:** pdf.net's $0.95-for-14-days auto-renewing at $49.88/month. Their
consent wall is loud because that model earns chargebacks. Ours is flat $5.98.

---

## 4 — Bank statement guides · shipped 2026-08-29 (11 → 39)

The straightest line from a content page to the paid tool, so this got the same
treatment as the first eleven: per-bank download path, per-bank password
guidance, per-bank layout quirk. Nothing templated, because a templated set of
39 is a duplicate-content report waiting to happen — which is exactly what the
passport family taught us.

**Added:** Bank of India · IndusInd · Federal · RBL · Bandhan · AU Small Finance
· IDBI · Central Bank · Indian Bank · UCO · South Indian · Karnataka · CSB · DCB
· IOB · Punjab & Sind · Standard Chartered · HSBC India · Fi · Jupiter ·
HDFC card · SBI Card · ICICI card · Axis card · Amex · Razorpay settlements ·
Zerodha ledger · PhonePe history.

**Two were deliberately NOT written**, and the guard test enforces it:

| Left out | Why |
|---|---|
| Paytm Payments Bank | The RBI **cancelled its licence on 2026-04-24** and it is winding up. A page explaining how to log in and download a statement would be actively wrong. |
| Citi India | The consumer business moved to **Axis Bank** and customers were migrated during 2024. The query belongs on the Axis page, not its own. |

Both were on the original list in [content-seo-strategy.md](content-seo-strategy.md).
Checking their status before writing was the difference between a useful page and
a page that damages trust at the exact moment someone is deciding whether to pay us.

**The credit-card pages say something the bank pages cannot.** Our whole accuracy
claim rests on reconciling every row against the running balance — and a credit
card statement has no running balance. Rather than quietly dropping the claim,
those five pages state what is actually checked instead: the transactions against
the opening balance, the payments and the closing total due. Same for the three
non-bank pages, where a Razorpay settlement row is a net batch and a Zerodha
ledger moves for reasons a bank statement never does.

**`tests/unit/bank-pages.test.ts`** (9 checks) enforces unique slugs, url-safe
slugs, the 60-char title and 165-char description budgets, at least three real
download steps, a **unique quirk and password paragraph per bank** — two banks
sharing either means one page is filler — that password copy always hedges rather
than stating a format as fact, that every page says the unlocking happens on the
reader's own device, and that the two retired institutions never reappear.

Two titles were over budget and the test caught both: *Indian Overseas Bank* and
*Razorpay settlements* were shortened to IOB and Razorpay.

Site is now **211 indexable URLs**, up from 183.

---

## 6 continued · 9 of 12, and the orphan-page bug that came with it

**Three more sectors**, each on a citation read from source on 2026-08-29:

| Page | Cited | Read from |
|---|---|---|
| `/for/finance` | FTC Safeguards Rule, 16 CFR 314 — the written information security program, and §314.2(h)'s thirteen worked examples (mortgage lenders and brokers, account servicers, collection agencies, credit counselors, tax preparers, non-SEC investment advisers) | ftc.gov business guidance |
| `/for/government` | FOIA and **Exemption 6** — "information that, if disclosed, would invade another individual's personal privacy" | foia.gov |
| `/for/real-estate` | FBI IC3 2024 Annual Report — record **$16.6bn** total losses, **$2,770,151,146** business email compromise, **$173,586,820** real estate, and the Recovery Asset Team freezing funds in about two thirds of 3,020 kill-chain cases | the report PDF, text extracted with pdf.js |

**The bug the owner caught: the pages were orphans.** Nine `*-alternative` pages
existed while `/compare` listed a hand-typed four, and **all** the sector pages —
including the four live for weeks — were linked from nowhere at all. Nothing was
broken, which is why nothing caught it: the pages rendered perfectly and simply
could not be found. A sitemap tells Google a page exists; an internal link is
what says it matters, and it is the only way a reader arrives.

Both lists are now derived: `lib/alternatives.ts` feeds `/compare`, and the
footer's "Built for" column maps over `SECTORS`. Adding a page adds its link.

**`tests/unit/internal-links.test.ts`** fails the build if an `app/*-alternative`
route is missing from `ALTERNATIVES`, if either list is hard-coded again, if a
sector job or CTA points at a route that does not exist, or if a toolkit names a
tool the catalogue does not have. The last two caught a real defect immediately:
three sector pages linked `/share-safe-pdf` and the route is
`/share-safe-pdf-check` — a wrong href in data compiles, renders, and 404s only
when somebody clicks it.

**Still to write (3):** insurance, journalism, non-profits. Insurance needs the
NAIC Insurance Data Security Model Law (#668) — its existence and state-adoption
map are confirmed on content.naic.org, but the requirement wording is in the
model law document and was not retrieved, so it is not being written from memory.

---

## 7 — Indian statutory forms · first tranche shipped 2026-08-29

**21 form pages + an index**, at `/india-forms/<slug>`. Income tax (Form 16, 16A,
26AS, AIS, ITR-1 to 4, 15G, 15H, 10E, 12BB), PAN (49A, 49AA), GST (GSTR-1, 3B, 9)
and EPF (Forms 19, 10C, 31, 13). Site: **214 → 236 URLs**.

### Two rules this family runs on, both enforced by tests

**1. We never host the form.** Government forms are revised without notice, and a
stale copy served from our domain is worse than no copy — it looks current, so
someone files last year's version and finds out months later. Every page links to
the issuing authority, and the test rejects any `officialUrl` that is not a
`.gov.in`/`.nic.in` page, or that points straight at a PDF.

**2. No page states a deadline as fact.** These dates move every year and are
extended more often than not. The test requires hedging language in every `when`
field and fails on any concrete calendar date. It caught six fields on the first
run and they were rewritten rather than the rule being loosened.

### The framing that makes it honest

**Most of these are filed online now.** ITRs are e-filed, EPF claims go through
the UAN portal, GST returns through the GST portal. A page implying you download
a PDF and fill it in would be wrong about the main thing it describes — which is
the trap pdf.net's US forms library does not have, because those genuinely are
fillable PDFs.

So these pages do not pretend to be the filing. They cover the document work
**around** it, which is the part nobody helps with: two Form 16s to combine, a
26AS to reconcile, investment proofs to squeeze under a payroll portal's upload
cap, a statement to turn into rows. Every page says plainly that we do not file
anything and are not affiliated with any department.

### Why the gotcha field is the whole product

It is the sentence that makes a page worth linking to, and the test enforces one
per form with no duplicates. Examples: two employers in one year means the second
knows nothing about the first, so the exemption is applied twice; taking the EPF
withdrawal benefit ends the service a scheme certificate would have preserved;
claiming arrears relief without filing 10E first gets the relief reversed.

### Remaining

~20–40 more: Aadhaar enrolment and correction, the company forms (SPICe+, DIR-3
KYC, AOC-4, MGT-7), GST REG-01, banking KYC and FATCA/CRS declarations, and
nomination forms. The template and the guard tests are done, so the rest is
writing.

**Linked from the footer's Product column on day one** — not left an orphan, per
the lesson two items earlier.

### Tranche 2 — 2026-11-23: the last four, 9 → 13 (target was 12)

Every duty read at source, as the rule for this item requires. What each page
cites, and the scoping that had to be got right:

| Sector | Duty, read at source | The scoping that mattered |
|---|---|---|
| **Immigration advisers** | [8 CFR § 208.6](https://www.ecfr.gov/current/title-8/chapter-I/subchapter-B/part-208/subpart-A/section-208.6) — “Disclosure to third parties”: asylum/refugee/CAT information “shall not be disclosed without the written consent of the applicant” | § 208.6 binds **DHS and EOIR, not the adviser**. The page says so outright and locates the adviser's own duty in bar/accreditation rules. The regulation is cited for what it reveals about the stakes, not as the reader's obligation |
| **Journalism** | [42 U.S.C. § 2000aa](https://www.law.cornell.edu/uscode/text/42/2000aa) (Privacy Protection Act 1980) + [18 U.S.C. § 2705(b)](https://www.law.cornell.edu/uscode/text/18/2705) | The PPA protects work product **“possessed by”** the journalist — that single phrase is the whole argument, because a copy on a host is in the host's possession. § 2705(b) completes it: a court may order a provider “not to notify any other person of the existence of the warrant, subpoena, or court order” |
| **Insurance & claims** | [15 U.S.C. § 6801(b)](https://www.law.cornell.edu/uscode/text/15/6801) + [§ 6805(a)](https://www.law.cornell.edu/uscode/text/15/6805), instantiated as [Ohio R.C. § 3965.02(F)](https://codes.ohio.gov/ohio-revised-code/section-3965.02) | ⚠ **The obvious citation was wrong.** 16 CFR Part 314 § 314.1(b) limits the FTC Safeguards Rule to institutions “not otherwise subject to the enforcement authority of another regulator” — and § 6805(a) names **the State insurance authorities**, so the Safeguards Rule does not cover insurers at all. The real duty is the state NAIC adoption; Ohio was first |
| **Construction & tenders** | [41 U.S.C. § 2102](https://www.law.cornell.edu/uscode/text/41/2102) — cited **against** the usual framing | § 2102**(a)** binds federal officials and people advising the Government, **not a contractor circulating its own bid**. Only § 2102**(b)** — “a person shall not knowingly obtain…” — reaches everyone, so the pre-award risk runs the other way |

### Construction deliberately breaks the pattern

There is no personal-data duty over a drawing set. Rather than manufacture one
so the page would match the other twelve, its `duty` block sits in the same
position and says, in so many words, that it is **not** making a compliance
argument — then sells on what is actually true for the trade: portal size caps,
printing without losing stated scale, and splitting double-wide large-format
scans. The file's own opening comment is the reason: *“a compliance-minded reader
who catches one overclaim will not believe the rest of the page, and rightly”.*
That cuts both ways, and one honest page is worth more than a twelfth tidy one.

### Why we stopped at thirteen rather than carrying on
Sector pages earn on the strength of the duty they name, not on count. These
four had real ones; the next candidates do not, and the effort is worth more
spent on item 8. Thirteen against a target of twelve is where this item closes.

### Verified, not assumed
A checker — now permanent as `frontend/scripts/verify-sectors.mjs`, run by
`npm run verify:sectors` and gated in CI as “Sector data contract” — proved all 13 sectors
against the three things `lib/sectors.ts`'s own type comments promise: `title`
≤ 60 chars, `description` ≤ 155 (XC-003), every `toolkit` and `tool` name
present in `components/app/catalog.tsx`, and every `href` both in the catalog
**and** backed by a real `app/<route>/page.tsx`. Result: `sectors=13 problems=0`.
Nothing needed updating by hand — `/sitemap.xml`, `generateStaticParams` and the
footer's “Built for” column all derive from `SECTORS`, and the Markdown-twin
count moved 252 → 256, which is the independent confirmation that exactly four
pages were added.

Gate: tsc clean · 31 files / 329 tests · build clean · all four pages read back
from a `frontend-prod` preview. The one console 404 (`/api/tools/flags`) is the
frontend-only preview having no backend — 200 on prod.


---

## Item 8, D1 — the blocker found while scoping it (2026-11-23)

Scoping the US forms library turned up a live defect in ten shipped tools, so it
went first. The write-up lives in `us-forms-library-scope.md`; the short version:

Most high-volume USCIS forms — I-130, I-485, I-765, N-400 — are
**permissions-only encrypted**. They open with no password, so nothing about them
looks locked. But `ignoreEncryption: true`, which we were passing at 41 call
sites, **does not decrypt** — pdf-lib has no decryption at all, and the flag only
silences its refusal to open the file. Everything downstream then reads
ciphertext: `save()`, `copyPages()`, `drawText()` and `embedPdf()` throw, and
`getFields()` returns **0** without erroring. That is rotate, merge, split,
delete/reorder, page numbers, Bates, watermark, pages-per-sheet, fill form and
flatten, all broken on exactly the forms item 8 is about to ship pages for.

The fix reuses what we already ship. `lib/pdf-open.ts` is now the single opener —
a unit test enforces that no other file may call `PDFDocument.load` and that
`ignoreEncryption` appears nowhere — and it runs our existing **qpdf-wasm**
(`public/qpdf/`, the engine behind /unlock-pdf) with `--password= --decrypt`
before reloading. Still entirely on-device.

Two things it had to absorb centrally. `lib/pdf-rewrite-core.ts` runs inside a
Web Worker and cannot import the opener, because qpdf's inline fallback needs a
DOM — so rewrites decrypt on the main thread before the postMessage. And pdf-lib
throws "Reading rich text fields is not supported" during `save()`'s appearance
pass; I-485 has four such fields of 730. Neutralising the rich-text flag in the
opener meant none of the 61 existing `doc.save()` calls had to change.

Measured, not asserted — `npm run qa:encrypted` over seven real forms:

| Form | fields before | fields after |
|---|---|---|
| I-130 | 0 | 450 |
| I-485 | 0 | 730 |
| I-765 | 0 | 161 |
| N-400 | 0 | 440 |
| I-9 (control) | 128 | 128 |
| W-9 (control) | 23 | 23 |
| 433-A (control) | 515 | 515 |

Files that genuinely prompt for a password are unaffected and still need
/unlock-pdf first — that path was never broken. **Still open:** SSA SS-5 and
SSA-1696 probed as flat, but the confirming fetch was CORS-blocked, so whether
they are genuinely flat or encrypted is unknown.

---

## Item 8, groups A+B — 12 IRS forms shipped (2026-11-23)

`/us-forms` plus 12 pages at `/us-forms/<slug>`. Data in `lib/us-forms.ts`,
contract in `tests/unit/us-forms.test.ts` (10 tests), live re-check via
`npm run verify:us-forms`.

### The one thing that makes these pages different

pdf.net's W-9 and W-4 pages carry an "Official IRS form" badge and link to
irs.gov **zero times**. So every page here prints three measured numbers in a
strip near the top — the revision the IRS publishes today, the fillable field
count, the page count — plus **the date we measured them** and a link to the
IRS page to check. A revision without a date is an assertion; with one it is a
claim the reader can weigh.

`scripts/verify-us-forms.mjs` re-checks all three against the IRS product table
and the real PDF, and also that each `officialUrl` still returns OK. It is
deliberately **not** in CI: the IRS revises on its own schedule, and a drift is
news to act on, not a reason to fail an unrelated commit.

### Verified at source, 2026-11-23 — all 12, drifts=0

| Form | Revision | Fields | Pages |
|---|---|---|---|
| W-9 | Mar 2024 | 23 | 6 |
| W-4 | 2026 | 48 | 5 |
| W-7 | Dec 2024 | 69 | 1 |
| SS-4 | Dec 2025 | 89 | 2 |
| 2848 | Jan 2021 | 92 | 2 |
| 8821 | Jan 2021 | 45 | 1 |
| 8822 | Feb 2021 | 25 | 2 |
| 4506-T | Apr 2025 | 29 | 2 |
| SS-8 | Dec 2023 | 299 | 5 |
| 433-A | Jun 2026 | 515 | 8 |
| 433-F | Jul 2024 | 214 | 4 |
| 9465 | Dec 2026 | 32 | 1 |

1,480 fillable fields in total. The scope doc left three field counts blank;
they are measured now (8821 = 45, SS-8 = 299, 433-F = 214).

### Three things the measurement turned up that nobody would have guessed

**9465 has been renamed.** The December 2026 revision is titled **Payment Plan
Request**. The IRS's own `/forms-pubs/about-form-9465` page still says
*Installment Agreement Request*, so a search finds the old name and you cannot
tell whether you are holding the current form. Read off page 1 of the PDF, not
inferred. The page says both names and explains why they differ.

**Neither 433 has an About page.** `about-form-433-a` and `about-form-433-f`
are both 404, and the forms themselves print only `www.irs.gov` rather than a
form-specific pointer (checked: every other form in the set prints
`irs.gov/Form<N>`, and 10 of 12 of those resolve). Those two link to the IRS
forms index filtered to the form, and `officialName` says in words that the IRS
publishes no About page for it — rather than quietly linking somewhere vaguer.

**9465 argues against itself.** A tip at the top of page 1 says that if you owe
$50,000 or less in combined tax, penalties and interest, you can usually set
the plan up through the Online Payment Agreement application for a *lower* user
fee. That is on the page, because a forms library that does not tell you when
not to use the form is just driving traffic.

### Rules carried over, and the one added

The eight the India library enforces (unique slug · title inside 60 · never
host, authority allowlist, no PDF links · no deadline stated as fact · every
field substantive · every gotcha unique · exact catalogue tool names · grouped
under a rendered heading), plus:

- `sensitive` must be unique per form too — it is the privacy argument, and two
  forms sharing one means one is filler.
- Every form must link **Fill PDF form**. Unlike the India set, every form here
  *is* a fillable PDF; that is the premise of the page.
- `revision` must parse as a year or month-year, with a plausible year;
  `fields` and `pages` must be positive integers; `CHECKED_ON` must be a real
  date, not in the future.
- The no-hard-date check accepts **both** date orders — this set is written for
  readers who write "April 15", and the India regex only caught "15 April".

### What is deliberately not here

Groups C–E (18 forms: returns and information returns, immigration, and
employment/leave/veterans) are scoped but unwritten. The immigration six are
now unblocked by the D1 encryption fix. State Department DS-11 and DS-82 remain
out — behind a Cloudflare bot check we do not bypass.

---

## Item 8, groups C–E — the library closed, and the step we were missing (2026-11-23)

18 more forms, taking `/us-forms` to **30** across five groups: 1040, 1040-X,
1099-NEC, 1099-MISC, W-2, 941, 940 · I-9, I-130, I-485, I-765, N-400, I-864 ·
WH-380-E, WH-380-F, WH-381, 21-526EZ, SS-5. 4,206 more fillable fields,
**5,686** in total, each counted off the file the agency was serving.

### Five agencies do not agree what a "version" is

Groups A+B were all IRS, so one `revision` field was enough. C–E brought in
USCIS, the DOL, the VA and the SSA, and each marks a version its own way. The
data carries the label as well as the value, and `revisionSentence()` phrases
each one in that agency's own words:

| Agency | Label | Example | Why it matters |
| --- | --- | --- | --- |
| IRS | `Rev.` | Mar 2024 | An old revision is usually still accepted |
| IRS (annual) | `Form year` | 2026 | The year *is* the version |
| USCIS | `Edition date` | 04/01/24 | **A superseded edition is rejected outright** |
| DOL | `Revised` | June 2020 | |
| VA / SSA | `Form date` | 12-2024 | |

Collapsing those into one word would have meant printing the IRS's vocabulary
over USCIS's value, and the one case where getting it wrong costs the reader a
rejected application is exactly the one that is not an IRS form.

### The verifier now reads the form, not an index page

`scripts/verify-us-forms.mjs` was rewritten. It used to scrape the IRS product
table; there is no equivalent table for the other four agencies. The one thing
all five do is **print the marker on the document**, so that is what it reads
now — decrypting with qpdf-wasm where the file needs it (every USCIS form and
SS-5 are permissions-only encrypted). Five markers came back unparsed on the
first run and each was investigated rather than waved through:

- **4506-T, 433-A, 433-F** print the month numerically — `(Rev. 6-2026)`, not
  `(Rev. June 2026)`.
- **W-2** puts the year beside the *title* on page 2, not beside the form number.
- **I-9** does not print its edition date in extractable text at all. The USCIS
  page states it, so the script falls back to the agency page for that one and
  reports which source it used.

Last run: `forms=30 drifts=0 unchecked=0`.

### The honest gap, now closed

The flow was: read our page → click through to the agency → find the download →
come back → open the fill tool → pick the file. Five steps to pdf.net's one.
Everything above was true and better, and still lost on the thing people
actually feel.

`app/api/forms/[slug]/route.ts` takes a **slug, never a URL** — the URL comes
from our own table, with an agency host allowlist as defence in depth, so there
is no SSRF surface at all. It fetches with `cache: 'no-store'`, checks the
`%PDF-` magic bytes, and streams the file through. `GetFormButton` wraps it in
a `File`, hands it to `lib/file-handoff.ts` and pushes the fill tool. One click.
If the agency is down, the button falls back to the direct link rather than
dead-ending. Verified end to end on I-485 — an encrypted USCIS form — which
opens in the fill tool with all 730 fields live.

### Where any of this can be found from the UI

The pages were unreachable except by search engine. Fixed in four places:

- **⌘K** has a Forms section. Typing `w9`, `i485` or `1099` finds the page,
  hyphen or no hyphen. The index is served from `/api/forms-index` rather than
  imported — the palette is mounted by the root layout, so importing 62 forms'
  prose would put it in the chunk every page loads.
- **Tools mega-menu** has a "Looking for a form?" strip: US forms, Indian
  forms, passport photos, by profession.
- **Fill PDF form** carries a strip under the dropzone for people who have the
  form number but not the file.
- **Sector pages** — immigration, accountants, tax practitioners and HR each
  link the forms that trade works out of, via a new optional `forms` field on
  `Sector`. `verify:sectors` was taught the distinction (a library href must be
  a real page and on a two-item allowlist, but cannot be a catalogue tool) so
  the exception could not quietly widen into "any href".

### The bug this shipped past, and the test that now catches it

The first ⌘K matcher split the haystack on punctuation, so `w9` produced the
words `w` and `9` and matched nothing — the palette said **"No matches for w9"**
for the most common way anyone writes that form's name, with a clean build and
350 green tests behind it. Caught by actually typing it into the browser. The
matcher now lives in `lib/form-search.ts` with `tests/unit/form-search.test.ts`
asserting every form in **both** libraries is findable by its number with and
without punctuation.

---

## Item 8, the sync job — and the question it opened (2026-11-23)

The library was the deliverable; keeping it true was the part nobody had
written. `.github/workflows/forms-sync.yml` now reads all 30 forms from the
IRS, USCIS, DOL, VA and SSA every Monday (06:00 UTC) and on any edit to
`lib/us-forms.ts` or the verifier, and compares revision, field count and page
count against what our pages claim.

Deliberately **not** part of QA. A drifted form is not a broken build — nothing
regressed, no commit caused it, the IRS simply published a new revision — and
wiring it into the gate would fail somebody's unrelated PR for a reason they
cannot fix, which is how a gate stops being trusted. It also makes ~90 outbound
requests to five government sites, which belongs on a timer and not on a push.

Two outcomes, two different emails, because they are two different pieces of
news. **Drift** means a page of ours states a revision that no longer exists:
worth a day, and worth failing the run red. **Unreadable** means a form could
not be fetched or printed its marker somewhere the script cannot parse: emailed,
not failed — one week of that is noise, the same form twice is a claim nobody has
checked. The verifier exits non-zero for both, so the exit code is ignored and
the summary line is read instead.

Proven end to end, not assumed: first real run `forms=30 drifts=0 unchecked=0`
in 40 s, and a `workflow_dispatch` with `test_alert=true` logged
`✓ Told ***: TEST — ignore. Checking the form-drift alert works`.

`ALERT_TO` is a required secret here with no fallback. The sibling
`notify-failure.mjs` hardcodes the owner's personal address, and this repository
is public — a personal address in a published file is a scraped address. Three
other tracked files do the same; see D4 below.

### The question this opened: how far does the forms library go?

Asked on the same day — *"every US state has unique forms, do we have all? what
about grouping all the states and the top countries? and should the forms site be
new or here in diemdesk?"* Answered in
**[forms-library-expansion.md](forms-library-expansion.md)**. The three findings
worth carrying here:

- **It stays here, as a subdirectory.** Not a new domain — that is 12–18 months at
  zero authority against aggregators with a decade of backlinks — and not a
  subdomain, which buys the downside of both. The product is the one-click handoff
  into the fill engine, and a redirect to an unfamiliar domain on the page where
  someone types a Social Security number is the worst place we could spend trust.
- **"All 50 states" is the wrong shape.** 1,500–4,500 forms, none of them
  verifiable at that volume. The version that works is a **form-type × state
  matrix** — one form, fifty states, one page — beginning with resale/exemption
  certificates, where the **ST-5 the owner went looking for is one cell and the MTC
  multijurisdiction certificate is the header row**.
- **The trap, stated plainly:** adding forms faster than we can verify them trades
  the moat for page count and makes us a smaller pdfFiller. Breadth is a function
  of verifiability, not of ambition.

### New open decisions

| | Question |
|---|---|
| **D1** | Phase 1 matrix order — exemption certificates first (recommended), or state withholding certificates? |
| **D2** | A `/forms` hub to parent the libraries: build it now, or wait for a third library? |
| **D3** | Phase 3 "packet" (multi-form, details entered once, chained through Saved Workflows) as the Pro line — confirm, since it decides the data model |
| **D4** | Move `notify-failure.mjs` and the three other tracked files off the hardcoded personal address onto `ALERT_TO`? |
