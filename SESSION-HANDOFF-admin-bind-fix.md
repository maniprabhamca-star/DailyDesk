# Handover — Admin Portal: bind Next to loopback

**For:** a fresh session working on the **admin portal repo**, not the main app.
**Scope:** one line in `package.json`, plus verification. ~15 minutes.
**Raised:** 2026-08-29. Long-standing item; verified live the same day.

---

## 0. Orientation

- **Repo:** `git@github.com:maniprabhamca-star/DailyDesk-Admin-Portal.git`
  ⚠ **NOT** inside the main `DailyDesk` repo. Clone it fresh.
- **Deployed:** `/var/www/dailydesk-admin` on the VPS `root@2.25.71.126`
- **Process:** pm2 **`dailydesk-admin`** (runs `npm start` → `next start`)
- **nginx site:** `dailydesk-admin-ssl`
- **Live URL:** `https://admin.diemdesk.com`
- **Port:** 3100

---

## 1. The change

In `package.json`, the `start` script currently runs plain `next start`, which
binds **`0.0.0.0`** — every interface. Make it loopback-only:

```json
"start": "next start -H 127.0.0.1 -p 3100"
```

That is the entire code change. nginx already terminates TLS and proxies to the
app; nothing should reach Next except through nginx.

---

## 2. Read this before you panic — it is NOT an open hole

Verified from the public internet on **2026-08-29**:

| Check | Result |
|---|---|
| `2.25.71.126:3100` | **closed / filtered** |
| `2.25.71.126:4000` (backend) | **closed / filtered** |
| `2.25.71.126:3000` (frontend) | **closed / filtered** |
| `2.25.71.126:80` / `:443` | closed to direct IP — origin accepts Cloudflare only |
| `2.25.71.126:22` | open (this is how we confirmed the IP is the right box) |
| `https://admin.diemdesk.com` | **302 → Cloudflare Access SSO** (`bonafideautoparts.cloudflareaccess.com`) |

So there are already **two** layers in front of the admin app: **ufw** blocking
the port, and **Cloudflare Access** requiring SSO at the edge.

**This fix is defense-in-depth, not an incident.** Do not treat it as urgent,
and do not expand scope into a security overhaul.

**Why do it anyway:** ufw is currently the *only* thing between a
`0.0.0.0`-bound process and the internet. One firewall-rule edit, one
provider-side network change, or one rebuild of the box with a different ufw
profile, and port 3100 is serving the admin portal directly — bypassing both
nginx and Cloudflare Access. Binding to loopback makes the exposure
*structurally impossible* rather than *currently prevented*.

---

## 3. ⚠ Check this first or you will break the portal

**Confirm nginx actually proxies to `127.0.0.1`.** If `proxy_pass` points at the
LAN IP or the public IP instead of loopback, binding Next to `127.0.0.1` takes
the admin portal **offline**.

```bash
grep -n "proxy_pass" /etc/nginx/sites-available/dailydesk-admin-ssl
```

- Shows `http://127.0.0.1:3100` or `http://localhost:3100` → safe, proceed.
- Shows anything else → **stop**, change nginx to `127.0.0.1:3100` first, reload
  nginx, confirm the portal still loads, *then* do the bind change.

---

## 4. Deploy

Commit the `package.json` change and push, then on the VPS:

```bash
cd /var/www/dailydesk-admin && git pull
```

```bash
cd /var/www/dailydesk-admin && npm run build
```

```bash
pm2 restart dailydesk-admin --update-env
```

⚠ **Run build and restart as separate commands.** The main-repo deploy runbook
records a build consuming enough resources to drop the SSH session before a
chained `pm2 restart` ever runs — leaving a built-but-not-restarted app. Keep
them separate so a dropped connection cannot strand the deploy mid-way.

`--update-env` matters: pm2 caches the environment from when the process was
first started, and a plain `restart` will silently reuse the old one.

---

## 5. Verify

**On the VPS** — the listener must be loopback, not wildcard:

```bash
ss -ltnp | grep 3100
```

- ✅ want: `127.0.0.1:3100`
- ❌ wrong: `0.0.0.0:3100` or `*:3100` — the flag did not take

**From your machine** — the portal must still work end to end:

```bash
curl -sI https://admin.diemdesk.com
```

Expect a **302** to `…cloudflareaccess.com/cdn-cgi/access/login/…`. Then sign in
through the browser and confirm a real page renders — a 502 means nginx can no
longer reach the app, so revisit §3.

---

## 6. While you are in there — unrelated, do not bundle

The admin portal has **three pending features** with a full 191-line spec in
`SESSION-HANDOFF-admin-features.md` (main DailyDesk repo root):

1. **AI Cost & Budget panel** — nothing surfaces AI spend today. Data is in
   **Redis** (`ai:spend:${YYYY-MM-DD}`, `ai:spend:m:${YYYY-MM}`,
   `ai:u:${userId}:${YYYY-MM}`, micro-dollars, all TTL-expiring with no Postgres
   history). The admin portal has **no Redis client yet**.
2. **Waitlist viewer + export** — only a count today. Data is Postgres
   **`pro_waitlist`**. Mirror the Users page. Half a day; the quick win.
3. **System switches board** — read-only status of `WAITLIST_MODE`,
   `AI_ENABLED`, `BILLING_ENABLED`, `sw-kill.json`. Optional, heavier.

**Keep these out of the bind-fix commit.** A one-line security change should be
reviewable on its own.

⚠ **The admin portal has no automated tests at all.** Anything built there
should come with at least smoke coverage.

---

## 7. Definition of done

- [ ] `proxy_pass` confirmed pointing at `127.0.0.1:3100`
- [ ] `"start": "next start -H 127.0.0.1 -p 3100"` committed and pushed
- [ ] Deployed; `ss -ltnp | grep 3100` shows `127.0.0.1:3100`
- [ ] `https://admin.diemdesk.com` still 302s to Access and renders after login
- [ ] Report back so the main-repo pending list can be ticked
