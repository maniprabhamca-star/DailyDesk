# DiemDesk — Launch Checklist / Go-Live Runbook

Last updated 2026-07-12. The canonical, shareable go-live runbook. Deep per-item
detail lives in the memory files + git history; this is the ordered checklist.

**Status:** ~40+ tools LIVE on **https://diemdesk.com**, still behind the nginx
**basic-auth gate** (private launch — blocks crawlers, so no SEO yet). Deploy =
git `main` → VPS `root@2.25.71.126:/var/www/dailydesk` (pull + build + `pm2 restart`).

---

## ✅ Done (foundation is solid)
- [x] **Billing chain proven** (Stripe **test mode**): Checkout → subscription → webhook → DB `plan=pro`, verified end-to-end. Checkout hardened (stale-customer retry + owner alert on any checkout/webhook failure).
- [x] **Auth**: email/password, **password reset** (1-hr single-use token, branded email), **Sign in with Google** (activated + inert-safe).
- [x] **Business email**: Hostinger `support@` mailbox + `security@`/`privacy@` aliases; DNS (MX/SPF/DKIM/DMARC) in Cloudflare, verified.
- [x] **Transactional email**: sends via Hostinger SMTP as `support@diemdesk.com`, inbox-verified; branded reusable template (reset + **welcome on signup**); **real logo** served via nginx `/brand/` (basic-auth exempt); **DMARC = quarantine**.
- [x] **On-device batch** on 6 tools (Compress-Image/PDF, Convert-Image, Resize-Image, Rotate, Remove-Metadata).
- [x] `/overview` live page; docs artifacts; premium editor shell (Annotate/Redact/Edit).

## 🚀 Go-live sequence (do in order)

### 1 — Product & QA
- [ ] **Per-tool QA sweep** — every tool, mobile (375px) + desktop, edge/large files, no console errors ([[dailydesk-qa-testing-bar]]).
- [ ] Owner real-browser **verify placement** tools (pdf.js can't be tested in the sandbox): Pro v2 Redact boxes, Merge "Organize pages", Sign signature placement, Annotate text resize grip.
- [ ] **Flip owner-only features public** per [[dailydesk-pro-launch-checklist]] (Annotate/Redact/Edit/OCR gating), decide Hero Concept A, any tested `coming_soon` tools.

### 2 — SEO (nothing ranks until this + go-public)
- [ ] Full-site **on-page SEO audit**: title/desc/canonical/H1/OG/JSON-LD on every route; all routes in `app/sitemap.ts` ([[dailydesk-seo-and-differentiation]]).
- [ ] **OG images** — branded 1200×630 (+ per-tool variants).

### 3 — Stripe LIVE
- [ ] Recreate **Product + prices ($5.98/mo, $60/yr) + Founding coupon ($0.99 off, 1,000 cap) + `FOUNDING` code** in **Live mode** (test↔live are isolated).
- [ ] Put **live** `sk_live_…` + `whsec_…` (live webhook `https://diemdesk.com/api/stripe/webhook`, events `checkout.session.completed` + `customer.subscription.deleted`) in backend `.env`; keep `BILLING_ENABLED=true`.
- [ ] Update the live **Business name = DiemDesk**, support email `support@diemdesk.com`, statement descriptor `DIEMDESK.COM`.
- [ ] Optional final smoke test: **one real charge + refund**.

### 4 — Google OAuth
- [ ] **Publish** the OAuth consent screen (Testing → Production) so any Google user can sign in.
- [ ] Developer contact = Gmail **+** `support@diemdesk.com` (keep both).

### 5 — Reset test data (right before flipping public)
- [ ] `TRUNCATE user_events` (drop owner/test analytics).
- [ ] Reset test **Pro accounts to free** (e.g. `mcamanigandan@gmail.com`, cleared of test `stripe_customer_id`).

### 6 — GO PUBLIC (the flip)
- [ ] **Remove nginx basic-auth** (the `auth_basic` gate) so Google can crawl. `/brand/` + `/api/*` exemptions become moot but harmless.
- [ ] Set `NEXT_PUBLIC_SITE_URL`; confirm robots/crawl OK.
- [ ] **Submit sitemap** to Google Search Console + Bing.
- [ ] Post-deploy check: `curl` the live HTML **and** its referenced CSS/JS bundle = 200 + current hash (SW-cache incident lesson, [[dailydesk-qa-testing-bar]]).

### 7 — Harden (after launch settles)
- [ ] **DMARC `quarantine` → `reject`** once `rua` reports look clean.
- [ ] Cloudflare **Full-strict SSL** (currently Full w/ self-signed origin cert).
- [ ] VPS **Node 20 → 22**.
- [ ] **Counsel review**: Privacy/Terms, privacy/security claims, HEIC/HEVC patent flag ([[dailydesk-legal-licensing]]); **USPTO** trademark check on "DiemDesk".
- [ ] **Core Web Vitals** on the real domain.
- [ ] Swap email CSS-tile → richer real logo lockup if desired (already using the brand PNG).

## 🔭 Post-launch (growth engine)
- Monitor: checkout-failure alerts, DMARC `rua` reports, deliverability, tool error-rate SLOs + self-healing canary ([[dailydesk-self-healing-idea]]).
- Build during the free-gather phase: **AI layer** (Chat-with-PDF first, then AI Auto-Redact), **File Vault**, catalog gaps + beyond-market differentiators ([[dailydesk-pending-tasks]] §B–§E).
- Turn Pro billing on for real revenue when ready.

---
See also: `docs/stripe-setup-sheet.md` (Stripe fields + env), `docs/designs/` (design specs), and the `dailydesk-*` memory files for full context.
