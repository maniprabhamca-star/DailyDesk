# DiemDesk — Session Handover (2026-07-22)

Paste this into a fresh session to continue. It's self-contained. Memory files hold the durable detail — this is the map + current state + next steps.

---

## 0. RULE #1 — verify, don't trust recall
On load-bearing facts (is X built? is the flag on? does the schema match?), **check first** (git log, grep, a curl, an ssh query). Multiple past sessions were wrong from memory and settled in seconds by a check. Memory is point-in-time.

---

## 1. WHAT DIEMDESK IS
Privacy-first document/utility toolkit. **65 tools live** at **https://diemdesk.com** (public, HTTPS via Cloudflare). Product name = **DiemDesk** (memory slugs still say `dailydesk-*`). Moat: on-device processing (files never uploaded for in-browser tools — verifiable in DevTools Network tab), honest server-tier for the few that must upload, AI that cites its sources, and privacy people can check.

**Business:** legal entity **JPNM Rapid Universe LLC** (Marietta GA, IRS/legal only — never customer-facing). Checkout name = DiemDesk. Owner: Mani (maniprabhamca@gmail.com).

## 2. STACK & DEPLOY
- **Frontend:** Next.js (app router) in `frontend/`, PM2 `dailydesk-frontend` on :3000.
- **Backend:** Express in `backend/`, PM2 `dailydesk-backend` (cluster, 2 procs) on :4000 (localhost only).
- **DB:** Postgres (users.id is **UUID** — bit me twice). Redis for rate-limit + AI budget. Schema: `backend/src/db/schema.sql` (applied by hand on VPS via node one-liners, not auto-migrated).
- **VPS:** `root@2.25.71.126` (key `~/.ssh/id_ed25519`). Shared box — Serplytic/BAP containers also run here (ports 8090/8108/etc are NOT DiemDesk).
- **Deploy loop (memorize):** commit + push local → on VPS `cd /var/www/dailydesk && git checkout -- frontend/package-lock.json 2>/dev/null; git pull --ff-only` → `cd frontend && npm run build && pm2 restart dailydesk-frontend` (and/or `node --check` + `pm2 restart dailydesk-backend`). New backend dep → `npm ci`. Schema change → run the new block via a node script on the VPS.
- **Verify pattern:** everything gets a real e2e test before "done" — headless node tests bundled with esbuild for libs, real API calls with an owner JWT for endpoints, browser-pane JS (`getComputedStyle`/bounding-rects) for layout (the screenshot tool is flaky — use JS checks). Owner JWT: `jwt.sign({userId}, process.env.JWT_SECRET)` from a node script in `/var/www/dailydesk/backend`. Canary bypass header: `x-canary: <CANARY_TOKEN from .env>`.

## 3. ⭐ THE ONE THING BLOCKING REVENUE
The site is **live, public, Stripe-wired, all features built** — but:
1. **`WAITLIST_MODE = true`** in `frontend/lib/flags.ts` → Pro CTA = waitlist, nobody can pay. This is the single flag between "brochure" and "business."
2. **Live Stripe prices are the OLD $4.99/$49**, not the decided **$5.98/mo + $60/yr** (founding $4.99/mo first 1,000 for life). Stripe prices are immutable → must create NEW prices + update `STRIPE_PRICE_ID`/`STRIPE_PRICE_ID_YEARLY` in the VPS backend `.env` BEFORE flipping the flag, or founders lock the wrong anchor.
Stripe is otherwise BUILT + LIVE + verified (checkout→webhook→plan=pro proven in test mode; portal enabled; descriptor `DIEMDESK.COM`). See [[dailydesk-freemium-gating-status]].

## 4. WHAT'S BUILT & LIVE (this session's big deliverables)
All shipped + prod-e2e-verified this session. **AI/Pro tools are gated `coming_soon` = owner-only** until Pro launch (flip flags + `AI_ENABLED=true` + top up Anthropic credit).

**AI document suite (8, all gated, Haiku, per-user + $5/day USD kill-switch):** Chat-with-PDF, Summarize (page-cited), Translate (glossary/tone/notes), Question-generator (Anki/Moodle export), PDF→Excel AI clean-up, semantic Compare ("what changed in meaning"), **AI find-personal-info in Redact** (AI points → on-device engine burns → human approves each box), natural-language ⌘K. Backend `routes/ai.js` (shared `preflight`/`callClaude`/`packContext`). On-device exports: `lib/docx.ts` + `lib/ai-export.ts` (PDF/DOCX/CSV/GIFT).

**File Vault (Pro, 4/4 phases done):** `/file-vault` E2E-encrypted storage. `lib/vault-crypto.ts` (Argon2id via hash-wasm + AES-256-GCM envelope, PBKDF2 fallback, filenames sealed, recovery key). `routes/vault.js` ciphertext-only chunked storage (`/var/lib/dd-vault`, 10GB quota). Recycle bin (30-day). ⏳ owner never did the real create-vault ceremony (test vaults cleaned).

**Link in Bio (Pro):** `/link-in-bio` editor + public server-rendered `/u/<handle>` with OG tags. `routes/bio.js` (sanitized config, reserved handles, 7 themes, views).

**Tier-2 apps (FREE, account-synced, new 'account' catalog badge):** `/notes` (≤10 free/Pro unlimited), `/habits` (≤5, streaks), `/budget` (≤50/mo, category totals). `routes/notes.js|habits.js|budget.js`.

**Receipt Scanner (Pro):** `/receipt-scanner` — Tesseract OCR → parse merchant/total/date/category → editable → save to Budget. `routes/receipts.js`.

**Server conversions (3/day free→Pro):** `/pdf-to-powerpoint` (LibreOffice impress_pdf_import), `/pdf-to-pdfa` (Ghostscript PDF/A-2b). `convertRoute` in `routes/convert.js` generalized w/ `buildCmd`. Canary now monitors both.

**Free on-device:** `/repair-pdf` (rebuild broken xref), `/scan-to-pdf` (camera→PDF).

**UX this session:** home de-clutter (calm text-tab rail filters in place, no more chip wall; removed redundant filter box); mobile footer 2-up + inline legal; footer hover-arrows + Tools column w/ Pro/AI lineup; **/why-diemdesk** + **/changelog** pages (both live, in footer/sitemap); Redact select-then-remove UX + fragment-aware AI matcher.

## 5. SECURITY (audited + hardened this session — see [[dailydesk-security]])
- **Origin is CF-ONLY** (iptables v4+v6 accept 80/443 only from Cloudflare ranges, weekly cron refresh) → direct-IP hits time out → `CF-Connecting-IP` unspoofable → all IP rate-limits trustworthy, WAF can't be bypassed.
- **HSTS added.** Auth endpoints capped 20/15min (login brute-force). AI/convert/vault own limiters. fail2ban + auditd + SSH key-only active.
- Bot defense = Cloudflare (site 100% behind it). ⏳ **Owner-only CF dashboard toggles (can't do from server):** Bot Fight Mode, a rate-rule on /api/auth*, Security Level Medium. Also optional: Full-strict SSL upgrade.

## 6. MANDATORY STANDING RULES (in memory — follow every task)
- **Changelog:** every meaningful ship auto-adds a user-facing entry to `frontend/lib/changelog.ts` (the /changelog page). Never wait to be asked. [[dailydesk-changelog-rule]]
- **/overview + master-roadmap auto-current** after every ship (counts derive from catalog `liveToolCount` — never hand-typed). [[dailydesk-feedback-keep-overview-current]]
- **Mock-first:** any UI/design → build the mockup, get approval, THEN code. Publish mockups as **Artifacts** (Browser-pane delivery proved unreliable). [[dailydesk-feedback-match-mockup]] [[dailydesk-feedback-home-placeholders-mockups]]
- **Design intelligently + every interaction needs a visible affordance** (learned hard: hidden tap-gesture, then badge clutter, then select-then-remove). [[dailydesk-feedback-design-intelligently]]
- **Be proactive:** recommend problem→fix→quantified-benefit→"want me to?"; just do cheap/reversible, ask for risky. [[dailydesk-feedback-be-proactive]]
- **Competitor benchmark + honest sourced comparisons** before new tools; name rivals on /compare with as-of dates + disclaimers. [[dailydesk-feedback-competitor-benchmark]] [[dailydesk-competitor-comparison-policy]]
- **Copy voice:** no AI-tells; human brand voice. [[dailydesk-copy-voice]]
- **QA bar:** code review + real e2e + mobile+desktop + edge/large-file + no console errors before every ship. Don't cram multiple big builds into one session half-baked. [[dailydesk-qa-testing-bar]]
- **SEO per task:** title ≤60 / desc ≤155 / canonical / JSON-LD / OG + **add new routes to `app/sitemap.ts`**. [[dailydesk-seo-and-differentiation]]
- **Gating truth:** gate SCALE not quality. FREE = on-device + Tier-2 apps; METERED (3/day→Pro) = server conversions/OCR; PRO = AI suite, Vault, Link-in-Bio, Receipt Scanner, Edit/Redact/OCR. [[dailydesk-freemium-gating-status]] [[dailydesk-pro-launch-checklist]]
- **AI cost control:** Haiku + per-user cap + revenue-pegged global kill-switch. [[dailydesk-ai-cost-control]]
- **Handovers/summaries → write to a FILE** (this one) so the owner can copy. [[dailydesk-feedback-copyable-summaries]] [[dailydesk-feedback-context-handover]]

## 7. PENDING — ranked by leverage
1. **⭐⭐ FLIP REVENUE ON:** create new Stripe prices ($5.98/$60 + founding coupon) → update env price IDs → set `WAITLIST_MODE=false`. Short task, disproportionate payoff. (§3)
2. **⭐ Tally test → un-gate Bank Statement Converter.** Owner precondition: import a generated Tally XML into real Tally Prime, confirm ledgers/debit-sign; run 3-4 real statements. THEN set `STATEMENT_QUOTA_ENABLED=true`+`STATEMENT_FREE_PAGES=5`, flip `/bank-statement-converter` flag, add to sitemap. The paid flagship — 11 bank landing pages currently rank toward a locked door. [[dailydesk-statement-converter]]
3. **Owner click-tests (features are API-verified, need human UI pass):** create the REAL File Vault (real passphrase, SAVE recovery key — unrecoverable by design); the AI trio; the Redact AI-find flow; Notes/Habits/Budget/Receipt. Also: incognito "Continue with Google" with a non-test Gmail to confirm consent screen is published.
4. **Anthropic credit** only ~$4.99 (fine for owner testing) — **top up before public AI launch**; then `AI_ENABLED=true` + flip 4 AI flags coming_soon→pro. [[dailydesk-anthropic-api-setup]]
5. **CF dashboard toggles** (owner): Bot Fight Mode, /api/auth* rate rule, Security Medium. (§5)
6. **EIN press release** owner actions: Atlanta dateline vs the form's Marietta Location field; PR publish. [[dailydesk-pr-archive]]

## 8. SMALLER / OPTIONAL
- **Home editor showcase** still a synthetic mockup → replace with real screenshot (owner picks: they capture vs I generate a framed real pdf.js render). Parked on owner choice.
- **Artifacts drift:** `docs/artifacts/overview-status-board.html` deep-stale (2026-07-11 cards) — got a "shipped-since" block but cards not rewritten. Offer: script-generate both artifacts from catalog so they never drift.
- **Canary gaps:** the 9 auth/Pro-gated tools (AI/Vault/Notes/Habits/Budget/Link-in-Bio/Receipt) aren't monitored (need a logged-in canary user).
- **Long-tail/beyond-market:** PDF→audio(TTS), Bates numbering, PDF→Markdown, PDF/UA, e-Invoice (Factur-X/ZUGFeRD), RFC-3161 timestamp, DiemDesk Studio (parked on `diem-studio` branch).
- **Infra:** Cloudflare Full-strict SSL; Node 20→22; unblock AI crawlers in CF managed robots.txt (GPTBot/ClaudeBot/Google-Extended currently Disallow:/ — deliberate, owner not decided).

## 9. KNOWN GOTCHAS (save yourself the pain)
- **users.id = UUID.** FK columns must be UUID. Test-user inserts need `name` (NOT NULL, no default).
- **schema.sql had duplicate/abandoned blocks** (old bio_pages/bio_links w/ wrong cols shadowed the real one via CREATE IF NOT EXISTS). Check for dupes before trusting a `CREATE IF NOT EXISTS`.
- **Literal control chars** sneak into regexes written via Bash heredocs/`node -e` (NUL, \p{Cc}) → git sees the file as binary / syntax error. Write such files with the Write tool or use `\uXXXX`/`\p{Cc}` escapes; verify with a control-byte scan.
- **ImageMagick on VPS blocks `@file`** annotate (security policy) — inline text for test images.
- **Bash tool blocks commands containing hidden control chars** — put test scripts in the scratchpad and pipe via ssh stdin.
- **Screenshot browser-pane tool is flaky/times out** — verify layout with `javascript_tool` (bounding rects / computed styles) instead.
- **`git pull` on VPS** often conflicts on `frontend/package-lock.json` — `git checkout --` it first.

## 10. SESSION HYGIENE (owner is token-conscious)
- Keep replies tight. Compact/clear at TASK BOUNDARIES, not mid-task. Same task + same window → just continue. `/resume` to reread old sessions; nothing is deleted.

---
**Latest commit:** `dac3171`. Working tree clean. All of the above is deployed and live. Memory index = `MEMORY.md` (~55 files, all current as of this session).
