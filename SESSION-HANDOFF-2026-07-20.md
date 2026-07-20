# DiemDesk — Session Handover, 2026-07-20

Paste this into a fresh session. Everything below is **verified against code, prod, git or the live
Stripe API on 2026-07-20** — not recalled. Where something is unverified it says so.

---

## 0. THE ONE-PARAGRAPH VERSION

DiemDesk (https://diemdesk.com) is a live, public, privacy-first document toolkit — ~57 tools, ~53 of
which run entirely on-device via WebAssembly. It is **fully built and fully monetisable today**:
Stripe is live and keyed, the site is public and crawlable. **The single thing standing between the
product and its first payment is `WAITLIST_MODE = true` in `frontend/lib/flags.ts`.** Today's session
corrected a chain of claims that had drifted from what the code actually does (press release, site
copy, Stripe checkout copy), and **rebuilt + deployed the offline service worker** that had been
silently removed in June, taking the offline feature with it while the marketing copy kept advertising
it. Next: flip billing, soak the worker a week, then Android via TWA.

---

## 1. ⚠️ READ THIS BEFORE TRUSTING ANY MEMORY

**Three times today I asserted something from memory that the code contradicted.** All three are now
corrected in memory, but the lesson generalises:

| I claimed | Reality |
|---|---|
| "Stripe billing isn't built — it's the last blocker" | Fully built, live, keyed since 2026-07-03 |
| "The site is behind basic-auth" | Public since 2026-07-13, HTTP 200 |
| "The `/overview` + `/security` offline copy is overclaiming" | **The copy was true when written.** The *code* regressed — a later commit deleted the feature |

**Rule for the next session: verify the load-bearing fact first.** One `ls`, one `curl`, one
`git log` beats an hour of reasoning from stale notes. This applies to memory files too — they are
point-in-time observations.

---

## 2. STACK & INFRA (verified)

- **Frontend:** Next.js 14 App Router + TypeScript + Tailwind. `frontend/`
- **Backend:** Node/Express + PostgreSQL + Redis. `backend/`
- **Host:** VPS `root@2.25.71.126:/var/www/dailydesk`, PM2 + nginx, Cloudflare in front
- **Deploy:** `git push origin main` → on VPS `cd /var/www/dailydesk && git pull && cd frontend && npm run build && pm2 restart dailydesk-frontend`
- **SSH works from the dev machine** (verified today — `ssh root@2.25.71.126`)
- PM2 processes: `dailydesk-frontend`, `dailydesk-backend` (2 cluster), `dailydesk-admin`
- **Repo:** https://github.com/maniprabhamca-star/DailyDesk, branch `main`, in sync with origin

---

## 3. WHAT SHIPPED TODAY (6 commits, all pushed + deployed)

```
1e2d079  test(pwa): regression harness for the service worker
5bc5643  feat(pwa): restore offline caching, without the bug that broke it
d8b07fd  fix(copy): stop claiming offline support, and own why it is gone
ea8791c  docs(design): browser extension v1 mockup
9b8c593  fix(pwa): manifest no longer claims offline support
a5c8878  docs(pr): PR #1 final — accuracy pass against the codebase
```

Plus **live Stripe API writes** (not in git): statement descriptor + both product descriptions.

---

## 4. 🔴 THE SERVICE WORKER — DEPLOYED TODAY, IN A SOAK WINDOW

### What happened (root cause verified against commit `407869a`)

Offline **used to work**. `407869a` shipped a caching service worker. `89480e4` then **deleted it** to
fix a "stale app shell" bug, and never updated the copy that advertised it. So the site spent weeks
claiming a feature that had been removed.

**The actual bug in the old worker** (NOT "caching is dangerous"):

```js
.catch(() => caches.match(req).then(hit => hit || caches.match('/')))
```

That `caches.match('/')` served the **home page's HTML for any route** on a network wobble — and that
`/` entry was frozen at install time by `addAll(['/'])`, refreshed only by a successful visit to `/`
itself. One flaky request on `/compress-pdf` returned a months-old shell referencing chunk hashes the
live deploy no longer served.

Two missing `res.ok` guards made it **permanent**: the resulting 404s, and **the 502 nginx returns
during every PM2 restart window**, were both written in as the permanent cache entry for their URL.

The hardcoded `VERSION = 'v1'` only explains why nobody could dig out — commit `8fde731` edited that
file for the rebrand and left `VERSION` untouched, proving a hand-maintained constant is not a mechanism.

### What is deployed now

| File | Role |
|---|---|
| `frontend/public/sw.template.js` | **Source of truth.** Never edit `public/sw.js` |
| `frontend/scripts/gen-sw.mjs` | Stamps `BUILD_ID` from the git SHA; wired as `prebuild` + `predev` |
| `frontend/public/sw.js` | **GENERATED + gitignored** |
| `frontend/public/sw-kill.json` | Remote kill switch |
| `frontend/scripts/test-sw.mjs` | `npm run test:sw` — 17 tests |

**Strategy per asset class:**
- `/_next/static/**` → cache-first in unversioned `dd-immutable`. URLs *are* content hashes, so a wrong entry is impossible. **Never purged on activate** — deleting it breaks tabs open on the previous build (`ChunkLoadError`).
- Documents → network-first, 3.5s timeout, **cached copy matched SAME-URL ONLY, no fallback page**. An unvisited route fails honestly rather than rendering a wrong one.
- `/qpdf` `/libheif` `/pdfjs` `/fonts` + engine wasm → stale-while-revalidate (self-heals in one load)
- `/models` + `/ort` (85MB) and `/api/*` → **never cached**
- `share_target` POST → preserved verbatim
- No `skipWaiting` — a tab on build N keeps worker N until it closes

**Verified on prod after deploy:** `/sw.js` 200 with `BUILD_ID=1e2d079-mrtkpgyn`, `Cache-Control:
no-cache` + `cf-cache-status: BYPASS`; `/sw-kill.json` 200 no-cache `disabled:false`; 17/17 tests on
the VPS; `next build` exit 0; `/ /security /overview /pricing /compress-pdf /sejda-alternative` all
200; **zero live `caches.match('/')` in the shipped worker** (only the comment documenting the old bug).

### 🔴 KILL SWITCH — no deploy needed

```bash
ssh root@2.25.71.126
cd /var/www/dailydesk/frontend && sed -i 's/"disabled": false/"disabled": true/' public/sw-kill.json
```
Every worker wipes its caches and unregisters within the hour (immediately on next activate).

### ⏳ SOAK WINDOW: 2026-07-20 → 2026-07-27

**Watch for:** any page or style that looks like an **older build**. If seen → flip the kill switch,
don't debug live.

**After the soak passes**, re-add the offline claim to `/overview` + `/security` — but only the TRUE
version: *"once you've used a tool online, it keeps working in that browser without a connection"*
(per-tool, per-browser, evictable). **"Works fully offline" is unreachable at ANY implementation
level** — engines are lazy-fetched per tool (`lib/mozjpeg.ts:18`, `lib/qpdf.ts:44`,
`lib/pdf-render.ts:71`) and `public/` is ~111MB (models 45MB + ort 40MB + fonts 17MB), so precaching
everything is impossible. It was also never true for the 9 server tools + 3 AI tools + Vault sync.

**Run `npm run test:sw` before ever touching the worker.** Test 1 reproduces the original incident.

---

## 5. 💰 MONETISATION — ONE FLAG FROM REVENUE

**Stripe is BUILT, LIVE and KEYED.** Verified by probing prod: a bad-signature POST to
`/api/stripe/webhook` returns **HTTP 400 with a genuine Stripe signature error** (dormant would be
200 "billing not configured"). `backend/src/routes/stripe.js` has checkout (monthly+yearly), Customer
Portal, signature-verified webhook (`checkout.session.completed`→`plan='pro'`,
`customer.subscription.deleted`→`free`), the stale-customer retry, and `notifyOwner()` on both failure
paths. `BILLING_ENABLED = true` already.

### What actually blocks revenue

| # | Blocker | Where |
|---|---|---|
| 1 | **`WAITLIST_MODE = true`** — the Pro CTA collects emails instead of opening Checkout | `frontend/lib/flags.ts:12` |
| 2 | **Live prices are the OLD $4.99/$49**, not the decided **$5.98/$60** | Stripe |
| 3 | `PRO_UPSELL_ENABLED` off — the 100MB cap never pitches Pro | `flags.ts:22` (`NEXT_PUBLIC_PRO_UPSELL=1`) |

**Verified live Stripe objects (2026-07-20):**
- Account `acct_1OS29LKn6TWL2bZM`, `display_name` = "DiemDesk"
- Monthly `price_1TpJufKn6TWL2bZMirMGVg3g` = **$4.99** on `prod_Uoxq27C41HCGt0`
- Annual `price_1TpJvuKn6TWL2bZMgYviDuSn` = **$49** on `prod_UoxrQpYXQ5d69a`
- **`statement_descriptor = "DIEMDESK"` set on both today** (subscription descriptor precedence is
  Invoice → **Product** → account default, so the product-level setting is the one that reliably wins)
- **Both product descriptions rewritten today** — they had been promising "70 AI actions a day",
  "unlimited File Vault storage" and OCR **on the Checkout page**, none of which exist.

**Economics:** ~**6 Pro users covers all fixed infra**. That is why flipping the flag is the highest-value
next action — it answers a question that reshapes every other decision on this list.

### Current free/Pro limits (verified)
- `FREE_MAX_BYTES = 100 MB` (`frontend/lib/plan.ts:19`)
- `FREE_MAX_BATCH = 1` (`plan.ts:76`) — Merge + JPG→PDF exempt
- Office conversions: **3/day free** (`backend/src/routes/convert.js:32`), Pro unlimited — **these UPLOAD to a server** (`multer.diskStorage`)
- Statement quota: `STATEMENT_FREE_PAGES=5`, enforcement behind `STATEMENT_QUOTA_ENABLED` (**off**)

---

## 6. 🏦 BANK STATEMENT CONVERTER — the paid flagship, owner-gated

The strategic bet: bank statement PDF → balance-verified table → Excel/CSV/**Tally**, India-first.
Engine solves the balance equation `balance[i] = balance[i-1] − debit[i] + credit[i]` as a constraint,
which identifies column roles **and** proves the extraction — verified on Axis 43/43 and Wells Fargo
29/29 against the banks' own printed totals.

**Status: BUILT, owner-gated** (`/bank-statement-converter` → `coming_soon` in `lib/tool-flags.tsx`)
and deliberately **excluded from `sitemap.ts`**.

### ⏳ BLOCKED ON OWNER: the Tally test
Owner said 2026-07-20: *"we can enable the statement quota for the bank convertor but before that let
me test the tally."* **Ask how it went before touching the converter.** Precondition: import a
generated Tally XML into real Tally Prime, confirm it loads and amounts land correctly (negative
AMOUNT = debit). Also run 3-4 real statements end-to-end.

### Agreed plan once Tally passes
**Un-gate WITH the quota on** — not free. Set `STATEMENT_QUOTA_ENABLED=true` + `STATEMENT_FREE_PAGES=5`,
flip the tool flag, **add it to `sitemap.ts`**. Rationale: 11 bank landing pages + 3 workflow pages
currently rank toward a **locked door**; un-gating free gives away the paid flagship. With the quota
on, over-limit users become a *qualified* waitlist.

⛔ **Do NOT expand bank pages until this is un-gated — it scales a leak.**

**Why the caution:** a converter that silently gets a number wrong is unlike any other tool — the user
can't eyeball the error and it lands in their books.

---

## 7. 📰 PRESS RELEASE (EIN) — ready, needs owner action

**Final copy:** `diemdesk-EIN-newswire/pr1-FINAL.md` (commit `a5c8878`).
**Google Doc created today:** https://docs.google.com/document/d/1gleszZB5rhQG_By0zSRyKrD-NY1WFS6z75teJTgZXL8/edit
(EIN's original doc `1vTVxSuXRq6_LPKtkHmJc_4EXADXEJjBLc0UhK2t2ig0` is untouched and intact.)

Body = **352 words** (EIN requires 300+), zero second-person outside quotes.

**Five accuracy problems were found by checking every claim against the codebase and fixed:**
1. Title/About claimed the whole toolkit never uploads — **four free, publicly listed tools upload to a server** (`pdf-to-word`, `word-to-pdf`, `excel-to-pdf`, `powerpoint-to-pdf`; `convert.js` `multer.diskStorage`). The release invites journalists to "open the network tab and check" — which would have **disproved it on an advertised tool**. Title rescoped; the exception is now stated in para 1.
2. Advertised **redact**, which is absent from `sitemap.ts` and owner-gated → removed, moved to the Pro sentence
3. "free and **unlimited**" vs the 100MB cap → "no daily limits… on files up to 100 MB"
4. Claimed it "keeps working without a connection" → removed
5. Founder title added ("Jayaprabha Ranganathan, founder of DiemDesk")

### ⚠️ OWNER TO DO
- **Set the EIN form's Location field to `Atlanta, Georgia, United States`** — it currently says
  Marietta and would contradict the Atlanta dateline on the published page. Update
  `ein-submission-record.md:15` too.
- **The publish date has slipped** — it was scheduled ~14-15 July, it's now the 20th and still in
  revision. **Reschedule with Mary (EIN press team).**
- PR #2 (`pr2/press-release.md`) uses `MARIETTA, Ga.` throughout — align if unpublished.

---

## 8. 🔍 SEO — healthy, one open decision

**Verified:** Googlebot is **NOT blocked**; classic search indexing is fine. 64 sitemap routes.
`frontend/app/robots.ts` is allow-all.

**Cloudflare's *managed* robots.txt blocks AI crawlers:** `GPTBot`, `ClaudeBot`, `CCBot`,
`Google-Extended`, `Applebot-Extended`, `meta-externalagent`, `Bytespider`, `Amazonbot` → `Disallow: /`.

**⛔ MY RECOMMENDATION: LEAVE IT BLOCKED.** I initially called this "the cheapest win on the board" and
**that was overstated** — two corrections: (a) `OAI-SearchBot` and `PerplexityBot` are **already
allowed**, so ChatGPT-search and Perplexity can cite the site today; (b) I claimed `Google-Extended`
feeds AI Overviews — **it doesn't**; it governs Gemini/Vertex grounding, not Search ranking or AI
Overviews inclusion. What's blocked is mostly **training** crawlers, and the site's own Content-Signal
already declares `ai-train=no` — so the block is consistent with a deliberate stance. Fix location if
ever wanted: Cloudflare dashboard → Security → Bots → Manage robots.txt (not a repo change).

**Highest-ROI SEO next steps** (from a repo-audited research pass): BreadcrumbList + ItemList JSON-LD
(verified **zero** hits repo-wide), raise `/security` from `priority: 0.3`, a per-tool **"bytes sent to
a server"** transparency table (incumbents structurally cannot publish that), then ~6 genuinely missing
bank pages.
**Traps to skip:** HowTo schema (deprecated 2023 — `tool-page.tsx`'s `steps: string[]` prop is a trap),
combinatorial "PDF to X" page generation, `aggregateRating` on own schema, tuning `changefreq`/`priority`.

---

## 9. 📱 PLATFORM STRATEGY — DECIDED (see memory `dailydesk-platform-strategy`)

| Option | Effort | Verdict |
|---|---|---|
| **Android via TWA** (Trusted Web Activity — Play listing rendered by the user's Chrome) | **~1 wk** on a working PWA | ✅ do, after soak + billing |
| Native Capacitor iOS+Android | **8-12 months** | ❌ no |
| Browser extension | ~10 wks + 2-4 wk review | ⏸ defer |

**Why not native:** 57 tools × 2 platforms ≈ 114 QA passes, then a **permanent 3× QA tax on every
future tool**. iOS has no TWA equivalent → parked. India ≈ 95% Android, so TWA gets nearly all the upside.

**Runbook:** `docs/designs/android-twa-runbook.md`. Manifest verified **TWA-ready 9/9**.

**⚠️ assetlinks.json gotcha:** the SHA-256 fingerprint **only exists after the first AAB upload** under
Play App Signing. **Never deploy a placeholder** — a wrong fingerprint fails verification and ships an
app WITH a URL bar.

**Extension mockup:** `docs/artifacts/mockup-browser-extension.html`. Design thesis = a live
**zero-byte network counter** (uncopyable by upload-based rivals; Adobe's extension has 337M users).
Deferred because both its revenue paths dead-end at `/pricing`, which today collects waitlist emails.

**Entity / Play facts:** `JPNM Rapid Universe LLC.`, **D-U-N-S `13-161-1478`**, Smyrna GA. D-U-N-S
already exists → **Organization Play account path is open, no 30-day wait**.
**CHECK: play.google.com/console → ⚙️ Settings → Developer account → Account details → `Account type`.**
Personal ⇒ 12 testers × 14 consecutive days before publishing; Organization ⇒ no gate.
⚠️ Whichever entity registers becomes the **public developer name** on the listing.

---

## 10. ✅ IMMEDIATE NEXT STEPS, IN ORDER

1. **[OWNER] Tally test** → then un-gate the converter with the quota on + add to sitemap
2. **[OWNER] EIN**: Location field → Atlanta; reschedule the publish date with Mary
3. **[OWNER] Play Console** → check `Account type`
4. **Fix Stripe prices to $5.98/$60**, then **flip `WAITLIST_MODE = false`** ← the highest-value action
5. **Soak the service worker to 2026-07-27**, then restore the (true, narrow) offline claim
6. **Then** TWA (~1 wk)
7. SEO: BreadcrumbList/ItemList JSON-LD, `/security` priority, per-tool transparency table

**Other open items:** home-page de-clutter (~65 tiles need a `/tools` page) · real editor screenshot ·
File Vault (unbuilt) · OCR public launch · AI go-live needs `ANTHROPIC_API_KEY` on the VPS ·
Google OAuth consent screen → Production · reset test data (`TRUNCATE user_events`) · counsel review
(incl. **the one-LLC-for-three-brands liability question**) · real-phone mobile QA · DMARC → `p=reject`
· Cloudflare Full (strict) · USPTO check.

---

## 11. WORKING AGREEMENTS (from memory — honour these)

- **Mock up UI before building**; build **exactly** to the approved mockup, flag deviations first
- **Every design/PR artifact gets committed** (`docs/designs/`, `docs/artifacts/`, `diemdesk-EIN-newswire/`)
- **Auto-update `/overview` + master-roadmap after every tool ship** — counts are catalog-derived, never hand-typed
- **Be proactive:** problem → fix → quantified benefit → "want me to do it?". Just do cheap/reversible things; ask for risky ones
- **No AI-sounding copy.** Human brand voice
- **Never auto-deploy to prod without approval.** Secrets are set by the owner over their own SSH, never pasted in chat
- **Never touch Edit PDF core logic**
- **Give the EXACT dashboard choice**, not a vague either/or
- **Write summaries/handoffs to a file** so they're copyable
- **Competitor benchmark before every new tool**; name competitors precisely on `/compare` + `*-alternative` pages
- **Per-tool QA bar:** code review, e2e, mobile + desktop, edge cases, large-file, perf, no console errors
- ⚠️ **When a claim is corrected, grep the WHOLE surface** — repo, Stripe, manifest, press archive. Today the same stale claim was found in three separate places.
