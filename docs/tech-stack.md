# DiemDesk — technology and server inventory

_Gathered from the repo and the live production box on 2026-08-28. Every version
below was read from the running system, not from memory._

Related: [master-roadmap.md](designs/master-roadmap.md) · deploy steps live in the
`dailydesk-deploy-runbook` memory · security posture in `dailydesk-security`.

---

## ⚠ One finding, worth acting on before anything else

**The admin portal is reachable from the public internet, over plain HTTP.**

`http://<server-ip>:3100/login` answers `200` from outside the box. The admin
Next server is bound to `*:3100` (all interfaces) rather than to loopback, so it
sits beside nginx rather than behind it — which means it bypasses the TLS, the
`admin.diemdesk.com` host rule, and whatever `dd-admin-bypass.conf` enforces.
A password typed into that page travels unencrypted.

The main site is bound correctly for comparison:

| Process | Bind | Reachable directly? |
|---|---|---|
| `dailydesk-frontend` | `127.0.0.1:3000` (`-H 127.0.0.1`) | no |
| `dailydesk-backend` | `127.0.0.1:4000` | no |
| **`dailydesk-admin`** | **`*:3100`** | **yes — 200 from the internet** |

**Fix:** start the admin with the same host flag the frontend already uses
(`next start -H 127.0.0.1 -p 3100`) so only nginx can reach it, then confirm
`https://admin.diemdesk.com` still serves. One line, one restart. Nginx already
proxies to `127.0.0.1:3100`, so nothing else needs to change.

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
