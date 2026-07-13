# Canary health-checks × rate limits — the contract

**TL;DR for future changes:** the monitoring canary probes server tools over HTTP.
Every rate limiter, quota, and kill-switch on a canary-probed endpoint **must**
exempt the canary via `isCanaryReq(req)` (`backend/src/utils/canary.js`). If you add
a new server tool or a new limit and forget this, the canary will meter itself, hit
`429`, and **auto-disable a healthy tool in front of real users.**

## How the canary authenticates

The canary (`backend/scripts/canary.js`, cron every 10 min) sends the secret
`CANARY_TOKEN` in the **`x-canary`** header. `isCanaryReq(req)` returns true for
those requests. A canary request is a **health probe, not a user**, so it must skip:

- the **global** limiter (`src/index.js`, 300/15 min)
- any **per-route** burst limiter (convert 20/15 min, ocr 200/15 min)
- any **quota** (convert free daily quota, 3/day)
- the **kill-switch** guard (`utils/toolFlag.js`) — so it can probe a *disabled*
  tool and detect recovery, then auto-re-enable it

`CANARY_TOKEN` lives in the backend `.env` (set in prod). Empty token ⇒ `isCanaryReq`
is always false and the bypass is inert (fail-safe: the canary just can't probe).

### Why token, never IP / loopback
The canary hits `127.0.0.1`, but we do **not** exempt loopback. Requests reach the
API through Cloudflare→nginx, and a request that hits the origin directly can send a
forged `cf-connecting-ip: 127.0.0.1`. An unforgeable **secret token** is the only
safe exemption. (See `utils/rateLimitKey.js` — the client key is `cf-connecting-ip`
first.)

## Two independent guards (defense in depth)

1. **Bypass (primary):** canary requests skip every limiter/quota → they never get
   rate-limited, so the health signal stays accurate. Token-gated, unforgeable.
2. **Transient ≠ broken (safety net):** in `canary.js`, an HTTP **429** (rate-limited)
   or **503** (busy) is recorded *report-only* (`autoDisable=false`) and can **never**
   trip the kill-switch. So even if guard 1 is ever misconfigured, a rate-limit or a
   momentary "busy" cannot take a tool offline. Only real failures (bad output, 4xx
   convert-failed, 5xx engine errors, timeouts) auto-disable, at `THRESHOLD=2`.

## Endpoint × limiter matrix (2026-07-13)

| Canary probe | Limiters in front | Daily cap | Canary bypass |
|---|---|---|---|
| `/word-to-pdf`, `/pdf-to-word` (`/api/convert/*`) | global 300/15m · convert burst 20/15m · **free daily quota 3/day** | yes | ✅ token bypass on all three |
| `/ocr-pdf` (`/api/ocr`) | global 300/15m · ocr burst 200/15m | no | ✅ token bypass on both |
| 9 client tools (rotate, delete-pages, crop, remove-metadata, reorder, merge, split, page-numbers, watermark) | none — run as in-process pdf-lib logic, no HTTP | — | n/a (immune) |

Not canary-probed, so intentionally **not** exempted: `/api/events` (own limiter),
`/api/feedback` (submit limiter), auth/user/stripe/waitlist.

## Checklist — adding a new server tool that the canary will probe

1. Put the tool behind `guard('/your-slug')` (kill-switch) — already canary-aware.
2. If you add a rate limiter, set `skip: (req) => redisDown() || isCanaryReq(req)`.
3. If you add a quota, `return next()` early for `isCanaryReq(req)`.
4. In the canary probe, compute `transient = status === 429 || status === 503` and
   pass `!transient` as the 4th arg to `record(...)` so busy/limited never disables.
5. Verify: run the canary back-to-back several times — it must stay green and the
   tool's per-IP counters must not climb from canary traffic.

## Incident that produced this (2026-07-13)

`/word-to-pdf` + `/pdf-to-word` auto-disabled **daily**. Root cause: the `x-canary`
bypass only skipped the kill-switch, **not** the convert route's free daily quota
(3/day). The canary (every 10 min, 2 conversions/run) exhausted the 3/day quota
itself within the first run or two after each UTC-midnight reset, got `429`, and read
its own rate-limit as "tool broken." LibreOffice was always healthy. Fixed by the two
guards above; then generalized to a shared `isCanaryReq` used by the global, convert,
and ocr limiters and the kill-switch. See [self-healing memory] and commit history.
