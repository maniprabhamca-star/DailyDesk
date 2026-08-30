# Handover — DiemDesk Admin Portal: new features to build

**For:** a fresh session working on the **admin portal** (not the main app).
**Scope:** three gaps we identified in the admin tool. Build **#1 (AI Cost & Budget)** and
**#2 (Waitlist)** first — both high value; **#3 (system switches)** is optional/heavier.
Everything below is verified against the live code as of this handover.

---

## 0. Orientation — this is a SEPARATE codebase

- **Admin portal repo:** `git@github.com:maniprabhamca-star/DailyDesk-Admin-Portal.git`
  (deployed at **`/var/www/dailydesk-admin`** on the VPS `root@2.25.71.126`).
  ⚠ It is **NOT** in the main `DailyDesk` repo. Clone it fresh; don't look for it under DailyDesk.
- **Live URL:** `https://admin.diemdesk.com` (nginx `dailydesk-admin-ssl`, SSL). Login → owner creds.
- **Process:** pm2 **`dailydesk-admin`** (`npm start`, i.e. `next start`).
- **Stack:** Next.js (app router) + TypeScript + Tailwind. Talks **directly to the same Postgres**
  as the main app via `db.query(...)`, and calls the **main app's backend** for tool flags via a
  `callMainTools()` helper. **Does NOT currently use Redis** (relevant for Feature 1).
- **Deploy:** on the VPS — `cd /var/www/dailydesk-admin && git pull && npm run build && pm2 restart dailydesk-admin`.
- ⚠ **The admin portal has NO automated tests.** The main app just got a QA program
  (`DailyDesk/docs/qa/`); add at least smoke/unit coverage for anything you build here.

### Conventions to copy (look at existing files)
- **Page:** `app/(admin)/<name>/page.tsx` — client component, `fetch('/api/admin/<name>')`,
  uses `@/components/ui` (`PageHeader, Card, Skeleton, EmptyState`) + `lucide-react` icons.
  **Best template to copy: `app/(admin)/users/page.tsx`** (search box, plan/status filters,
  pagination, row-selection, CSV export button).
- **API:** `app/api/admin/<name>/route.ts` — `import { getAdminSession } from '@/lib/auth'`,
  return `NextResponse.json(...)`, `401` if `!admin`. DB via `db.query`.
- **Nav:** add the new page to the admin sidebar/nav (see the `(admin)` layout / nav component).
- **RBAC:** admins live in `admin_users` (has `role`). Gate destructive actions by role if relevant.
- **Audit log:** every mutation writes to **`admin_audit_log`**
  (`admin_email, action, target_type, target_id, details, created_at`) — the `activity` page
  reads it with `source=admin`. Follow this for any new write action.

### What already exists (DON'T rebuild these)
Pages: `dashboard, users(+[id]), subscriptions, storage, monitoring, engagement, analytics,
usage, tools, activity, feedback, admins, account`.
Covered already: **MRR + sub states + CSV export** (subscriptions), **per-tool gating incl. a
kill-switch** (tools → writes flags to the main app), **storage cleanup/retention**, **infra
monitoring** (CPU/mem/disk/API p95/Postgres/Redis), **admin-action audit log** (activity),
RBAC (admins), **alert email recipients/settings**, SSO access. Users page has search, filters,
pagination, selection, per-user detail (`users/[id]`), per-user activity, bulk actions, CSV export.

---

## ⭐ FEATURE 1 — AI Cost & Budget panel  (highest value)

**Problem:** the entire AI cost-control system is **invisible** in admin. If AI spend runs hot,
the owner cannot see it or intervene from here. This matters the moment the AI suite un-gates at
Pro launch. Background: `DailyDesk` memory `dailydesk-ai-cost-control` + `dailydesk-unit-economics`.

### Where the data lives (main app backend: `backend/src/utils/aiBudget.js`)
Money is tracked in **integer micro-dollars** in **Redis** (NOT Postgres), keys with TTL:
| Key | Meaning | TTL |
|---|---|---|
| `ai:spend:${YYYY-MM-DD}` | global spend today (micro-USD) | 26h (`DAY_TTL`) |
| `ai:spend:m:${YYYY-MM}` | global spend this month (micro-USD) | 35d (`MONTH_TTL`) |
| `ai:u:${userId}:${YYYY-MM}` | that user's AI **action count** this month | 35d |

`record(userId, inTok, outTok, weight)` is called **after each successful AI call** and does
`INCRBY` on all three. `costUsd(inTok,outTok)` uses Haiku list price (`PRICE_IN`/`PRICE_OUT`,
env-overridable). **Preflight** checks, in order: global monthly budget → global daily budget →
per-user monthly cap.

Env knobs (read at process start via `process.env`):
- `AI_GLOBAL_DAILY_USD` (default **5**) — hard daily money backstop.
- `AI_GLOBAL_MONTHLY_USD` (default **0** = disabled) — set to **~20% of the month's Pro revenue**
  at launch; makes spend mathematically ≤ revenue.
- `AI_USER_MONTHLY_MAX` — per-user monthly action cap.
- `PRICE_IN` / `PRICE_OUT` — Haiku $/1M tokens.

⚠ **Two hard truths for the builder:**
1. **Redis keys are the only ledger, and they EXPIRE.** There is no long-term AI-spend history in
   Postgres today. So the panel can show *today* + *this month* live, but **historical trend needs a
   new persistence step** (see "Optional" below).
2. **The admin portal has no Redis client yet.** You must add one.

### What to build
**A. Read path — a new admin API `app/api/admin/ai/route.ts`:**
- Add a Redis client to the admin app (reuse the main app's `ioredis`/`redis` config + `REDIS_*`
  env; point at the SAME instance). *Alternative (cleaner, recommended if you prefer no Redis in
  admin):* add a read-only endpoint on the **main backend** (e.g. `GET /api/admin-internal/ai-budget`,
  protected by an internal token) and call it via the existing `callMainTools`-style helper. Pick one;
  the Redis-direct route is faster to ship, the backend-endpoint route keeps Redis access in one place.
- Return: `spend_today_usd`, `spend_month_usd`, the two budget ceilings
  (`AI_GLOBAL_DAILY_USD`, `AI_GLOBAL_MONTHLY_USD`), **spend-vs-revenue %** (month spend ÷ month MRR
  from the subscriptions data), the per-user cap, and **top AI users this month** (scan `ai:u:*:${m}`
  → join `users` for email; or keep a small sorted set).
- Kill-switch state (see B).

**B. Kill-switch + budget control (write path):**
- Today the budgets are **env-only** → changing them needs a backend restart. To make them
  **adjustable from admin at runtime**, add to the **main backend** `aiBudget.js` an override read
  from Redis, checked alongside env, e.g.:
  - `ai:cfg:global_monthly_usd`, `ai:cfg:global_daily_usd`, `ai:cfg:user_monthly_max` (override env if set).
  - **`ai:kill`** = `"1"` → preflight returns the coming-soon message immediately (a hard manual
    off-switch for the whole assistant, independent of budgets).
- Admin `PUT /api/admin/ai` sets those Redis keys (+ write to `admin_audit_log`). This is a small,
  well-contained backend change — call it out to the owner before shipping since it touches the
  cost-control core.
- If runtime control is out of scope for v1, ship **read-only** (panel + a documented "to change,
  set env X and restart backend"), and add the toggle in a follow-up. Read-only still closes 80% of
  the gap (visibility).

**C. UI — `app/(admin)/ai/page.tsx`** (copy the dashboard/metric + card patterns):
- Metric tiles: **Spend today**, **Spend this month**, **% of this month's revenue**, **Budget
  remaining**.
- A prominent **status pill**: within budget / near limit / **killed**. If `ai:kill` on, show a red banner.
- **Kill switch** toggle + budget inputs (if B is built), each with a confirm + audit.
- **Top AI users** table (email · actions this month · est. cost).
- Add **"AI" to the admin nav**.

### Acceptance criteria
- Panel shows non-zero live spend after an AI call is made (test with an owner AI call).
- % of revenue computes from the same MRR the subscriptions page uses.
- (If B) flipping the kill switch makes a subsequent AI call return the coming-soon message; audit row written.
- No Redis credentials committed; read the same `REDIS_*` env the backend uses.

### Optional but recommended (history)
Add a tiny **daily rollup**: a cron (or the existing canary/monitoring cadence) writes
`{date, spend_usd, ai_actions}` into a new `ai_spend_daily` Postgres table so the panel can show a
30/90-day trend after the Redis keys expire. Low effort, high analytical value.

---

## ⭐ FEATURE 2 — Waitlist viewer + export  (quick win)

**Problem:** the Pro waitlist is only a **count** on the dashboard. The actual emails — everyone
who hit a Pro gate or clicked "notify me" while `WAITLIST_MODE` is on — **can't be viewed or
exported**. That list is the **launch-day conversion outreach**; it's invisible today.

### Where the data lives (main app backend: `backend/src/routes/waitlist.js`)
- Postgres table **`pro_waitlist`**, `INSERT ... (email, user_id, feature) ON CONFLICT (email) DO
  UPDATE ...` (dedupe by email; `feature` = which Pro feature they wanted; `user_id` nullable for
  logged-out signups). **Confirm the full column list** (`\d pro_waitlist` — expect at least
  `email, user_id, feature, created_at`).
- The dashboard's `pro_waitlist` count comes from `SELECT count(*) FROM pro_waitlist` (see the main
  app `events.js` KPI query and the admin `kpi`/`stats` route).

### What to build (mirror the Users page — it's the exact same shape)
- **API `app/api/admin/waitlist/route.ts`:** `GET` list with search (email ILIKE), optional
  `feature` filter, pagination, `ORDER BY created_at DESC`; return rows + total. Admin-gated.
- **Export `app/api/admin/waitlist/export/route.ts`:** CSV of all rows (copy
  `app/api/admin/users/export/route.ts` almost verbatim — same headers pattern, `Content-Disposition`
  attachment, date-stamped filename).
- **Page `app/(admin)/waitlist/page.tsx`:** table (Email · Feature · Joined · Linked account?),
  search, feature filter, pagination, **Download CSV** button, total count header. Copy
  `app/(admin)/users/page.tsx`.
- Add **"Waitlist" to the admin nav** (near Users/Subscriptions).

### Acceptance criteria
- Page lists real `pro_waitlist` rows, newest first, with working search + pagination.
- CSV export downloads all rows (respecting the current filter is a plus).
- Count matches the dashboard's `pro_waitlist` number.

---

## FEATURE 3 — App-wide "system switches" panel  (optional, heavier — scope carefully)

**Problem:** per-*tool* gating is covered (tools page), but the **app-wide** levers are scattered
across env vars, a build-time constant, and a file. Centralizing the read-only *status* is safe and
useful; making them *toggleable* is more invasive (each reads a different source).

### The levers and where they live
| Lever | Location | Toggle difficulty |
|---|---|---|
| `WAITLIST_MODE` | **frontend build-time const** `frontend/lib/flags.ts` (`= true`) | Hard — build-time; needs a redeploy OR move it to the runtime flags API (like tool flags) to toggle live |
| `AI_ENABLED` | backend **env** | Medium — env→restart, or add a runtime override |
| `BILLING_ENABLED` | backend **env** | Medium — same |
| Service-worker kill | **file** `frontend/public/sw-kill.json` (`{"disabled":false}`) on the server | Easy-ish — write the file; already the documented remote kill switch |
| Self-healing auto-protect | backend kill-switch | Medium |
| AI kill / budgets | Redis (see Feature 1) | Easy once Feature 1B exists |

### Recommendation
- **v1: read-only status board** — one page showing the current value/source of each switch, so the
  owner sees system state at a glance. Zero risk.
- **v2 (only if owner asks): make the safe ones toggleable** — the SW kill (write the file), and
  anything already runtime (tool flags, AI budgets). Keep `BILLING_ENABLED` and destructive ones
  **read-only with a "change via env + redeploy" note**, or behind a role + double-confirm + audit.
- ⚠ `WAITLIST_MODE` toggling is the tricky one — it's a build-time frontend constant that gates
  revenue. Making it live-toggleable means moving it into the runtime flags system the tools page
  already uses. Discuss with the owner before doing this; it's the single most important flag on the
  product (it's what un-gates paid Pro).

---

## Cross-cutting notes / gotchas

- **`users.id` is a UUID** (not int) — joins to `users` from events/waitlist/AI use `::text` casts in
  places (see the admin `kpi` route `LEFT JOIN users u ON u.id::text = e.vid`). Match existing casts.
- **Same Postgres, same Redis as the main app** — reuse the main backend's `DB_*` / `REDIS_*` env
  values; don't stand up new infra.
- **Audit everything you write** → `admin_audit_log`.
- **Money = micro-dollars integers** in Redis; divide by 1e6 for USD; never use floats for the ledger.
- **AI per-user cap is MONTHLY** now (`ai:u:*:${month}`), not daily — older notes may say daily; the
  code is monthly. Global has both a daily backstop and an optional monthly budget.
- **Redis outage fails OPEN** for the per-user cap (don't block a payer on a hiccup); the bounded
  `max_tokens` + global budgets still cap blast radius. Your panel should show "Redis down → spend
  data stale" gracefully rather than erroring.
- **Deploy the admin app** separately (pm2 `dailydesk-admin`); it does not go out with the main-app
  deploy. If Feature 1B/3 touches the **main backend** `aiBudget.js`, that's a **main-app** change →
  deploy the main app too (`/var/www/dailydesk` → build → `pm2 restart dailydesk-backend`).
- **Tests:** add unit tests for the CSV/query helpers and at least one smoke E2E for each new page.
  The main app's QA program (`DailyDesk/docs/qa/`) has the patterns; the admin portal should get its
  own minimal `tests/` + a CI workflow eventually.

## Recommended build order
1. **Feature 2 (Waitlist)** — smallest, pure copy of the Users page, immediate value. ~half a day.
2. **Feature 1A (AI panel, read-only)** — add Redis read + the page. Closes the visibility gap. ~1 day.
3. **Feature 1B (AI kill-switch + runtime budgets)** — small backend change to `aiBudget.js` + admin
   write path. Get owner OK first (touches cost-control core). ~1 day.
4. **Feature 3 (system switches, read-only board)** — if wanted. ~half a day; toggles are a later pass.

## Key files to read first (in the admin repo)
- `app/(admin)/users/page.tsx` + `app/api/admin/users/route.ts` + `app/api/admin/users/export/route.ts`
  (the template for both new list pages).
- `app/api/admin/subscriptions/route.ts` (MRR — reuse for the AI %-of-revenue calc).
- `app/api/admin/tools/route.ts` (the `callMainTools` pattern for admin→main-app calls, and the
  flag-write + kill-switch precedent).
- `app/api/admin/activity/route.ts` (`admin_audit_log` shape).
- `lib/auth.ts` (`getAdminSession`, RBAC), `components/ui` (PageHeader/Card/Skeleton/EmptyState).
- In the **main app** repo: `backend/src/utils/aiBudget.js` (the Redis keys + `record`/preflight),
  `backend/src/routes/waitlist.js` (`pro_waitlist`), `frontend/lib/flags.ts` (`WAITLIST_MODE`).
