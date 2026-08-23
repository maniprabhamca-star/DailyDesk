# Passport photo pages — editorial scope

**Why this exists.** Google Search Console reports 13 URLs under *"Duplicate
without user-selected canonical"*, five of them `/passport-photo/*`. The
technical setup is not the problem — verified 2026-08-23:

- canonicals present and self-referencing on all 13
- redirects correct: 301 http→https, 301 www→apex, 308 trailing slash
- all 13 present in `sitemap.xml`

The problem is measured content similarity. 4-gram overlap between rendered
pages, before and after the 2026-08-23 template rewrite (`87578d3`):

| Pair | Specs | Before | After |
|---|---|---|---|
| Canada vs Japan | different | — | **52.6%** ✅ |
| China vs Nepal | different | — | **42.2%** ✅ |
| Japan vs Nepal | **identical** | 75.7% | **80.3%** ❌ |
| Japan vs Poland | **identical** | 77.2% | **79.8%** ❌ |

Word count went 247–253 → 643–721. The template rewrite fixed countries whose
*numbers* differ. It cannot fix countries whose numbers are identical, because
every sentence it generates is interpolated from those numbers. **35×45 mm with
a light background and a 70–80% head range is shared by roughly 30 entries in
`passport-specs.ts`.** Those pages need writing, not templating.

---

## What has to be written

Per country, roughly **150–250 words of genuinely country-specific prose** on
top of the generated table. Five fields, because these are the things that
actually differ between two countries with the same photo dimensions:

| Field | Why it differentiates | Example of the kind of thing |
|---|---|---|
| `authority` | Different body, different name, different portal | who issues the passport and where you apply |
| `glasses` | Genuinely varies — some ban them outright, some allow with conditions | whether glasses are permitted at all |
| `headCovering` | Varies by country; religious exemptions differ | when a covering is accepted |
| `expression` | Neutral vs "slight smile permitted" is not universal | mouth closed, eyes open, etc. |
| `recency` | 3 months / 6 months / "recent" — differs | how old the photograph may be |
| `quirk` | The one thing people get wrong for THIS country | e.g. UK requires grey, not white |

`quirk` is the highest-value field: it is the sentence that makes the page worth
linking to, and it is different everywhere by definition.

**Do not** paraphrase the same paragraph 30 ways. If two countries genuinely
have the same rule, say so and link them — that is what `sharesSpecWith()`
already does with dimensions.

---

## Priority order

Write in this order and stop when the return flattens. There is no value in
completing all 30 before measuring.

### Tier 1 — write first (highest search volume, already `VERIFIED_SPECS`)
`us-passport` · `us-visa` · `uk-passport` · `india-passport` · `india-evisa` ·
`canada` · `australia` · `schengen-visa` · `china-visa` · `japan`

These mostly have **distinct** specs already, so they are not the duplicate
problem — but they are where the traffic is, and richer copy lifts rankings.

### Tier 2 — the actual duplicate cluster (identical 35×45 specs)
`germany` · `france` · `italy` · `spain` · `netherlands` · `portugal` ·
`belgium` · `switzerland` · `austria` · `sweden` · `norway` · `poland` ·
`greece` · `ireland`

**This is the tier that fixes the Search Console report.** Every one of these is
currently ~80% identical to its neighbours.

### Tier 3 — unverified specs (`quirk` + spec verification together)
`nepal` · `egypt` · `brazil` · `mexico` · `argentina` · `chile` · `colombia` ·
`south-korea` · `singapore` · `malaysia` · `philippines` · `indonesia` ·
`thailand` · `pakistan` · `bangladesh` · `vietnam` · `sri-lanka` · `uae` ·
`saudi-arabia` · `qatar` · `turkiye` · `nigeria` · `south-africa` · `kenya` ·
`new-zealand`

These are flagged "not individually verified" in the UI today. Writing editorial
copy for them is the natural moment to verify the spec itself and move them into
`VERIFIED_SPECS`.

---

## Sources

**Rule: one official government source per country.** Aggregator sites
(schengenvisainfo, AXA, visa-agency blogs) may be used to *find* the rule but
never as the cited source — they are frequently out of date and occasionally
wrong. Two of the existing citations in
[`docs/passport-spec-sources.md`](../passport-spec-sources.md) are aggregators
and should be replaced as each country is rewritten.

| Country / group | Authority | Where to look |
|---|---|---|
| United States | Bureau of Consular Affairs, Dept of State | `travel.state.gov` — passport photo requirements |
| United Kingdom | HM Passport Office | `gov.uk` — "get a passport photo" (already cited, keep) |
| Canada | IRCC | `canada.ca` — passport photo specifications (already cited, keep) |
| Australia | Australian Passport Office, DFAT | `passports.gov.au` |
| New Zealand | Dept of Internal Affairs | `passports.govt.nz` |
| India (passport) | Passport Seva, MEA | `passportindia.gov.in` |
| India (e-Visa) | Bureau of Immigration | `indianvisaonline.gov.in` |
| Schengen states | Each member's foreign ministry / police issuing authority | national MFA site; EU Visa Code Annex for the common visa spec |
| Germany | Bundesdruckerei / BMI | `bmi.bund.de` — Passbild-Schablone (they publish a template) |
| France | ANTS | `ants.gouv.fr` |
| Japan | Ministry of Foreign Affairs | `mofa.go.jp` |
| China | National Immigration Administration / embassy consular service | `cs.mfa.gov.cn` |
| Biometric baseline | ICAO | **Doc 9303 Part 3** — the standard every ICAO member derives from |

**Verification note:** the domains above are the correct authorities, but exact
page paths move. Find the current page, record the full URL *and the date
checked* in `docs/passport-spec-sources.md`, and only then mark the spec
verified. Do not cite a URL you have not opened.

---

## Implementation

The template already supports this with one addition. In `lib/passport-specs.ts`:

```ts
export type CountryEditorial = {
  authority?: string;
  glasses?: string;
  headCovering?: string;
  expression?: string;
  recency?: string;
  quirk?: string;      // the one thing people get wrong here
  sourceUrl?: string;  // official page, recorded in passport-spec-sources.md
  checkedOn?: string;  // ISO date
};
```

Add `editorial?: CountryEditorial` to `PassportSpec`. The country page renders a
"What {country} asks for specifically" section when `editorial` is present and
omits it entirely when absent, so the pages can be filled in one at a time
without a second refactor and without half-empty sections shipping.

**Acceptance criteria per country**

1. ≥150 words of country-specific prose, not interpolated from the spec numbers
2. `sourceUrl` opened and `checkedOn` recorded in `docs/passport-spec-sources.md`
3. 4-gram overlap with every same-spec sibling **below 60%** (re-measure; the
   method is in the 2026-08-23 session commits)
4. No claim about a government requirement that is not on the cited page

---

## Effort

| Tier | Countries | Est. per country | Total |
|---|---|---|---|
| 1 | 10 | 30–40 min | ~6 h |
| 2 | 14 | 30–40 min | ~8 h |
| 3 | 25 | 45–60 min (includes spec verification) | ~20 h |

Roughly **14 hours to fix the Search Console report** (tiers 1–2), ~34 h for
everything. Tier 2 is the one with the measurable SEO payoff.

## The alternative, for the record

Consolidating identical-spec countries onto one `/passport-photo/35x45` page
with 301s would clear the duplicate report in a week and cost nothing to write.
It also gives up every "japan passport photo size" style query, which is the
entire reason these pages exist. **Not recommended** — but it is the cheap
option if the editorial work is never going to happen, and a half-written set of
pages is worse than either choice.
