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

**1 — Retitle the 32 India forms pages (cheap, correct, do it now).** Per-form
titles and descriptions carrying the qualifier and the intent word people
actually type. Not a template.

**2 — Build more low-competition entity pages.** This is the only lever with
evidence behind it on this domain: the bank pages rank, the head-term pages do
not. The forms matrix roadmap is already this strategy; the data now supports
it rather than merely arguing for it.

**3 — Add `BreadcrumbList` to the three library families.** Site-wide, mechanical,
improves how the result renders.

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

## 7. What this export cannot tell us

It carries performance only. **It does not say how many of the 311 sitemap URLs
are actually indexed** — 158 have had at least one impression, so up to 153 may
be unindexed, but roughly 67 of those shipped within the last three days
(`/us-forms`, `/forms`, `/for/`) and would not have data yet.

To settle it: GSC → **Indexing → Pages** → Export. That report names every
excluded URL and the reason, including any "Duplicate, Google chose a different
canonical" — which would matter for the 51 passport pages.
