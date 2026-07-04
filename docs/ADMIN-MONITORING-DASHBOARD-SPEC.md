# Admin Dashboard — Monitoring & Growth Panel (build spec / handoff)

Hand this to the session that owns the **backend admin tool** (`dailydesk-admin`).
Goal: surface the live server monitoring + growth prediction (already running via
`dd-monitor`, see [SCALING-AND-OPS.md](SCALING-AND-OPS.md)) as a panel in the admin
UI — no need to re-implement sampling; just read what the monitor already writes.

## What already exists (data sources)
`dd-monitor` runs on the VPS via cron (infra every 5 min, growth daily). It writes:

| File (on the VPS) | Content | Refresh |
|---|---|---|
| `/var/log/dd-status.json` | **Current** infra sample + thresholds (see shape below) | every 5 min |
| `/var/log/dd-growth.json` | **Current** growth snapshot + projection text | daily |
| `/var/log/dd-metrics.csv` | Infra **history** — `ts,load_ratio,mem_pct,disk_pct,p95_ms,pg_conn,pg_max,redis` | every 5 min |
| `/var/log/dd-daily.csv` | Growth **history** — `date,total_users,dau,signups,pro` | daily |
| `/var/log/dd-monitor.log` | Human log incl. alert lines | on alert |

`dd-status.json` shape:
```json
{ "ts":"2026-07-04T01:06:05Z","load1":0.00,"cores":4,"load_ratio":0.000,
  "mem_pct":6.7,"disk_pct":8,"api_p95_ms":2,"pg_conn":6,"pg_max":100,"redis":"PONG",
  "thresholds":{"load_ratio_warn":0.625,"load_ratio_crit":0.85,"mem_warn":70,"mem_crit":88,
    "disk_warn":80,"disk_crit":92,"p95_warn":300,"p95_crit":800,"pgconn_warn":0.70,"pgconn_crit":0.90} }
```
`dd-growth.json` shape:
```json
{ "date":"2026-07-04","total_users":2,"dau":2,"signups_24h":1,"pro":1,
  "projection":"DAU 2, growing ~1/day. ~... days to 40000 (vertical bump).",
  "milestones":{"vertical_at_dau":40000,"horizontal_at_dau":90000,"lead_days":7} }
```

## Recommended architecture
The admin tool is on the **same box**, so the simplest path is: admin backend
reads these files + the DB, exposes one JSON endpoint, admin frontend renders it.

**Add one endpoint** (admin-auth protected):
```
GET /admin/monitoring  ->  {
  current:  <contents of dd-status.json>,
  growth:   <contents of dd-growth.json>,
  infraHistory: [ {ts,load_ratio,mem_pct,disk_pct,p95_ms,pg_conn,pg_max,redis}, ... ],  // parse tail of dd-metrics.csv (e.g. last 288 = 24h)
  dailyHistory: [ {date,total_users,dau,signups,pro}, ... ],                              // parse dd-daily.csv
  recentAlerts: [ "…log line…", ... ]                                                      // grep 'alerted:' tail of dd-monitor.log
}
```
Reading files in Node: `fs.readFileSync('/var/log/dd-status.json','utf8')` etc.,
wrapped in try/catch (return nulls if a file is missing). CSV parse = split lines
on `\n`, fields on `,`. No new dependency needed.

> If the admin tool can't read `/var/log`, either (a) run it as a user with read
> access, or (b) point `dd-monitor`'s `STATUS_JSON`/`*_CSV` paths (top of the
> script) at a shared dir the admin can read, or (c) query Postgres directly for
> the growth numbers (see queries below) and only the infra part needs the files.

Live DB queries the growth numbers come from (if you prefer querying over reading `dd-daily.csv`):
```sql
-- total, pro, signups(24h), DAU(24h)
select count(*) from users;
select count(*) from users where plan='pro';
select count(*) from users where created_at > now() - interval '24 hours';
select count(distinct coalesce(user_id::text, ip_address::text))
  from user_events where created_at > now() - interval '24 hours';
```

## Projection algorithm (port of the bash logic, if you want to compute in-app)
Linear fit over `dailyHistory[].dau`:
```
slope   = (dau_last - dau_first) / (n_days - 1)      // DAU/day; if <=0 => no pressure
daysTo(milestone) = (milestone - dau_last) / slope   // show if > 0
// show an "advance warning" badge when 0 < daysTo(vertical_at_dau) <= lead_days
```

## UI recommendation
- **Status cards** (top row): CPU load (`load_ratio` × `cores` = load1), RAM %, Disk %,
  API p95 ms, Postgres `pg_conn/pg_max`, Redis up/down. Color each with the
  thresholds from `dd-status.json` (green < warn, amber ≥ warn, red ≥ crit).
- **Line charts** (last 24h / 7d from `dd-metrics.csv`): load_ratio and API p95 over time.
- **Growth chart** (`dd-daily.csv`): DAU + total users over time, with a dashed
  **projected trend line** and a callout: *"~N days to the next scale step (40k DAU)."*
- **Advance-warning banner** when the projection is within `lead_days`.
- **Alerts feed**: last N lines from `recentAlerts`.
- **Thresholds/what-happens-next**: small legend linking to SCALING-AND-OPS.md so
  whoever's on call knows the action for each trigger.

## Auth / security
Gate `/admin/monitoring` behind the admin tool's existing admin auth (it's
operational data). Do not expose it publicly. Don't put the ntfy topic in any
response (it lives only in `/etc/dd-monitor.conf`).

## Feedback panel (added 2026-07-04)
User feedback from the `/feedback` page is stored in the Postgres **`feedback`**
table. Two ways to surface it in the admin dashboard:

**Option A — backend API (recommended; decoupled):**
`GET /api/feedback?limit=100` with header `x-admin-token: <ADMIN_API_TOKEN>`
returns:
```json
{ "summary": { "total": 42, "last_24h": 5, "unread": 12 },
  "feedback": [ { "id":7,"created_at":"…","user_id":null,"email":"…","category":"idea",
                  "rating":null,"message":"…","page":"/compress-pdf","status":"new" }, … ] }
```
Returns **404 until `ADMIN_API_TOKEN` is set** on the backend `.env` (so the
endpoint is invisible/disabled by default). Ask for the token value (stored
server-side, not in git).

**Option B — direct DB (same box):**
```sql
SELECT created_at, category, rating, email, message, page, status
FROM feedback ORDER BY created_at DESC LIMIT 100;
```

**UI suggestion:** a "Feedback" nav item → a table (date, category chip, message,
email, source page) with a filter by category (bug/idea/praise/other) and a
count badge (`summary.unread`). A `status` column exists (`new` default) so you
can add "mark as read/resolved" later (`UPDATE feedback SET status='read' WHERE id=…`).

## Usage metrics panel (added 2026-07-04) — the "who's using it" dashboard
This is the demand dashboard for the Pro-launch decision. Usage is tracked
first-party (no third-party trackers): a beacon fires on every tool-page open →
`user_events` table, now including an anonymous **`visitor_id`** (random UUID from
the browser, no PII) so unique/returning visitors are accurate without signup.

**Endpoint:** `GET /api/events/stats` with header `x-admin-token: <ADMIN_API_TOKEN>`
(same token as the feedback endpoint). Returns:
```json
{ "registered_users": 12, "signups_24h": 2, "signups_7d": 6,
  "unique_visitors": 3400, "dau": 210, "wau": 900, "mau": 3100,
  "returning_visitors": 640, "total_tool_uses": 8200,
  "top_tools": [ { "module": "compress-pdf", "uses": 1900 }, … ] }
```
Returns **404 until `ADMIN_API_TOKEN` is set** (it is set on the VPS `.env`).

**UI suggestion — a "Usage" / "Growth" page with:**
- **Top cards:** Unique visitors, DAU / WAU / MAU, **Returning visitors** (the key retention signal), Registered users, Signups (24h / 7d), Total tool uses.
- **Top tools** bar list (`top_tools`) — what people actually use → what to build Pro around.
- Pair with the growth trend from `/var/log/dd-daily.csv` (DAU over time) for a line chart.
- **Framing for the owner:** registered-user count is *not* the headline (signup is optional by design); **unique visitors + returning rate + top tools + feedback** are the Pro-launch confidence signals.

Definitions: visitor key = `coalesce(visitor_id, ip_address)`; **returning** = a
visitor seen on ≥ 2 distinct days. Rows predating this change have no
`visitor_id` and fall back to IP.

## Tool enable/disable panel (added 2026-07-04) — the kill switch + status control
Turn any tool **enabled / coming_soon / pro / disabled** from the admin, no deploy.
The site reads a flag map and gates each tool live (kill switch for bugs/abuse/
server-overload, and admin-controlled coming-soon/Pro status).

Backend (already built + live):
- `GET /api/tools/flags` — **public**, `{ "flags": { "/word-to-pdf": "coming_soon", … } }` (only non-`enabled` tools; cached 30s; fail-open to `{}`).
- `GET /api/tools/flags/all` — **admin** (`x-admin-token`): every stored flag incl. `updated_at`.
- `PUT /api/tools/flags` — **admin**: body `{ "slug": "/word-to-pdf", "status": "coming_soon" }`. `status` ∈ `enabled|coming_soon|pro|disabled`. Upsert; setting `enabled` effectively clears it.

Slugs = the tool's route path (e.g. `/merge-pdf`, `/word-to-pdf`) — from `frontend/components/app/catalog.tsx` (`href`). Statuses:
- `enabled` — normal (default).
- `coming_soon` — front-end shows a "Coming soon" panel instead of the tool.
- `disabled` — shows "Temporarily unavailable" (maintenance/kill switch).
- `pro` — reserved; passes through for now (real Pro gating is the billing flag) — treat as future.

Frontend consumption (already wired): `lib/tool-flags.tsx` (`ToolFlagsProvider` in the root layout + `useToolStatus(slug)`); `components/app/tool-gate.tsx` wraps the shared `PdfToolPage` tool area and gates by pathname. *(Tools not on the `PdfToolPage` shell need the same one-line `<ToolGate>` wrap — extension noted for later.)*

**UI suggestion:** a tools table (from `GET /flags/all` + the catalog list) with a status dropdown per tool → `PUT /api/tools/flags` on change; a prominent "disable" (kill switch) action; show `updated_at`. Optional later: enforce `disabled`/`coming_soon` at the **API layer** too (e.g. the convert endpoints check the flag) so a killed server-tool can't be hit directly — the current gate is front-end only.

## Notes for the implementer
- Files update on the cron cadence, not per-request — that's fine; label the panel
  with `current.ts` so staleness is visible.
- `dd-monitor` is the source of truth for thresholds; the dashboard should read
  them from `dd-status.json` rather than hard-coding, so tuning `/etc/dd-monitor.conf`
  flows through automatically.
- To force-refresh while testing: SSH `dd-monitor infra` / `dd-monitor growth`.
