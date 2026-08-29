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
| 3 | Passport differentiation + verify 21 specs | 0 | **in progress** | Tier 1: UK/Canada/Australia done 2026-08-29 |
| 4 | Bank statement guides 11 → 40 | 28 | **shipped** | 2026-08-29 · 39 pages |
| 5 | Competitor alternatives 4 → 10 | 5 | **shipped** | 2026-08-29 (9 of 10; Canva pending a source) |
| 6 | Sector pages 4 → 12 | 5 | **in progress** | 9 of 12 · 2026-08-29 |
| 7 | Indian statutory forms library | 33 | **shipped** | 32 forms + index · 2026-08-29 |
| 8 | US forms library (privacy wedge) | ~30–60 | **todo** | |
| 9 | "What comes next" dock | 0 | **todo** | |
| 10 | AI document generator / invoice builder | 1–2 | **todo** | |
| 11 | Multi-document AI chat | 0 | **blocked** — File Vault | |
| 12 | MCP server | 1 | **todo** | |

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

## 6 — Sector pages · in progress (4 → 6)

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
