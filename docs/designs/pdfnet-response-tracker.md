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
| 2 | Stripe ToS consent checkbox | 0 | **todo** | |
| 3 | Passport differentiation + verify 21 specs | 0 | **todo** | |
| 4 | Bank statement guides 11 → 40 | ~29 | **todo** | |
| 5 | Competitor alternatives 4 → 10 | ~6 | **todo** | |
| 6 | Sector pages 4 → 12 | ~8 | **todo** | |
| 7 | Indian statutory forms library | ~40–60 | **todo** | |
| 8 | US forms library (privacy wedge) | ~30–60 | **todo** | |
| 9 | "What comes next" dock | 0 | **todo** | |
| 10 | AI document generator / invoice builder | 1–2 | **todo** | |
| 11 | Multi-document AI chat | 0 | **blocked** — File Vault | |
| 12 | MCP server | 1 | **todo** | |

### Owner actions (not code — only you can do these)

| Item | Where | Status |
|---|---|---|
| Unblock AI crawlers | Cloudflare → diemdesk.com → Security → Settings → Bots → **AI Scrapers and Crawlers = Off**; content signals `ai-train=yes`, `ai-input=yes` | **open** |
| Terms of Service URL for the checkout consent box | Stripe Dashboard → Settings → Business → Public details → Terms of service URL = `https://diemdesk.com/terms` | **open** (needed by item 2) |
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
