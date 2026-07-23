# DiemDesk — Growth & Distribution Plan (drafted 2026-07-23)

**Goal:** maximise organic traffic and convert it. 67 free on-device tools are the acquisition engine; Pro is the monetisation. Owner's stated #1 priority: *"pull every single organic-traffic SEO win, reach the most customers, convert them."*

**Hard truth to plan around:** today the funnel dead-ends. `WAITLIST_MODE=true` means traffic cannot convert to revenue. **Every channel below is worth more after the revenue flip.** Sequence accordingly.

---

## 0. The one blocker
- ⭐ **Flip revenue on** (new Stripe $5.98/$60 prices → env price IDs → `WAITLIST_MODE=false`). Until then PR/backlinks build awareness we cannot bank.
- ⭐ **Un-gate the Bank Statement Converter** (needs the Tally Prime import test). 11 bank landing pages currently rank toward a locked door — this is the single biggest *wasted* existing traffic asset.

---

## 1. SEO — where we actually stand
**Done:** every tool page has title ≤60 / desc ≤155 / canonical / OpenGraph / SoftwareApplication+FAQPage JSON-LD; content pages now have WebPage+BreadcrumbList; sitemap covers all live tools; robots allows Googlebot; 50+ keyword landing pages; per-tool OG images.

**Gaps worth closing (ranked):**
1. **Internal linking is thin.** Tool pages don't cross-link to related tools in body copy. Add a "related tools" block + contextual links (biggest cheap ranking win).
2. **No "how-to" content layer.** We rank for tool names, not the *problems*. Ship guides: "How to reduce PDF size for a visa application", "How to Bates-number discovery documents", "How to convert a bank statement to Tally".
3. **IndexNow / faster discovery** — ping Bing/Yandex on new routes; GSC "Request indexing" for the 3 new tools.
4. **Core Web Vitals audit** — never formally measured. LCP on home (the editor showcase PNG) is the likely offender.
5. **AI-crawler robots decision** still open (GPTBot/ClaudeBot blocked). ChatGPT-search + Perplexity are already allowed, so citations can happen; revisit only if we want training-corpus presence.
6. **Language/geo expansion** — India-first: Hindi + regional landing pages for the highest-volume tools. Big lever, medium effort.

---

## 2. Home page — premium + conversion
Ranked by impact ÷ effort:
1. **⭐ Merge the live hero demo.** Hero Concept A (a working compress dropzone in the hero) is already built on branch `hero-live-demo`. "Try it without scrolling" is the single strongest conversion change available and it's already written.
2. **Proof over adjectives.** We have real benchmarks (27 MB → 6.8 MB where a rival managed ~1%; 1 GB rotate in 56 s). Put 2–3 numbers on the home page — specific numbers read premium; adjectives read like every competitor.
3. **The verifiable-privacy moment.** A small "Open DevTools → Network → watch nothing upload" callout. No rival can copy it. Turns a claim into a demonstration.
4. **Kill the trust vacuum.** No testimonials yet — don't fake them. Substitute: benchmark numbers, the on-device badge legend, "no signup / no watermark / no daily cap", and a live "files processed on-device" counter from the first-party beacon.
5. **Tighten above-the-fold.** One promise, one action. Everything else moves below.
6. **Speed** — the showcase PNG should be responsive/AVIF + priority-loaded; it likely owns LCP.

---

## 3. Digital PR
| Play | Notes |
|---|---|
| **EIN press release #1** | Already drafted + scheduled. Fix the Marietta→Atlanta location field before submitting. |
| **Product Hunt launch** | Do it *after* the revenue flip. Prep: gallery, 60-sec demo GIF, founder comment, first-hour supporters. One shot — don't waste it pre-monetisation. |
| **Show HN / Hacker News** | Angle that works there: *"I built 67 document tools that never upload your file — here's the DevTools proof."* Technical, verifiable, anti-SaaS. Post the engineering story, not marketing copy. |
| **Reddit** | r/privacy, r/pdf, r/selfhosted, r/legaltech (Bates), r/India + r/IndiaTax (statement converter), r/smallbusiness. Participate genuinely; never drive-by link. |
| **HARO / Qwoted / Featured** | Answer journalist queries on privacy, document security, remote work. Slow but yields high-DA links. |
| **Founder story angles** | "Why I made document tools that can't see your documents"; "The privacy tax of free PDF tools". |

---

## 4. Backlinks & directories
**Tier 1 — do first (high authority, free, permanent):**
- Product Hunt · AlternativeTo · SaaSHub · Slant · Capterra / GetApp / G2 (free listings)
- **Privacy Guides / PrivacyTools** (perfect brand fit — the on-device story is exactly their criterion)
- GitHub "awesome" lists: awesome-privacy, awesome-selfhosted-adjacent, awesome-pdf
- Chrome Web Store + Google Play (once the extension / TWA ship — each is a high-authority backlink *and* a distribution channel)

**Tier 2 — tool aggregators & niche:**
- Toolfolio, FreeTools directories, "best free PDF tools" roundup posts (outreach to the authors — offer the privacy angle as a differentiator worth adding)
- Indian CA/accounting forums + communities (statement converter), legal-tech directories (Bates), education/accessibility lists (PDF→Audio, PDF/UA)

**Tier 3 — earned:**
- Comparison/alternative pages already exist (`/smallpdf-alternative`, etc.) — these attract natural links; promote them.
- Write the "how-to" guides (§1.2); guides earn links, tool pages rarely do.

**Rule:** never buy links, never spam. One Privacy Guides listing beats 100 directory dumps.

---

## 5. Product-led loops (compounding, no ad spend)
- **Self-destruct encrypted shares** (Tier-1 Pro) — every recipient sees DiemDesk. The only true viral loop on the roadmap. Prioritise it.
- **Link in Bio** — public `/u/handle` pages are indexable surfaces pointing at us.
- **TWA (Play Store)** — store listing = distribution + authority.
- **Changelog + email list** — capture the waitlist now; it's the launch-day audience later.

---

## 6. Sequencing (do it in this order)
**Now (0–30 days)**
1. Revenue flip + un-gate the statement converter (unblocks everything).
2. Merge the live hero demo; add benchmark proof + DevTools privacy callout to home.
3. GSC: request indexing for the 3 new tools; add internal "related tools" linking.
4. Tier-1 directories (Privacy Guides, AlternativeTo, SaaSHub, awesome lists).
5. EIN PR #1 (fix the location field).

**Next (30–60 days)**
6. Write 5–10 "how-to" guides targeting problems, not tool names.
7. Show HN + Reddit (genuine participation).
8. Core Web Vitals pass.
9. Service-worker soak → TWA → Play Store listing.

**Then (60–90 days)**
10. Product Hunt (only once billing converts).
11. Hindi/regional landing pages for top India tools.
12. Self-destruct shares (viral loop) + outreach to roundup authors.

---

## 7. Measurement
Cloudflare Web Analytics (cookieless) + the first-party beacon + GSC. Watch: impressions→clicks per tool page, which tools convert to signup, and — after the flip — signup→Pro. Kill channels that don't move those, double down on ones that do.

**Explicitly NOT doing:** paid ads (no LTV data yet), link buying, fake reviews, AI-spun content.
