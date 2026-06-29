# DailyDesk — Technology & Differentiation (Internal Documentation)

> **Purpose:** an internal reference explaining *how* DailyDesk is built and *what* makes it
> different from competitors (iLovePDF, Smallpdf, Adobe). Written in plain language for
> understanding and decision-making — not marketing copy. Some items are **live**, others are
> **planned**; each is labelled.
>
> Last updated: June 2026.

---

## 1. What DailyDesk is

DailyDesk is a **privacy-first, all-in-one productivity web app** — a single place for PDF tools,
QR codes, image tools, generators, AI document features, and (later) notes/habits/budget/vault.

**Positioning in one line:** *Everything you'd pay a PDF subscription for — free, and private,
because your files are processed on your own device, not our servers.*

The two strategic pillars:
1. **Privacy by architecture** — most tools run in the user's browser, so files are never uploaded.
2. **All-in-one** — one app, one account, one ⌘K search across every tool, instead of a dozen
   single-purpose sites.

---

## 2. What we do differently (the headline)

| Dimension | Competitors (iLovePDF / Smallpdf / Adobe) | DailyDesk |
|---|---|---|
| **Where files are processed** | Uploaded to their servers | **In the user's browser** — never uploaded |
| **Privacy** | "We delete after X hours" (you must trust them) | We physically never receive the file — nothing to leak |
| **Free tier** | 2 tasks/day, ads, file-size caps | **Unlimited** core tools, no ads, no watermark |
| **Offline** | Only via paid desktop apps | **In the browser, free** (planned, via PWA) |
| **AI on free** | iLovePDF: none · Smallpdf: limited | A genuine free **daily taste** |
| **Encrypted storage** | Not offered | **End-to-end encrypted File Vault** (opt-in) |
| **Pricing** | $5–20/mo, conditional refunds | **$4.99/mo**, true 14/30-day money-back |
| **Honesty** | "credits" that hide real limits | Plain "X actions/day", clear comparison page |

The thread connecting all of these: **because the work happens on the user's device, the things
competitors must charge for (privacy, no upload, offline) are free for us to give away — and the
things that genuinely cost us money (AI, server conversions, storage) are what we charge for.**

---

## 3. Architecture overview

```
                 ┌─────────────────────────────────────────────┐
   Browser  ───▶ │  DailyDesk web app (Next.js, static-served)  │
   (user's       │  • UI + tool logic + WASM engines run HERE   │
    device)      │  • files opened, processed, downloaded LOCALLY│
                 └───────────────┬─────────────────────────────┘
                                 │ (only for the few server-dependent features)
                                 ▼
                 ┌─────────────────────────────────────────────┐
   Our servers   │  nginx → Node/Express API (:4000)            │
   (VPS now,     │  • Auth (JWT), accounts                      │
    cloud later) │  • AI proxy → Claude API (Haiku)             │
                 │  • Server conversions (LibreOffice) [planned]│
                 │  • File Vault storage (encrypted blobs)      │
                 └─────────────────────────────────────────────┘
```

**Why this scales cheaply:** the heavy lifting (PDF processing) is done by each user's own CPU.
Our servers mostly just **serve static files** — which a CDN can do for millions of users at very
low cost. Traffic growth barely touches our compute. This is how the model scales to 1M–10M users
without proportional server cost.

---

## 4. The four processing models (and who pays)

Every feature falls into one of four buckets. This is the core mental model for cost and privacy:

| Model | Examples | Runs where | Costs us | Privacy |
|---|---|---|---|---|
| **Client-side** | merge, split, compress, rotate, JPG↔PDF, QR, password, edit/annotate, batch | User's browser | **$0** | Files never leave device |
| **Server-side** | PDF↔Word/Excel/PPT, OCR (server option) | Our server (LibreOffice etc.) | CPU/RAM time | File sent for that job |
| **AI** | summarize, chat, translate | Claude API (via our proxy) | Per-token | Text sent for that request, not stored |
| **Storage (File Vault)** | optional encrypted cloud locker | Cloud (encrypted) | Per-GB | E2E encrypted — we can't read it |

**Rule:** if it runs on the user's device → **free**. If it costs us tokens / CPU / storage → **Pro**.

---

## 5. Tech stack

**Frontend**
- Next.js 14 (App Router) + TypeScript + Tailwind CSS (CSS-variable design tokens, dark mode)
- shadcn/Radix component patterns, framer-motion, lucide-react icons, next-themes
- Client-side processing libs: pdf-lib (lazy-loaded), qrcode, jszip; planned: pdfium/mupdf-wasm,
  tesseract.js (OCR), ffmpeg.wasm (video), transformers.js / onnxruntime-web (on-device AI)
- Global ⌘K command palette over all tools

**Backend**
- Node.js + Express, PostgreSQL 16, Redis 7, JWT auth (bcrypt), PM2 process manager
- nginx reverse proxy (`/api/` → :4000, `/` → :3000), HTTP Basic Auth preview gate, security
  headers, rate limiting

**Infra (current)**
- Single VPS (Ubuntu), hardened (SSH key-only, ufw, fail2ban, auditd). Migrating to managed cloud
  + CDN + object storage as subscriptions grow.

**Mobile (planned)**
- Capacitor wraps the same web app into native iOS/Android apps. The PWA (below) is the web-installable
  version of the same idea.

---

## 6. File Vault — end-to-end encryption design

The File Vault is the **only** feature that stores user files, and it's **opt-in**. It uses
**zero-knowledge (end-to-end) encryption** — the same approach as Proton Drive / Tresorit / Sync.com.

**How it works:**
1. **Encrypt on device, before upload.** When a user saves a file, the browser scrambles it with
   **AES-256-GCM** *first*. Only encrypted gibberish is uploaded.
2. **We store only the gibberish.** Our servers have no way to read it — even under a breach or legal
   request, there's nothing readable to hand over.
3. **Only the user can unlock it.** On any device, their browser rebuilds the key from their passphrase
   and decrypts locally. The key never reaches us.

**Key design:**
- **Separate vault passphrase** (not the login password). Login proves identity (server-side); the
  vault passphrase unlocks files (client-side only, never sent to us) → true zero-knowledge.
- **Key derivation:** passphrase → key via **Argon2** (deliberately slow, defeats guessing).
- **One passphrase for the whole vault.** Under the hood each file gets its own random key, all wrapped
  by one master key (envelope pattern → lets us share single files later).
- **Recovery key** issued at setup (one-time code the user stores safely). Without the passphrase AND
  recovery key, data is **permanently unrecoverable** — we warn clearly, like a crypto wallet.
- Built with the browser's **Web Crypto API** (`crypto.subtle`). No extra infrastructure cost.

**Critical interaction with AI:** an encrypted vaulted file is gibberish to the server, so AI cannot
run on it. The two are **separate flows**: AI works on a file *open in the browser* (decrypted on
device, sent for one request, never stored); the Vault is encrypted cold storage AI can't touch.

---

## 7. AI features design

**Features:** Summarize, Chat with PDF, Translate.

- **Model:** **Claude Haiku 4.5** by default (cheapest capable model). A stronger model can be routed
  to a single premium feature later if quality ever requires it.
- **Cost control without quality loss:**
  - **Prompt caching** — for Chat, the document is cached so follow-up questions cost ~90% less.
  - Send only the needed text; cap output length.
  - **Daily quota caps** (the revenue safety rail — see §11).
- **Billing:** usage-based (per token), postpaid, with a hard spend limit set in the Anthropic Console.
- **Privacy:** text is sent for that one request over an encrypted connection, **not stored**, and
  **not used to train models**. AI never runs unless the user asks.
- **Metering:** every Claude response returns exact token counts → we log per-user usage to enforce
  the daily quota and show remaining actions.

---

## 8. Offline support — PWA (planned, gated behind HTTPS)

**PWA = Progressive Web App:** a normal website + three ingredients that make it behave like an
installed app:
1. **Manifest** — name, icon, colors → makes it **installable** (home-screen / desktop icon, no app store).
2. **Service Worker** — caches the app on the device → makes it **work offline**.
3. **HTTPS** — required (service workers don't run over plain HTTP).

**How offline actually works (the mechanism):**
- The Service Worker is like a **tiny local server inside the browser**. On the **first online visit**,
  it saves a copy of the app to the device. After that, opening the app — even with no internet —
  loads from that saved copy instead of the network.
- The processing was always done on the device; the only thing internet was ever needed for was the
  initial download of the app.

**Honest conditions (must all be true):**
- Visited online at least once before (that's when the copy is saved).
- On HTTPS (pending: domain + SSL).
- Same browser, same device (the copy lives there; clearing site data → re-saves on next online visit).
- Only **client-side** tools work offline. AI, server conversions, and Vault sync still need a connection.

**One-liner:** *after your first online visit, reopening the site works offline in that browser — for
the tools that run on your device.*

**Differentiator:** competitors' **web** tools can't work offline (they upload to servers); they offer
offline only via **paid desktop apps**. DailyDesk runs offline in the browser, free.

**Status:** PLANNED. Depends on domain + SSL. When shipped, add a one-line disclosure to the Privacy
page ("we cache app files locally on your device to enable offline use" — functional/essential storage,
standard and legal).

---

## 9. Storage strategy

- **Now (preview / low usage):** self-hosted MinIO on the existing VPS (S3-compatible). ~$0 marginal.
- **Before paying File Vault users:** migrate the Vault to **Cloudflare R2**.
  - **Why R2:** $0.015/GB/month, **zero egress fees** (vs S3's $0.09/GB egress that bankrupts file apps),
    and **durability** — files are replicated across locations.
  - **Durability matters specifically because the Vault is zero-knowledge:** if our disk fails and we
    lose the data, the user *cannot* help recover it (they only hold the key, not a server copy). A
    single VPS disk has no redundancy; R2 does.
  - Both are S3-compatible → migration is a config change, not a rewrite.
- **Billing:** metered/pay-as-you-go (one monthly bill for aggregate GB), not per-user prepaid. User
  cancels → files deleted after grace period → storage bill drops next cycle. R2 free tier: first 10 GB
  + millions of operations free.

---

## 10. Security & infrastructure

- All traffic over **TLS (HTTPS)** [pending SSL on the live preview, which is currently HTTP behind a
  password gate].
- Account passwords stored as **salted bcrypt hashes** — never plaintext.
- VPS hardened: SSH key-only, ufw firewall, fail2ban, auditd, regular patching.
- **Preview gate:** the whole site is currently behind nginx HTTP Basic Auth (private preview) — no
  public access, not indexed. Must be lifted at public launch (with domain + SSL).
- File Vault: zero-knowledge AES-256 (see §6) — a server breach exposes only encrypted gibberish.

---

## 11. Pricing & monetization model

**Plans:** Free ($0) and Pro ($4.99/mo or ~$49/yr). 14-day (monthly) / 30-day (annual) money-back
guarantee for new subscribers, no questions asked.

**Free vs Pro split (the logic: free = runs on device; Pro = costs us / power features):**

| | Free | Pro |
|---|---|---|
| Core tools (merge/split/compress/convert/rotate/QR/password) | ✅ unlimited | ✅ |
| Edit & annotate (highlight, fill, sign) | ✅ | ✅ |
| No ads / no watermark / no signup | ✅ | ✅ |
| Max file size | 100 MB | Unlimited |
| Full in-place text editing | — | ✅ |
| Batch processing | — | ✅ |
| Office conversions (PDF↔Word/Excel/PPT) | — | ✅ |
| OCR | — | ✅ |
| Saved workflows | — | ✅ |
| AI actions | **5 / day** | **70 / day** |
| Encrypted File Vault | 1 GB | Unlimited |

**Cost model (what each piece costs us):**
- **Client-side tools:** $0 per use, regardless of volume.
- **AI (Haiku):** ~$0.02 per summarize/chat, ~$0.10 per translate; blended ~$0.03–0.04/action.
- **Storage:** ~$0.015/GB/month (R2).
- **Payment fees:** ~2.9% + $0.30 per transaction (~9% of a $4.99 charge → push annual billing).

**Per-Pro-user economics (typical):** ~$4.99 revenue − ~$0.44 fees − ~$1.50 AI − ~$0.03 storage ≈
**~$3 profit (~60% margin)**. This is an *average*: a user who maxes the cap loses money individually,
but light users subsidize the few heavy ones, so the blended average stays positive.

**Why daily AI caps (5/day free, 70/day Pro):** a daily cap prevents single-day burst abuse (a scraper
can't drain a month in one hour), makes abusers detectable, and resets daily (better UX). It's the
main dial that keeps AI cost bounded.

---

## 12. SEO strategy

- **One dedicated keyword URL per tool/sub-tool** (e.g. `/merge-pdf`, `/compress-pdf`, `/jpg-to-pdf`) —
  not a single `/pdf` app. Each operation is its own indexable page (this is how competitors get
  millions of hits).
- Each page: statically pre-rendered, unique title + meta + single H1, how-to + FAQ content, structured
  data (SoftwareApplication + FAQ schema), Open Graph, canonical URL.
- Global: `sitemap.xml`, `robots.txt`, fast mobile LCP, semantic HTML.
- **Blocker:** the Basic-Auth preview gate blocks all crawlers — must be lifted at launch (with domain
  + SSL + sitemap submission) for any SEO to work.

---

## 13. Competitive differentiation summary

- **Privacy:** files processed in-browser, never uploaded (architectural, not a promise).
- **Offline in the browser, free** (planned) — competitors only offer offline via paid apps.
- **More generous free tier:** unlimited core tools, no ads, no watermark, free AI taste.
- **Honest pricing & comparison:** plain "X actions/day", a public Free-vs-Pro-vs-Competitors table,
  true money-back guarantee.
- **End-to-end encrypted File Vault** — competitors don't offer encrypted personal storage.
- **All-in-one + ⌘K** — one app and one search across every tool.
- **Beyond-market tools (roadmap):** compress-to-target-size, AI auto-redact PII, natural-language ⌘K
  commands, PDF→audio (TTS), table→CSV extraction, in-browser video tools (ffmpeg.wasm), HEIC→JPG.

---

## 14. Public legal & trust pages (live)

`/security`, `/privacy`, `/terms`, `/refund-policy`, and a public `/pricing` comparison page — plus a
rich privacy/cookie banner. Business entity: USA, State of Georgia (governing law). Cookies: essential
only (functional), no tracking/ads.

---

## 15. Status snapshot

- **Live (behind preview gate):** home hub, ⌘K palette, QR generator, password generator, `/merge-pdf`
  (first client-side PDF tool), auth (login/register + JWT), legal + pricing pages, privacy/cookie banner.
- **In progress / next:** PDF Workspace tools (`/jpg-to-pdf`, split, pdf-to-jpg, rotate, compress …).
- **Planned:** server-side conversions, AI features, File Vault, PWA/offline (after SSL), native apps
  (Capacitor), domain + SSL + public launch, the account-based modules (Notes/Habits/Budget/Bio).
