# Getting the PDF tool pages into the top 10 — the plan, and the ceiling

**Written 2026-11-25.** Companion to `seo-gsc-analysis-2026-11-25.md`, which
covers the whole site. This one answers a narrower question that was asked
directly: *what is the plan to get `/compress-pdf` and the other PDF tool pages
to the top 10?*

Everything below is measured. The Search Console export is
`diemdesk.com-Performance-on-Search-2026-11-25.xlsx` (92 days, 581 queries,
2,201 impressions). Domain Ratings were read from Ahrefs' free DR endpoint on
2026-11-25. Word counts come from our own built Markdown twins in `public/*.md`.

---

## 1. The finding that reframes the question

**Not one PDF head term has produced a single impression in 92 days.**

Checked individually against the Queries sheet: `compress pdf`, `merge pdf`,
`split pdf`, `pdf to word`, `pdf to excel`, `pdf to jpg`, `jpg to pdf`,
`edit pdf`, `sign pdf`, `rotate pdf`, `crop pdf`, `pdf converter`,
`compress image`, `qr code generator`. **All absent.** Zero impressions each.

That is a different situation from ranking badly. We are not on page five for
"compress pdf" — Google has not put us in front of anyone for it at all.

It also corrects a reading that looks encouraging and is not: the page-level
sheet shows **`/compress-pdf` at average position 7.0**. That is 8 impressions
of long-tail and branded traffic. It is not "nearly top 10 for compress pdf".
Any plan built on that number would be built on a misread.

### Why, in one line

| domain | Ahrefs DR (2026-11-25) |
|---|---|
| smallpdf.com | **84** |
| ilovepdf.com | **83** |
| sejda.com | 76 |
| pdf2go.com | 72 |
| pdf.net | 62 |
| **diemdesk.com** | **0.9** |

A three-month-old domain at DR 0.9 does not take a commercial head term from
four sites at DR 62–84. No title, no word count and no schema changes that.
Saying otherwise would be selling work that cannot deliver.

**So: top 10 for "compress pdf" is not a 2026 goal. Top 10 on the queries that
already show us is, and some of it is close.**

---

## 2. Where the reachable top 10 actually is

49 tool pages earned impressions: **499 impressions, 4 clicks, average position
44.3**. Of the 96 tool-shaped queries — 175 impressions — we have **zero
clicks**. The demand is not in the head terms; it is in modifiers.

### The five pages that already have real demand

| page | imp | pos | words | the queries it surfaces for |
|---|---|---|---|---|
| `/remove-pdf-metadata` | **72** | 66.6 | 401 | `remove metadata from pdf` 29 @70.6 · `pdf metadata remover` 8 @53.2 · `how to remove metadata from pdf` 5 @91.2 · `remove pdf metadata` 3 @55.0 · `strip metadata from pdf` 3 @57.7 · `remove metadata pdf` 3 @64.3 · `delete metadata pdf` 3 @73.0 · `removing metadata from pdf` 2 @79.0 |
| `/crop-image` | **59** | 77.5 | 307 | thin and vague — `free crop photo` 2 @89, `crop desk` 1 @15, the rest spread |
| `/scan-qr-code` | **34** | 65.8 | 455 | `qr code scanner from image` 6 @51.8 · `scan qr code from image` 4 @52.5 · `qr scan from image` 2 @70 · `read qr code from image` 2 @91 · `scan qr code from screenshot` 2 @95 |
| `/pdf-to-rtf` | **20** | 78.2 | 411 | `pdf to rich text` 7 @78.4 · `pdf to rich text format` 5 @80.8 |
| `/extract-images-from-pdf` | **20** | 68.5 | 449 | `extract images from pdf free` 3 @86.3 · `separate images from pdf` 1 @24.0 |

### ⚠ The obvious lever is already pulled — checked, not assumed

The tempting conclusion is "the titles don't carry the query". They do. Read at
source today:

- `/scan-qr-code` → `QR Code Scanner — Scan a QR Code From an Image, Free`
- `/pdf-to-rtf` → `PDF to RTF — Convert to Rich Text Format`
- `/remove-pdf-metadata` → `Remove PDF Metadata — Clean Author & Hidden Info Free`

The exact searched phrase is in each title and we are still at 66–80. **That
rules out relevance signalling as the problem on these five.** What is left is
depth and authority — which is the whole point of the plan below, and the reason
retitling is not in it.

### The one PDF family genuinely in striking distance

| query | imp | pos |
|---|---|---|
| `compress pdf to 270kb` | 2 | **21.5** |
| `pdf size reduce in kb` | 1 | **21.0** |
| `compress size` | 3 | 46.0 |
| `convert mb to kb pdf` | 2 | 45.0 |

`/compress-to-size` carries 52 impressions at position 36.6 and **2 of the site's
4 tool-page clicks**. Exact-size queries are the lowest-competition commercial
PDF demand there is, because the big four do not build a page per size. We
already have `/compress-pdf-to-100kb` as the pattern.

### And the niche where DR 0.9 is not a wall

| query | pos |
|---|---|
| `welche sind die besten webbasierten alternativen zur komprimierung von pdf-dateien und wie unterscheiden sich deren preismodelle?` | **4.0** |
| `what are the best web based pdf compression tools and how do their pricing compare?` | **13.0** |
| `quels sont les meilleurs outils en ligne pour combiner des fichiers pdf et comment se comparent leurs prix ?` | **14.0** |

Three languages, all asking the same thing: *which tools, and what do they
cost?* These are assistant-shaped questions, and on them our comparison pages
place 4th and 13th against domains eighty points above us. This is the one place
in the data where authority is clearly not the gate.

---

## 3. The plan, in order

### P1 — Depth on the four pages that already have demand

Not titles. Substance a DR-0.9 domain can win on: measured numbers, a real
table, and the specific thing the competition gets wrong. 300–500 words against
competitors running 800–2,000 is the gap.

**Order is by measured demand, not by preference.**

1. **`/remove-pdf-metadata` (72 impressions — the biggest tool-page demand we
   have).** We have genuine expertise here that nobody else writes up: the
   Info-dictionary-versus-XMP trap recorded in
   `dailydesk-metadata-and-converters`. A PDF carries the same author in two
   places and clearing one leaves the other. Build the page around that: what
   each field leaks, which tools miss XMP, the before/after table the tool
   already shows, and how a reader verifies it is actually gone. Eight query
   variants to cover naturally in the body.
2. **`/scan-qr-code` (34).** Every query says *from an image* or *from a
   screenshot*. The title says it; the body should be about that case — a
   screenshot of a WhatsApp QR, a photo of a poster, a code at an angle.
3. **`/pdf-to-rtf` (20).** The real question behind `pdf to rich text` is "will
   Word open it and keep the formatting". Answer that with a measured result.
4. **`/extract-images-from-pdf` (20).** `separate images from pdf` sits at 24.0 —
   the closest of the four to page one.

**`/crop-image` is deliberately last** despite 59 impressions: its queries are
vague and low-intent, so the same effort buys less.

### P2 — The size-modifier family

The only PDF family with a top-10 path on the current evidence. Build on
`/compress-pdf-to-100kb`'s model: **50 KB, 200 KB, 300 KB, 500 KB, 1 MB**, plus
an `MB to KB` explainer.

⚠ **Each page must carry a measured result or it is a doorway page.** What a
10-page scanned statement actually looks like at 200 KB, how many pages fit
under 50 KB before text stops being selectable — numbers from our own benchmark
harness, logged to `dailydesk-test-results` like every other claim. A set of
pages whose only difference is a number in the heading is the thin-content
pattern Google demotes, and we would deserve it.

### P3 — The pricing-comparison answer, in three languages

Cheapest item with the clearest evidence behind it.

- The ten `*-alternative` pages each have **1 inbound link** (internal-link
  audit, §7 of the companion doc). Fix that first — they are the pages already
  placing 4th.
- The queries ask about **pricing**, in words. Make sure a pricing comparison is
  on the page as a table, sourced and dated, under the existing
  `<ThirdPartyNotice>` and competitor-comparison rules.
- Three of three samples were non-English or long-form. Worth testing whether
  the German and French placements are reproducible rather than noise.

### P4 — `BreadcrumbList` on the three library families

Carried over from the companion doc. Mechanical, site-wide, improves how the
result renders. Still open.

### P5 — Links, which is the only thing that moves a head term

DR 0.9 is the ceiling on everything in §1. The items that raise it are already
written down and not done:

- MCP directory submissions (`dailydesk-mcp-server` records the gap).
- `npm publish 0.1.3` (`dailydesk-npm-publishing`).
- The press releases already sitting in `docs/press/` (`dailydesk-pr-archive`).

No amount of P1–P4 substitutes for this. P1–P4 win queries the big four have not
bothered to answer; P5 is what eventually makes the head terms contestable.

---

## 4. Flagged, not actionable yet

**57 queries rank in the top 10, draw 88 impressions, and earn 0 clicks.** At
position ~7, 88 impressions should produce something. Three explanations fit and
the performance export cannot separate them: the queries are navigational for
somebody else (`soda pdf`, `pdf .net`), an AI Overview is taking the answer, or
the result is below the fold on a crowded SERP.

The `Search appearance` sheet in the same export is the next place to look, and
**GSC → Indexing → Pages → Export** is still outstanding from the companion doc.
Worth settling before anyone concludes it is a title problem and rewrites 57
titles for nothing.

---

## 5. What this plan does not promise

It does not get `/compress-pdf`, `/merge-pdf` or `/pdf-to-word` into the top 10.
Those terms are held by four domains at DR 62–84 and we are at 0.9, and we
currently register **zero impressions** on every one of them. P1–P3 target
queries worth roughly **200 impressions a month today** — modifier and
comparison demand the big four have left alone. That is the honest size of the
prize, and it is the prize that is actually available.
