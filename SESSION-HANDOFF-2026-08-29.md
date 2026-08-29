# DiemDesk — session handover, 2026-08-29

Paste this whole file into a fresh session.

---

## 0. Read these first

Memory index `MEMORY.md` is loaded automatically. Before acting, read:

- `dailydesk-feedback-crisp-replies` — **reply style is a hard rule.** Verdict →
  table/bullets → action items → stop. Analysis goes in a committed doc; the
  reply links to it. Re-stated five times; treat drift into prose as a defect.
- `dailydesk-pdfnet-response-roadmap` — the active work queue.
- `dailydesk-pending-tasks` — canonical open items.
- `dailydesk-deploy-runbook` — how to ship (IP, ports, pm2, SSH traps).

Repo trackers: `docs/designs/pdfnet-response-tracker.md` (live status),
`docs/designs/master-roadmap.md` (everything ever tracked), `docs/README.md` (index).

---

## 1. What the product is

**DiemDesk** — https://diemdesk.com. ~114 tools for PDF, image, video, data and
developer file work. Position: **most tools run entirely in the browser (WASM),
so the file is never uploaded.** Server is deliberately small — only office
conversion, OCR, webpage capture and payments.

Business: USA/Georgia entity. Pricing $5.98/mo, $60/yr. Stripe live keys are set
on prod. Site is public (no basic-auth).

**Owner:** Mani (maniprabhamca@gmail.com). Stripe/Anthropic org owner is
Jayaprabha Ranganathan.

---

## 2. Stack (verified)

| Layer | What |
|---|---|
| Frontend | Next.js 14.2 App Router, React 18, TS 5, Tailwind 3.4, Radix, framer-motion 11, lucide |
| In-browser engines | pdfjs-dist 6.1, pdf-lib 1.17 + fontkit, qpdf-wasm, @jsquash/jpeg, libheif-js, onnxruntime-web, hash-wasm, jsqr/qrcode, jszip, mp4/webm-muxer, gifenc |
| Backend | Node 22, Express 4, PostgreSQL 16, Redis 7 |
| Server engines | LibreOffice 24.2, Ghostscript 10.02, Tesseract 5.3, Chrome 152 (unprivileged `ddrender`) |
| Infra | Ubuntu 24.04, nginx 1.24, pm2, Cloudflare (DNS/TLS/Zero Trust), fail2ban + nftables |

**Prod:** one VPS, 4 CPU / 15 GB / 193 GB, shared with another project.
`ssh root@2.25.71.126` (**NOT** by domain — Cloudflare doesn't proxy 22).
pm2: `dailydesk-frontend` fork ×1 :3000 · `dailydesk-backend` **cluster ×2** :4000
· `dailydesk-admin` fork ×1 :3100. All bind loopback; nginx is the only front door.

**Deploy:**
```
ssh root@2.25.71.126
cd /var/www/dailydesk && git pull --ff-only origin main
cd backend && pm2 reload dailydesk-backend --update-env
cd ../frontend && npm run build && pm2 reload dailydesk-frontend --update-env
```
⚠ `npm run build` on the box **frequently kills the SSH connection**. The build
finishes; a chained `pm2 reload` does **not** run. Reconnect, reload, verify.
⚠ Prod `.env` overrides code defaults — grep it before assuming a default applies.
⚠ `/api/health` does not exist. Prove the API with `POST /api/auth/login` → 401.

---

## 3. Exact current state

- `main` HEAD = **`08761a3`**, prod = **`08761a3`**. In sync, nothing unpushed.
- 176 pages in the sitemap · ~114 catalog tools · **34 tools gated `coming_soon`**
- `WAITLIST_MODE = true` in `frontend/lib/flags.ts` → **nobody can pay**
- 166 unit tests green (13 files). Run with **`npx vitest run --pool=forks`**.
- 12 untracked `SESSION-HANDOFF-*.md` files in the repo root — pre-existing noise.

### Shipped this session
1. **`/llms.txt` + 176 Markdown twins** at `<url>.md`, `text/markdown`, live.
   `frontend/scripts/gen-llms.mjs`, npm **postbuild**, output git-ignored.
   Generated from the **built** pages and the **built sitemap** — see §6.
2. **HEIC everywhere + `.ppsx`** (`08761a3`). Five separate image decoders existed;
   four couldn't open HEIC. Now one: `decodeToBitmap()` in `lib/image-for-pdf.ts`.
   New `lib/accept.ts`. New `tests/unit/file-accepts.test.ts` (6 assertions).

---

## 4. The active queue — pdf.net response (12 items)

Full reasoning: `docs/designs/pdfnet-response-tracker.md`,
`docs/designs/competitor-pdfnet-gap-analysis.md`,
`docs/designs/content-seo-strategy.md`.

| # | Item | State |
|---|---|---|
| 0 | llms.txt + 176 twins | ✅ shipped |
| 1 | Accept lists + HEIC + `.ppsx` | ✅ shipped |
| **1b** | **HEIC in sign/watermark/annotate/edit/signature-maker** | **⏳ NEXT** |
| 2 | Stripe ToS consent checkbox | 🔒 owner |
| 3 | Passport differentiation + verify 21 specs | ⏳ gate for all content work |
| 4 | Banks 11 → 40 (~29 pages) | ⏳ |
| 5 | Alternatives 4 → 10 (~6) | ⏳ |
| 6 | Sectors 4 → 12 (~8) | ⏳ |
| 7 | India statutory forms (~40–60) | ⏳ |
| 8 | US forms — privacy wedge (~30–60) | ⏳ |
| 9 | "What comes next" dock | ⏳ |
| 10 | AI doc generator / invoice builder | ⏳ |
| 11 | Multi-doc AI chat | 🔒 needs File Vault |
| 12 | MCP server | ⏳ |

### Item 1b — exactly what's left
`sign-tool`, `watermark-tool`, `annotate-tool`, `edit-tool`, `signature-maker`
load a picked image via `new Image()` + `readAsDataURL`, which fails on HEIC.
They are listed by name in `tests/unit/file-accepts.test.ts` as `KNOWN_NARROW`,
with an assertion that the list **shrinks**. Fix the loader (route through
`decodeToBitmap`), then widen `accept` to `ACCEPT.image` and remove from the list.
Do not widen first — that turns "greyed out" into "picked, then error".

---

## 5. Judgements already made — do not re-litigate

- **Fix before scale (item 3 before 4–8).** `lib/passport-specs.ts` carries a
  comment saying the 35×45 countries generate identical sentences and Google
  dedupes them; Search Console confirms. 21 of 46 specs unverified, 5 still from
  `schengen()` (encodes the **visa** standard, wrong 6/10). Adding countries
  multiplies the defect. Scope: `docs/designs/passport-photo-editorial-scope.md`.
- **US forms wedge = privacy, not coverage.** pdf.net has 131 US form pages and 3
  years of authority. But a W-9 carries an SSN and every forms site uploads it.
  `/fill-pdf-form` is on-device → "fill it without your SSN leaving the browser".
  Manual fill local; AI fill server, badged honestly.
- **MCP reuses our headless Chrome.** No server rewrite needed — the WASM tools
  run in the Chrome already installed for Webpage→PDF. MCP tools still carry the
  `server` badge; say so.
- **AI generator ships template-driven** (invoice builder with saved clients), not
  prompt-driven — prompt-driven competes with the assistant the user is already in.
- **Rejected:** general blog (198 posts = a content team) · multi-language now
  (7× maintenance; if ever, **Hindi** first) · their cloud workspace + share links
  (needs readable copies — finish File Vault instead) · their
  **$0.95→$49.88/mo trial** model · an 8-tile quick-action grid (hides 106 of 114
  tools; we already have `components/command-palette.tsx`).

---

## 6. Gotchas that cost time — do not rediscover

- **Twin/route generators must read the BUILT sitemap** (`.next/server/app/sitemap.xml.body`),
  not `ROUTES` in `app/sitemap.ts`. Source-parsing silently missed **80** dynamic
  pages (bank guides, 46 passport specs, sectors, dev tools). 91 → 176 after fix.
- **vitest pool flips.** Default `threads` died with *"Timeout waiting for worker"*
  and reported **"no tests"** — reads like a clean run. `--pool=forks` gave 166/166.
  Earlier the opposite was true. **Trust the count, not the pool.**
- **A narrow image `accept` is a bug, not a safety feature.** `accept` is a picker
  convenience; the real check is the byte sniff. Android sends HEIF as `image/jpeg`.
- **An `<img>` pointed at a raw HEIC renders nothing.** Derive previews from the
  decoded canvas.
- **Widen picker + gate together.** `.ppsx` needed 3 places: accept list, frontend
  `extRe`, backend `OFFICE_RE`.
- **pdf.js:** `page.render()` without `intent:'print'` hangs in a background tab;
  a render's blob URL dies with `handle.destroy()`.
- **pdf-lib:** `updateMetadata` is a **LOAD** option, not a save one. Acrobat
  believes **XMP** over the Info dictionary.
- **Chrome print lays out at PAPER width** — `scale = paper / viewport`.
- **Entitlement asymmetry:** `dailyQuota` fails **OPEN**, `requirePro` fails **CLOSED**.
  Client must send the Bearer token or Pro users meter as anonymous (shipped
  broken 3×; now a build-failing test).

---

## 7. 🔒 Owner-only actions — blocking, no code can do them

1. **Cloudflare AI-crawler block.** diemdesk.com → Security → Settings → Bots →
   **AI Scrapers and Crawlers = Off**; signals `ai-train=yes`, `ai-input=yes`.
   Today serves `Disallow: /` to ClaudeBot, GPTBot, Google-Extended, CCBot,
   Applebot-Extended, Amazonbot, Bytespider, meta-externalagent.
   **The 176 twins are invisible until this flips.**
2. **Stripe ToS URL.** Settings → Business → Public details →
   `https://diemdesk.com/terms`. **Item 2 cannot ship without it.**
3. **Admin portal bind.** Commit `"start": "next start -H 127.0.0.1 -p 3100"` to
   the `DailyDesk-Admin-Portal` repo, or the next deploy reopens the admin port.
4. **Click-test the 15 built converters** so they can un-gate.
5. **Tally test** for `/bank-statement-converter` so the flagship can un-gate.
6. **Revenue flip:** Stripe live prices $5.98/$60 + founding coupon, then
   `WAITLIST_MODE = false`.
7. Delete-account flow test + Stripe cancel/refund test on a throwaway account.

---

## 8. ⚠️ The priority argument to settle first

**34 of ~114 tools are dark and `WAITLIST_MODE = true`.** The content plan
(items 4–8) funnels traffic into a **gated** flagship on a site that **cannot
take money**. Building 29 bank pages before the till works earns nothing.

Recommended re-order, owner has NOT yet decided:
1. Un-gate the 15 click-tested converters + `/folder-preview` (verified, 5 edits)
2. Revenue flip
3. Un-gate `/bank-statement-converter`
4. Then item 3 (passport) — it fixes 46 **live** pages Google is deduping now
5. Then the rest of the queue

Gated breakdown: 11 deliberate Pro-until-launch (Edit, Redact, OCR, Chat,
Summarize, Translate, Question generator, File Vault, Link in bio, Receipt
scanner, Workflows) · 15 converter pack awaiting click-test · 8 others incl.
`/folder-preview`, `/bank-statement-converter`, `/compare-pdf`, `/html-to-pdf`,
`/crop-pdf`, `/clean-scanned-pdf`, `/share-safe-pdf-check`, `/client-packet-builder`.

---

## 9. Other pending (outside the queue)

Workflows account sync · admin portal AI-cost panel + waitlist export · TWA
(Android) · ~20 pre-existing gated tools still `index, follow` · beyond-market
uniques (PDF/UA, e-Invoice, RFC-3161 timestamp) · PDF→Audio server TTS · home
bento redesign (parked, artifact 0a78c04c) · QA Phase 1 CI deps · ~25
non-European passport specs unverified.

---

## 10. Standing rules

- Changelog entry in `frontend/lib/changelog.ts` with **every** meaningful ship.
- New tools ship `coming_soon` (owner-only) until click-tested — 4 edits:
  `tool-flags.tsx`, catalog `soon: true`, **keep out of** `sitemap.ts`, `robots
  index:false`; hold the changelog entry.
- `since: 'YYYY-MM-DD'` on every new catalog tool (drives the 30-day "New" chip;
  a test fails without it).
- SEO bar per page: title ≤60, description ≤155, canonical, one h1, JSON-LD, OG,
  **add the route to `sitemap.ts`**.
- Designs/plans get committed under `docs/designs/` and indexed in `docs/README.md`.
- Auto-update `/overview` + master-roadmap after each ship; counts are derived,
  never typed.
- Competitor review before every new tool. Name competitors on `/compare`.
- Never overwrite a hand-maintained doc; a generator must never target one.
- Handovers go to a FILE, not chat.
