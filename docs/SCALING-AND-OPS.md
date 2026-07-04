# DiemDesk — Scaling & Server-Load Playbook

The single source of truth for **how many users we can serve, how we watch load,
how we get warned *before* trouble, and exactly what to do (and when) to scale.**
Ops tooling lives in [`/ops`](../ops); this doc is the runbook.

> TL;DR — **Scale on signals, not headcount.** The tools run in the user's
> browser, so 95% of load never touches us. We watch **CPU load, API p95 latency,
> DB connections, and DAU growth trend**; a monitor pushes phone alerts and
> predicts milestones days ahead. Edge-cache at launch, bump the box when signals
> cross thresholds, go multi-server only when one strong box peaks >70% or we
> need HA.

---

## 1. Current architecture (2026-07-03)

```
                 Cloudflare (CDN + TLS Full-strict + WAF)
                          │
                        nginx  (reverse proxy, basic-auth gate during preview)
             ┌────────────┼───────────────────────────┐
             │            │                            │
     Next.js frontend   Express API (pm2 cluster ×2)   static/_next
       (pm2 fork ×1)      │        │                    (→ edge cache at launch)
                          │        └── Redis (rate limiter, shared store)
                          └── Postgres 16 (pool 20 / max 100)
                          └── LibreOffice (server conversions)
   ── ALL on ONE VPS: 4 cores / 15 GB RAM / 2 GB swap (2.25.71.126) ──
```

**Why this scales cheaply:** every tool (compress, merge, convert, QR, video…)
runs **client-side in the browser**. A million people compressing PDFs = a
million of *their* CPUs, ~$0 to us. Only auth, account/plan, Stripe, analytics
beacons, and a few server conversions hit our servers. So we only ever scale a
**thin API + page delivery**, never the tool compute.

Sessions are **stateless JWT** and the rate limiter is **Redis-backed**, so the
API clusters and scales horizontally with no shared in-process state.

---

## 2. Capacity — what the current box supports

| Traffic type | Capacity now | Notes |
|---|---|---|
| Tool use (compress/convert/…) | **Effectively unlimited** | Runs on the user's device |
| Page loads | **Unlimited after edge caching** | Served from Cloudflare PoPs |
| API light reads (plan/JWT) | **~1–3k req/s** | Measured: 3,200 rps, p95 79ms, 0 fail @200 conc |
| **Signups/logins (bcrypt)** | **~tens/sec** | ⬅ the real ceiling (bcrypt is CPU-heavy by design) |
| Server conversions (PDF↔Office) | A handful concurrent | Heaviest per-op |

**Realistic verdict:** after edge caching, this one box comfortably serves
**tens of thousands of DAU** with signup bursts of a **few thousand/hour**. A
literal **million concurrent** needs the horizontal tier (§4). A million
*registered* users at normal 1–5% concurrency is reachable after the vertical
bump alone.

---

## 3. The scaling tiers & EXACT triggers

Do **not** pre-build ahead of these. Each has an observable trigger the monitor
watches for you.

| # | Step | Trigger (any one) | Action | Buys you |
|---|---|---|---|---|
| 0 | **Edge caching** | Going public (basic-auth off) | Cloudflare Cache Rule: cache-everything except `/api/*` | Offloads ~all page traffic |
| 1 | **Cluster ×2** ✅ done | — | `ecosystem.config.js`, `instances:2` | 2× API cores |
| 2 | **Vertical bump** | load1/cores **>0.625 sustained**, OR API p95 **>300ms**, OR RAM **>70%** | Resize VPS to 8 cores; backend `instances:'max'`; frontend cluster ×2 | ~50–100k DAU |
| 3 | **Managed Postgres + pgbouncer** | DB CPU **>70%**, OR connections near pool cap | Move DB off-box, add connection pooler | DB no longer the limit |
| 4 | **Horizontal (multi-server + LB)** | one *upgraded* box peaks **>70% sustained**, OR need HA/zero-downtime | 2+ app nodes behind a load balancer; Redis+PG shared managed | The "millions / flawless" tier |
| 5 | **Queue + workers + object storage** | conversions/OCR/AI cause latency, OR conversion endpoints **>1 req/s**, OR File Vault ships | BullMQ workers + R2/S3 + CDN | Heavy work decoupled from the API |

---

## 4. "How soon can we scale?" — lead times

| Step | Time to execute | Can it be pre-staged? |
|---|---|---|
| Edge caching | **minutes** (a Cloudflare rule) | Yes — ready now, flip at launch |
| Vertical bump | **~15–30 min** (VPS resize + reboot) or minutes for `instances` | Hetzner/DO/Vultr resize is near-instant |
| Managed Postgres | **1–2 hrs** (provision + migrate + cutover) | Provision early, migrate during a low window |
| Horizontal + LB | **~half a day** first time, minutes after | Bake an image / IaC so new nodes are 1-click |
| Queue + workers | **1–2 days** (build + test) | Build before the AI/Vault features that need it |

Because the monitor **predicts milestones ~7 days out** (see §6), you get the
lead time to run the slower steps *before* the peak — which is exactly the
"scale before it goes peak" goal.

---

## 5. Monitoring — what's installed & how to read it

Two layers:

### a) `dd-monitor` (custom, lightweight) — the actionable layer
[`ops/dd-monitor.sh`](../ops/dd-monitor.sh), deployed to `/usr/local/bin/dd-monitor`.
- **`dd-monitor infra`** (cron every 5 min): samples load, RAM, disk, API p95,
  Postgres connections, Redis; **pushes phone alerts** on threshold breaches;
  logs every sample to `/var/log/dd-metrics.csv`.
- **`dd-monitor growth`** (cron daily): snapshots users/DAU/signups to
  `/var/log/dd-daily.csv`, **projects days-to-capacity**, sends a daily digest,
  and fires an **advance warning** when a milestone is within `LEAD_DAYS` (7).
- **`dd-monitor test`**: sends a test push.
- Thresholds live at the top of the script (mirror §3) + `/etc/dd-monitor.conf`.
- Alerts have a 6h cooldown per signal (no spam); growth advance-warnings are
  `max` priority (always through).

Read history any time:
```
tail /var/log/dd-metrics.csv     # ts,loadratio,mem%,disk%,p95ms,pgconn,pgmax,redis
cat  /var/log/dd-daily.csv       # date,total_users,dau,signups,pro
```

### b) Netdata (visual, real-time) — the dashboard layer
Per-second dashboard for CPU/RAM/load/disk/net/postgres/redis at
`http://<server>:19999` (keep it firewalled to your IP / behind the gate). Use it
to *see* what an alert is about and to eyeball trends. Its own anomaly detection
is a bonus; `dd-monitor` remains the source of push alerts.

---

## 6. Notifications — how you get warned (incl. predictive)

We use **[ntfy.sh](https://ntfy.sh)** — free, no account, no credentials.

**Subscribe (once):** install the **ntfy** app (iOS/Android) → subscribe to the
topic in `/etc/dd-monitor.conf` (`NTFY_TOPIC`). That's it — alerts arrive as
push notifications on your phone. (The topic is a long random string, so it's
effectively private; anyone with the string could post/read, so we don't share it.)

**What you'll receive:**
- 🔴 **CRITICAL / high** — CPU, RAM, disk, API latency, DB connections, Redis down.
- 📈 **Advance scaling warning** — e.g. *"Growth projects ~5 days to the
  vertical-scale point (40k DAU). Resize the box + add workers ahead of the peak."*
  This is the "if today is 50k and in 3 days it'll be 80k, warn me early" behavior:
  it linear-fits the DAU trend and warns when a milestone is `LEAD_DAYS` away.
- 📊 **Daily digest** — total users, Pro count, 24h signups, DAU, projection.

Tune lead time / milestones in `/etc/dd-monitor.conf`:
`LEAD_DAYS`, `VERTICAL_AT_DAU`, `HORIZONTAL_AT_DAU`.

---

## 7. Load testing — measure the real ceiling

Script: [`ops/loadtest/auth-load.js`](../ops/loadtest/auth-load.js) (k6). It hits
the **bcrypt login path** (the real bottleneck), not just `/health`.

```
# 1. install k6 (https://k6.io/docs/get-started/installation/)
# 2. seed one reusable login user (see header of the script)
# 3. run against the origin (bypasses Cloudflare) to measure raw capacity:
BASE_URL=http://127.0.0.1:4000 LT_EMAIL=loadtest@diemdesk.local LT_PASS='LoadTest123!' \
  k6 run ops/loadtest/auth-load.js
```

**Interpret:** watch `login_duration_ms p(95)` — the VU level where it crosses
**~300ms** is your current auth ceiling. Compare the sustained req/s to your
expected *(signups + logins) per second* at the target user count. Re-run after
each scale step to confirm the new ceiling. Run periodically (e.g. monthly, and
before any launch push).

---

## 8. Cloud vs. VPS — recommendation & action plan

**Recommendation: stay on the VPS now; adopt a hybrid managed setup as you grow.
Do NOT jump to a big cloud (AWS/GCP) prematurely** — it's 3–5× the cost and
complexity for capacity you don't need yet, and our architecture doesn't require
it.

Phased plan:

| Phase | When | Setup | Rough cost |
|---|---|---|---|
| **A. Now → launch** | today | 1 VPS (this box) + Cloudflare edge cache. Cluster + Redis limiter done. | ~$existing |
| **B. Traction** | Trigger §3-#2 fires | Resize VPS to 8 cores **or** move frontend to Cloudflare Pages/Vercel (free-ish, global) + keep API on the VPS | + ~$20–40/mo |
| **C. Scale** | Trigger §3-#3/#4 | Managed Postgres (e.g. Neon/Supabase/RDS) + managed Redis + **2 app nodes behind a load balancer**; bake a server image / Terraform so nodes are 1-click | + ~$100–300/mo |
| **D. Heavy features** | AI / Vault / big conversions | Add BullMQ workers (autoscaling) + R2/S3 object storage + CDN | usage-based |

**Why hybrid beats full-cloud:** the client-side model means we never pay for
tool compute; we only need (1) cheap global page delivery — Cloudflare already
gives us that — and (2) a small, horizontally-scalable API + a managed database.
That's achievable for tens of dollars/month well into six-figure user counts.
Reach for AWS/GCP only if you later need their specific managed services
(e.g. large-scale queues, ML), not for raw capacity.

---

## 9. Runbook — exact commands per scale step

```bash
# Add API workers (after a box resize) — zero-downtime:
#   edit backend/ecosystem.config.js -> instances: 'max' (or a number)
cd /var/www/dailydesk/backend && pm2 reload dailydesk-backend && pm2 save

# Cluster the frontend (2 workers):  (test first — next start under pm2 cluster)
pm2 delete dailydesk-frontend
pm2 start npm --name dailydesk-frontend -i 2 -- run start -- -H 127.0.0.1 -p 3000
pm2 save

# Turn on edge caching (at launch): Cloudflare dashboard → Caching → Cache Rules →
#   If URI Path does NOT start with "/api/"  → Eligible for cache / Cache Everything,
#   Edge TTL ~1 day; add a bypass rule for /api/*, /account, /login, /register.

# Check monitor output / history:
dd-monitor infra ; dd-monitor growth
tail /var/log/dd-metrics.csv ; cat /var/log/dd-daily.csv
```

---

## 10. Open items (roadmap, not urgent)
- Restrict origin firewall to Cloudflare IP ranges (so `CF-Connecting-IP` can't be
  forged by hitting the origin directly). Security follow-up.
- Confirm the frontend's high pm2 restart count is deploy churn, not crashes.
- Add Netdata alarm → ntfy bridge (optional; `dd-monitor` already covers alerts).
- Build queue/workers before shipping AI or File Vault.
