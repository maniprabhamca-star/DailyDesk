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

## 5. The fourteen head terms: what it would actually take

Asked directly, after the above: *what is the plan to improve ranking for
`compress pdf`, `merge pdf`, `pdf to word` and the other eleven?*

There is a plan. It is not a content plan, and it does not finish this year.

### Where we are starting from

Zero impressions on all fourteen, over 92 days. Not a bad position — no
position. And these are not ordinary commercial queries: a free PDF tool is one
of the most link-contested things on the web, held by four domains at DR 62–84
while we sit at **0.9**.

Domain Rating is a function of the link graph — how many other sites link to
you, and how strong they are. It is not a function of word count, schema, title
tags, internal links or page speed. Every item in §3 is worth doing and **none
of it moves these fourteen terms.** That is the honest shape of the problem, and
any plan that implies otherwise is selling motion.

### The ladder, in the order it has to happen

**1 — Collect referring domains.** ⚠ **Corrected the same day it was
written.** The first draft of this step said the directory work was mostly
undone and the press releases were sitting unsent. Both were written from the
roadmap rather than from the live state, and the live state says something more
useful — and less comfortable.

| | state, checked 2026-11-25 | |
|---|---|---|
| npm | `diemdesk-mcp@0.1.2` live since 2026-08-30 | ✅ |
| Official MCP Registry | `com.diemdesk/mcp`, status active | ✅ |
| Glama | listed **and claimed**, rated **B** on the `DailyDesk` path (**D** on the duplicate `diemdesk-mcp` path) | ✅ |
| `awesome-mcp-servers` | **PR #13214 CLOSED 2026-10-09** — see below | ❌ |
| Smithery | skipped on purpose: it lists hosted URLs, ours is stdio-on-your-disk | — |
| Press distribution | **published July 2026 via EIN Presswire and syndicated** | ✅ |

**The press release went out, and it is the most important fact in this
section.** It published around 2026-07-14 and syndicated to at least six
domains — einpresswire.com itself, financialcontent.com (Wedbush),
investor.wedbush.com, pr.enewspf.com, smb.panolian.com — and was picked up
independently by borncity.com, a German tech blog. Records are in
`diemdesk-EIN-newswire/`, which is where the archive actually lives, not
`docs/press/`.

**Four months later the domain is at DR 0.9.** Newswire syndication is almost
entirely nofollow and duplicated across a syndication network, so it buys
visibility on the day and close to nothing in the link graph. We have already
run that play once, at cost, and the result is measured. **Planning a second
press release as a link-building step would be repeating an experiment whose
answer we have.** Worth doing again for launch news; not worth doing for DR.

**What is actually open, and it is one thing:**

- **✅ DONE 2026-11-26 — resubmitted as
  [PR #20784](https://github.com/punkpeye/awesome-mcp-servers/pull/20784)**,
  additions 1 / deletions 0 / mergeable, branch rebuilt from current
  `upstream/main`. `gh pr reopen` is refused once a head branch has been
  force-pushed, so it went up as a new PR, which is what the maintainer
  invited. ⚠ It now needs **watching** — silence is exactly what closed the
  first one. Original note follows.
- **`awesome-mcp-servers` PR #13214 was closed for a reason that no longer
  holds.** The list now gates entries behind a Glama quality score. When the PR
  was reviewed there was none, the author did not respond for 30 days, and it
  was closed as inactive on 2026-10-09 with an explicit invitation to reopen.
  The score now exists — **B** — so the blocking condition is satisfied and the
  entry can be resubmitted. This is the single highest-value unblocked item in
  the whole section: that list is one of the most-referenced MCP directories
  there is.
- **The duplicate Glama listing.** The same server is listed twice, once rated
  B and once rated D. The D entry is the dedicated `diemdesk-mcp` repo, which
  has not been committed to since 2026-08-30 — Glama's rating is a maintenance
  signal, so a repo that has not moved in three months rates badly while the
  main repo, committed to daily, rates B. Worth consolidating, and worth
  knowing that the fix is activity rather than content.
- **npm 0.1.3**, which is listed as outstanding and is close to pointless. The
  only change between 0.1.2 and the working copy is the Dockerfile and
  `glama.json`, and `files` does not ship either of them — so publishing it
  would be a version bump with no functional difference. Its one real effect is
  refreshing the "last published" date, which feeds the maintenance signal
  above. Do it as part of a release that carries something, not on its own.
- **Software directories**: AlternativeTo, SaaSHub, Slant, Product Hunt,
  Show HN. These are genuinely untouched. Each needs an account, so each is
  owner action — what can be prepared in advance is the submission copy.
- **Privacy communities**: privacyguides.org, r/privacy. Our zero-upload claim
  is the rare thing those audiences can verify themselves, which is what makes
  a submission there something other than spam.

**2 — Give people something to link to that is not "we built a tool".** The one
linkable asset we can build that nobody else can: **a measured record of what
competing converters actually upload.** Open the network panel, run the same file
through each, record the requests and the bytes. The result is a fact rather than
a marketing claim, and it is the single strongest link hook available to a
privacy-first toolkit.

⚠ Rules that apply to it and are not optional: every number measured and dated,
every tool named precisely, scope stated (the online tool, on that date, not the
desktop product), `<ThirdPartyNotice>` on the page, and the claims written so a
competitor reading it has nothing to object to. See
`dailydesk-competitor-comparison-policy`. A sloppy version of this page is worse
than no page.

**3 — Rank the cluster before the hub.** Our own data is unambiguous: we win
where a query names something specific. `/compress-pdf` gets its shot *after*
the exact-size family in §3 P2 ranks and links into it — six pages that rank for
`compress pdf to 50kb`, `... to 200kb` and so on, each passing a relevant
internal link up to the hub. That sequence is the only on-page route to a head
term, and it runs cluster-first. It does not work in reverse.

**4 — Branded search, which is slow and real.** `dimesk` at position 2,
`diem pro` 5.7, `diem editor` 10 — six impressions between them. How many people
search for you by name is an input to how the domain is treated. It grows from
step 1 and step 2, not from anything on a tool page.

**5 — What not to do, stated so nobody is tempted.** No paid links, no
guest-post networks, no expired-domain redirects, no directory bundles. At DR
0.9 the domain *is* the asset; a manual action is not a setback, it is the end of
it.

### The timeline and the ceiling, honestly

30–60 genuine referring domains over 6–12 months takes DR 0.9 to roughly 20–30.
**At DR 25, `merge pdf` is still not winnable** — iLovePDF and Smallpdf have had
a decade and thousands of referring domains on exactly that term. What changes is
that the modifier and long-tail space opens up at volume, which is where §3 was
pointing all along.

### And the part worth saying out loud

**The single click this site earned in 92 days was
`bob bank statement pdf to excel converter`, at position 103.** Somebody went to
page eleven of the results and clicked. Meanwhile 59 PDF-tool queries drew 122
impressions and zero clicks.

`compress pdf` is the most commoditised query in the category and it monetises at
approximately nothing — the people searching it want one free file converted and
will take whichever of six identical free tools Google puts first. Statement
conversion is the paid product (`dailydesk-statement-converter`), the intent is
specific enough that a reader dug to page eleven to find us, and the competition
on those terms is weak enough that we already rank 2.4–8.7 across the family.

So: the fourteen head terms have a plan, and it is the ladder above. But if the
goal is revenue rather than a ranking screenshot, **they are the wrong fourteen
queries to be planning around**, and the ladder's step 1 and step 2 are worth
doing on their own merits regardless of what they eventually do for
`compress pdf`.

## 6. What this plan does not promise

It does not get `/compress-pdf`, `/merge-pdf` or `/pdf-to-word` into the top 10.
Those terms are held by four domains at DR 62–84 and we are at 0.9, and we
currently register **zero impressions** on every one of them. P1–P3 target
queries worth roughly **200 impressions a month today** — modifier and
comparison demand the big four have left alone. That is the honest size of the
prize, and it is the prize that is actually available.
