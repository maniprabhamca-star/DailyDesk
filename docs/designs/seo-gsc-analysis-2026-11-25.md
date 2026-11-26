# Search Console analysis — 92 days to 2026-11-25

Source: the owner's own GSC export,
`diemdesk.com-Performance-on-Search-2026-11-25.xlsx` (24 Aug – 25 Nov 2026).
Every number below is read from that file, not estimated.

---

## 1. The headline

| | |
|---|---|
| Clicks | **10** |
| Impressions | **2,201** |
| CTR | **0.45 %** |
| Average position | **46.8** |

**Impressions grew +185 % half-over-half (572 → 1,629). Clicks did not move
(5 → 5).** Google is showing the site three times as often and sending the same
traffic. That one line is the whole problem statement.

## 2. It is not a technical problem

Checked and clean, so do not spend time here:

- `robots.txt` allows everything bar `/cdn-cgi/` and `/forms-api/`
- every page sampled returns `index, follow` — no stray `noindex`
- canonicals present and self-referencing
- `FAQPage` JSON-LD present across tool, India-forms and US-forms pages
- sitemap serves **311** URLs

Missing but minor: no `BreadcrumbList` and no `HowTo` schema anywhere.

## 3. It is not a CTR problem either

The tempting read of a 0.45 % CTR is "fix the titles". The data says otherwise.

**66 pages rank in the top 20 and earn 3 clicks between them** — because they
have 1–17 impressions each. The pages ranking well are `/about` (pos 2.5),
`/dpa` (4.3), `/accessibility` (4.4), `/refund-policy` (7.8), `/slugify` (3.5),
`/terms` (4.0). Legal and utility pages nobody searches for.

Position distribution, by impressions:

| Positions | Queries | Impressions | Clicks |
|---|---|---|---|
| 1–3 | 7 | 21 | 0 |
| 4–10 | 50 | 67 | 0 |
| 11–20 | 37 | 111 | 0 |
| 21–50 | 106 | 292 | 0 |
| **51–200** | **377** | **800** | 1 |

Only **1 %** of impressions are top-3. **36 %** are position 51 or worse.

**The striking-distance set is two queries.** Positions 11–25 with ≥5
impressions: `ais registration india` (33 imp, pos 16.7) and `epf form 10c`
(19 imp, pos 19.9). That is the entire "one push and it ranks" list.

## 4. What the data actually says

> **Where a query names a specific entity with weak competition, we rank
> top-10. Where it is a head term with established competitors, we rank 40–80.**

Seven of fifteen bank pages are in the top 20 — `sbi-card` **2.4**, `bandhan`
6.5, `rbl` 7.0, `amex-india` 8.0, `axis` 8.7, `phonepe-statement` 8.7,
`jupiter-money` 16.1.

Against that, the generic tool pages: `remove-pdf-metadata` **70.6**,
`crop-image` 77.5, `pdf-to-rtf` 78.2, `scan-qr-code` 65.8.

⚠ **A hypothesis that did NOT survive the data, recorded so nobody re-runs it:**
"deeper URLs rank better." Depth 1 averages position 33.9 and depth 2 averages
36.6. It is not URL shape — it is competition on the term.

### The India forms library is the biggest asset and the clearest illustration

| | |
|---|---|
| Impressions | **1,186 — 54 % of the whole site** |
| Clicks | **1** |
| Average position | **47.7** |
| Pages | 32 |

`/india-forms/epf-form-19` alone draws **241 impressions at position 46.6**, for
`form 19` (27), `epf form 19` (23), `pf form 19` (22), `form 19 in epfo` (22).
Real demand, page five. These are terms EPFO itself and the large Indian finance
publishers own. **Content depth alone will not take a three-month-old domain
past them**, and saying otherwise would be selling a fix that does not work.

## 5. The one concrete on-page defect found

**All 32 India form titles come from a single template** in
`app/india-forms/[form]/page.tsx:22`:

```
`${f.short} — What It Is & Who Files It | DiemDesk`
```

So `/india-forms/epf-form-19` is titled **"Form 19 — What It Is & Who Files It"**.

Three things wrong with that, in order of cost:

1. **The qualifier people search is missing.** The URL says `epf-form-19`; the
   title says only "Form 19". The queries are `epf form 19`, `pf form 19`,
   `form 19 in epfo`. Same for `epf-form-10c` → titled "Form 10C".
2. **Thirty-two pages share one phrasing.** "What It Is & Who Files It" on every
   one, and the descriptions are templated identically too.
3. **No intent match.** Real queries carry `download`, `online`, `format`,
   `full form` — `gstr-9a format`, `form 19 download`, `ais full form`,
   `epf form 10c online`. None of those words appear in any title.

This is worth fixing because it is cheap and correct. It is **not** worth
expecting it to move position 47 to page 1.

## 6. What to do, in order

**1 — Retitle the 32 India forms pages (cheap, correct, do it now).** ✅ DONE
(commit `83e2324`, `INDIA_SEO` in `lib/india-forms.ts`). Per-form
titles and descriptions carrying the qualifier and the intent word people
actually type. Not a template.

**2 — Build more low-competition entity pages.** This is the only lever with
evidence behind it on this domain: the bank pages rank, the head-term pages do
not. The forms matrix roadmap is already this strategy; the data now supports
it rather than merely arguing for it.

**3 — Add `BreadcrumbList` to the three library families.** ⏳ STILL OPEN.
Site-wide, mechanical, improves how the result renders.

**4 — Take the two striking-distance queries.** `ais registration india`
(pos 16.7) — our AIS page does not cover *registration* at all. `epf form 10c`
(pos 19.9).

**5 — Accept that the rest is authority, and that it takes links, not pages.**
No on-page change moves 377 queries from position 51+. Worth saying plainly
rather than shipping work that implies otherwise.

### Owner-only, and still open from the tracker

`docs/designs/pdfnet-response-tracker.md` lists **Cloudflare → Security → Bots →
AI Scrapers and Crawlers = Off** as still open. Unrelated to Google rankings,
but it is the one SEO-adjacent switch no code can throw.

## 7. The internal-link audit (run 2026-11-25, after §6)

§2 said this is not a technical problem, and that holds for crawling, speed and
markup. It did not hold for internal links, and that was not visible in the
performance export at all — it only shows up by crawling the built site.

**Method.** Fetch all 311 sitemap URLs from the production build, take
`<main>`, strip `<header|footer|nav>`, and count how many pages link to each URL
from their *content*. Script: `linkaudit.py` (scratchpad; takes the base URL as
argv[1]). Counting the header and footer would have made every page look well
linked — that is why chrome is stripped, and the orphan list prints the
with-chrome total beside each row so a footer-only page is distinguishable from
one nothing reaches at all.

**What it found: 79 pages with zero editorial inbound links.** Including all 39
bank statement pages — the best-ranking family on the domain (sbi-card pos 2.4,
bandhan 6.5, rbl 7.0, amex-india 8.0, axis 8.7, phonepe-statement 8.7). Two
independent causes, both invisible from the page itself:

1. The hub listed none of its own bank pages.
2. The hub is `soon: true` in the catalogue, and the Tools menu only emits an
   anchor for `t.href && !t.soon` — so the menu rendered it as plain text.

**Result after the repair.**

| | before | after |
|---|---|---|
| pages with 0 editorial inbound links | 79 | 4 |
| of those, reachable only from the footer | 3 | 3 |
| bank family, average inbound | 0.0 | 12.0 (min 12, max 12) |
| passport family, average inbound | 4.3 | 5.3 (min 1) |

**Two traps worth recording.**

- ⚠⚠ `PdfToolPage` wraps only `children` in `ToolGate`, **not** `afterTool`. The
  bank hub index was written as a child first. The tool is `coming_soon`, so the
  public page rendered "Coming soon" and emitted **zero** anchors — and the
  re-run audit still showed all 39 banks at zero, which is the only reason it
  was caught. Anything whose job is to be crawled goes in `afterTool`.
  `tests/unit/orphan-links.test.ts` pins this, with a negative sample proving
  the check bites.
- ⚠ The hub **cannot** be the carrier for `/bank-statement-to-{tally,quickbooks,csv}`
  even once it does render them: it is `robots: { index: false }` while the tool
  is gated and is kept out of the sitemap, so its links pass nothing. Those
  three stayed at zero until they were linked from the 39 *indexed* bank pages.

**Distribution, not just presence.** Each bank page links to a rotating slice of
twelve taken from its own position in the index, so every bank receives 12 and
no page is left out. "Link to the first twelve" passes every other assertion and
leaves 26 banks exactly as orphaned as before — including `sbi-card`, the
best-ranking page on the site. `tests/unit/bank-links.test.ts` tests the
received counts, not the emitted ones, and also asserts `siblingBanks` is
deterministic: a `Math.random` or date-seeded pick would hand Google a different
internal structure on every deploy.

**What is still orphaned, and why that is fine for three of them.** `/about`,
`/accessibility` and `/vulnerability-disclosure` are footer-only (310 chrome
links each) and belong there.

**⏳ Open decision — `/fill-pdf-form-online`.** The last real orphan. It is a
33-line keyword landing page, self-canonical, whose subject is identical to
`/fill-pdf-form`. It was deliberately *not* linked: there is no sentence a
reader on the parent page would gain anything from, and writing one would be
filler. The options are a 301 to `/fill-pdf-form`, or pointing its canonical at
the parent and leaving the page up. Needs a decision rather than a link.

**Next on this axis: 94 pages with 1–2 inbound links**, including all ten
competitor `*-alternative` pages at 1 each, and the 12 tool pages with 0
outbound body links (`/verify-redaction`, `/delete-pages-from-pdf`,
`/powerpoint-to-pdf`, `/extract-images-from-pdf`, `/remove-pdf-metadata`,
`/protect-pdf`, `/pages-per-sheet`, `/change-pdf-page-size`, `/pdf-to-rtf`,
`/pdf-to-html`, `/pdf-to-odt`, `/odf-to-pdf`) — a page that links nowhere passes
its authority nowhere.

## 8. What this export cannot tell us

It carries performance only. **It does not say how many of the 311 sitemap URLs
are actually indexed** — 158 have had at least one impression, so up to 153 may
be unindexed, but roughly 67 of those shipped within the last three days
(`/us-forms`, `/forms`, `/for/`) and would not have data yet.

To settle it: GSC → **Indexing → Pages** → Export. That report names every
excluded URL and the reason, including any "Duplicate, Google chose a different
canonical" — which would matter for the 51 passport pages.
