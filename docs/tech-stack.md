# DiemDesk — technology and server inventory

_Gathered from the repo and the live production box on 2026-08-28. Every version
below was read from the running system, not from memory._

Related: [master-roadmap.md](designs/master-roadmap.md) · deploy steps live in the
`dailydesk-deploy-runbook` memory · security posture in `dailydesk-security`.

---

## ✅ Admin exposure — found and fixed 2026-08-28

**The admin portal was reachable from the public internet, over plain HTTP.**
`http://<server-ip>:3100/login` answered `200` from outside the box, because the
admin Next server bound to `*:3100` (all interfaces) rather than to loopback —
sitting beside nginx instead of behind it.

That mattered more than a stray open port usually would: `admin.diemdesk.com` is
protected by **Cloudflare Access**, and the direct port bypassed it completely.
The Zero Trust login was in front of the door while the window was open, and a
password typed on that page travelled unencrypted.

**Fixed** by moving the host flag into the admin's own start script —
`next start -H 127.0.0.1 -p 3100` — so it survives a pm2 re-create rather than
living only in a pm2 argument. Verified afterwards: `admin.diemdesk.com` still
302s to Cloudflare Access, the direct port refuses, and the main site is
untouched.

⚠ **The admin lives in a separate repo** (`DailyDesk-Admin-Portal`) and the fix
was applied to the checkout on the server. Commit the same one-line change to
that repo, or the next deploy of it will reopen the port. A backup of the
original sits at `package.json.bak-prebind`.

Binds now, all three:

| Process | Bind | Reachable directly? |
|---|---|---|
| `dailydesk-frontend` | `127.0.0.1:3000` | no |
| `dailydesk-backend` | `127.0.0.1:4000` | no |
| `dailydesk-admin` | `127.0.0.1:3100` | no |

---

## Frontend

Next.js App Router, TypeScript, Tailwind. Everything that can run on the
device does — that is the product position, not an implementation detail.

| Area | Choice | Version |
|---|---|---|
| Framework | Next.js (App Router) | 14.2.35 |
| UI runtime | React | 18 |
| Language | TypeScript | 5 |
| Styling | Tailwind CSS + PostCSS/Autoprefixer | 3.4 |
| Primitives | Radix (dialog, dropdown, toast, slot) | 1.x–2.x |
| Motion | framer-motion | 11 |
| Icons | lucide-react (ISC) | 0.446 |
| Theming | next-themes | 0.4 |

**In-browser document engines** — these are why most tools never upload:

| Job | Library |
|---|---|
| Read/render PDFs | `pdfjs-dist` 6.1 |
| Write/edit PDFs | `pdf-lib` 1.17 + `@pdf-lib/fontkit` |
| Password-protected PDFs | `@neslinesli93/qpdf-wasm` (WASM) |
| JPEG encode/decode | `@jsquash/jpeg` (WASM) |
| HEIC/HEIF (iPhone photos) | `libheif-js` |
| Background removal (AI, on-device) | `onnxruntime-web` |
| Hashing | `hash-wasm` |
| QR read / write | `jsqr` / `qrcode` |
| Zip | `jszip` |
| Video/audio muxing | `mp4-muxer`, `webm-muxer`, `gifenc` |

**Testing:** Playwright (chromium, firefox, webkit, edge, mobile) with
`@axe-core/playwright` for accessibility; Vitest + jsdom for units; ESLint.

---

## Backend

Node/Express — deliberately small. It exists for the handful of jobs a browser
genuinely cannot do.

| Area | Choice | Version |
|---|---|---|
| Runtime | Node.js | 22.23.1 |
| Framework | Express | 4.19 |
| Auth | `jsonwebtoken` + `bcryptjs` | 9 / 2.4 |
| Database client | `pg` (PostgreSQL) | 8.12 |
| Cache / limits / quotas | `ioredis` + `rate-limit-redis` | 5.3 |
| Rate limiting | `express-rate-limit` | 7.3 |
| Headers / CORS / logs | `helmet`, `cors`, `morgan`, `compression` | — |
| Uploads | `multer` (disk or memory per route) | 1.4 |
| Payments | `stripe` | 22.3 |
| Email | `nodemailer` | 6.9 |
| Queues | `bullmq` | 5 |
| Object storage client | `minio` | 8 |
| Headless browser control | `puppeteer-core` | 24.15 |

**Entitlement** lives in `backend/src/utils/entitlement.js` and is shared by every
router: `whoIs` (who is calling), `requirePro` (Pro-only, **fails closed**),
`dailyQuota` (3/day free → Pro unlimited, **fails open**), `countUse` (counts only
on success). The asymmetry is deliberate — infra trouble must not block the free
tier, but an outage is not a reason to give away an expensive endpoint.

---

## Server-side engines (installed on the box)

| Engine | Version | Used for |
|---|---|---|
| LibreOffice | 24.2.7.2 | Office ↔ PDF, PDF → RTF/ODT, ODF → PDF |
| Ghostscript | 10.02.1 | PDF/A archival conversion |
| Tesseract OCR | 5.3.4 | OCR (Pro) — 100+ language packs |
| Google Chrome | 152.0.7977 | Webpage → PDF |

Chrome runs as the unprivileged **`ddrender`** user via `setpriv` with its sandbox
intact — never `--no-sandbox` — and its DevTools socket is bound to loopback. See
the `dailydesk-webpage-to-pdf-security` memory before touching it.

---

## Production server

| | |
|---|---|
| Host | VPS, `2.25.71.126` |
| OS | Ubuntu 24.04.4 LTS (kernel 6.8) |
| Size | 4 vCPU · 15 GB RAM · 193 GB disk (13% used) |
| Web server | nginx 1.24 |
| Database | PostgreSQL 16.15 — `dailydesk_db`, bound to 127.0.0.1 |
| Cache | Redis 7.0.15, bound to 127.0.0.1 |
| Process manager | pm2 |
| Repo path | `/var/www/dailydesk` |

**Processes under pm2:**

| Name | Mode | Notes |
|---|---|---|
| `dailydesk-frontend` | fork | Next on 127.0.0.1:3000 |
| `dailydesk-backend` | **cluster ×2** | 127.0.0.1:4000 — anything per-process must account for both instances |
| `dailydesk-admin` | fork | separate repo, `*:3100` — see the finding above |

**TLS / edge:** Cloudflare in front; nginx terminates with a **Cloudflare Origin
certificate** (valid to 2041). `cloudflare-realip.conf` restores visitor IPs;
`security.conf` carries the security headers — including the `Permissions-Policy`
that once silently disabled every camera tool, and which is **not in this repo**.

**Also on this box:** Docker, plus nginx sites for a separate `serplytic` project.
Not part of DiemDesk, but it shares the CPU and the RAM.

**Hardening:** fail2ban active; nftables carries ufw's rule chains, though the
`ufw` command itself is no longer installed — the rules persist but there is no
management tooling on the box to inspect or change them safely.

**Scheduled jobs:** nightly backup, hourly VPS monitor, monthly cleanup, plus
`dd-monitor infra` every 5 minutes and `dd-monitor growth` daily.
