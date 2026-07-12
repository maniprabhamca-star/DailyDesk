# DiemDesk — Wednesday go-public runbook

Tight, ordered launch runbook for the public + press-release launch. "(Claude)" =
I run it; "(You)" = your manual step. Full context: `docs/launch-checklist.md`.

**Good news:** SEO/OG is already built and correct — robots allows crawling +
points to the sitemap, sitemap covers all routes, canonicals resolve to
diemdesk.com, and a branded 1200×630 OG image is wired. So launch is mostly
flipping switches, not building.

---

## Before Wednesday (do now / this week)
- [ ] **(You) Decide tool gating** — which currently owner-only tools ("coming soon": e.g. Annotate, Edit, Redact, OCR) go public at launch. Tell Claude the list → Claude flips the gate. *This is the one code decision left.*
- [ ] **(You) Counsel review** — Privacy Policy, Terms, and the privacy/security claims (+ the HEIC/HEVC note). A press release amplifies legal exposure.
- [ ] **(You) USPTO / trademark check** on "DiemDesk" before publicizing the name.
- [ ] **(You) Verify the domain in Google Search Console** (and Bing Webmaster) — you can do this now; you'll submit the sitemap after the flip.
- [ ] **(You) Fill the press release** (`docs/pr/press-release.md`) — [Founder name], launch date, contact — and stage it in EIN Presswire as a draft.

## Launch day (Wednesday), in order
1. **(Claude) Reset analytics** so launch metrics are clean:
   `TRUNCATE user_events;`
2. **(Claude) Reset test Pro accounts to free:**
   `UPDATE users SET plan='free', stripe_customer_id=NULL WHERE plan='pro' AND email <> '<any-real-pro>';` (mcamanigandan is the test account)
3. **(Claude) Flip the agreed tool gating public** + deploy frontend.
4. **(Claude) Remove nginx basic-auth** (the flip):
   `ssh root@2.25.71.126 "sed -i '/auth_basic \$dd_auth_realm/d; /auth_basic_user_file/d' /etc/nginx/sites-enabled/dailydesk && nginx -t && systemctl reload nginx"`
5. **(Claude) Verify live:**
   - `curl -sI https://diemdesk.com/` → **200** (not 401).
   - curl the homepage HTML **and** its referenced CSS/JS bundle → 200 + current hash (the old service-worker incident — a 200 on the page alone isn't enough).
   - `https://diemdesk.com/robots.txt` and `/sitemap.xml` → 200.
   - Quick tool sweep (mobile + desktop) via the Chrome-control workflow — compress, merge, convert, a couple more — no broken tools.
6. **(You) Submit the sitemap** in Google Search Console + Bing (`https://diemdesk.com/sitemap.xml`).
7. **(You) Send the press release** via EIN Presswire.
8. **(Claude + You) Watch** — backend error logs, checkout/webhook owner alerts, Cloudflare traffic. Most tools are on-device so a spike is mostly static/edge-served.

## Right after launch (not blockers)
- [ ] DMARC `quarantine → reject` (Cloudflare `_dmarc` TXT).
- [ ] Cloudflare **Full-strict** SSL; VPS **Node 20 → 22**.
- [ ] Watch DMARC `rua` reports + first-day Core Web Vitals.

## Notes
- `WAITLIST_MODE=true` is already set → the Pro CTA is the **waitlist** (no charging). Correct for a free-first public launch. Leave it until Pro launch.
- Rollback: re-adding the two `auth_basic` lines + `nginx -t && reload` restores the gate instantly.
