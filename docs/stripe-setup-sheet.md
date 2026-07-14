# Stripe setup sheet — DiemDesk

Paste-ready values + wiring for DiemDesk Pro billing. **No secrets live in this file** — secret keys go straight into the VPS `.env` (never here, never in chat). Last updated 2026-07-11.

Account: `acct_1OS29LKn6TWL2bZM` · currently **Test mode / sandbox** ("Review in progress", ~2–3 days — normal, doesn't block setup).

---

## Status
- [x] **Product** created — "DiemDesk Pro"
- [x] **Founding Member coupon** — `$0.99 off forever`, cap **1,000**, applies to DiemDesk Pro (coupon id `Mi5P8zII`)
- [x] **Prices** captured — monthly `price_1TsBOqKn6TWL2bZMpZCJ6SHn` · annual `price_1TsBQmKn6TWL2bZMowGMT1Xy`
- [ ] **Support email + statement descriptor** — gear ⚙ → Business → Public details
- [ ] **Branding color** — deferred (do later in Incognito, `#4F46E5`)
- [ ] **Webhook endpoint** created → gives `whsec_…`
- [ ] **Backend `.env`** filled + backend restarted
- [ ] **Checkout smoke test** (card 4242…) → DB flips `plan=pro`

---

## Business profile (gear ⚙ → Business → Public details)
| Field | Value |
|---|---|
| Public / operating business name (shows at checkout) | DiemDesk |
| Legal entity name (IRS-matched; not customer-facing) | JPNM Rapid Universe LLC |
| Website | https://diemdesk.com |
| **Support email** | `[support@diemdesk.com or your Gmail]`  ← this is the field you were looking for |
| Support phone / address | `[number]` / `[Georgia, USA address]` |
| **Statement descriptor** | `DIEMDESK` (≤22 chars, ≥5 letters, no `< > \ ' " *`) |
| Shortened descriptor | `DIEMDESK` (≤10 chars) |
| Business description | Online document toolkit (SaaS). Subscription access to browser- and server-based tools for PDFs, images and files. 100% digital, delivered instantly — no physical goods. |
| Industry / MCC | Computer Software Stores (5734) |

## Product (Product catalog → DiemDesk Pro)
| Field | Value |
|---|---|
| Name | DiemDesk Pro |
| Description | Unlimited access to every DiemDesk tool, plus Pro features: on-device batch, unlimited Office conversions and OCR, an encrypted File Vault, and AI document assistants. Your files stay private — most tools run right in your browser. |
| Unit label | subscription |
| Tax category | Software as a service (SaaS) — electronically supplied |

## Prices (add two to the product)
| | Monthly | Annual |
|---|---|---|
| Amount | **$5.98 USD** | **$60.00 USD** |
| Period | Monthly recurring | Yearly recurring |
| Nickname (internal) | Pro Monthly | Pro Annual |
| Lookup key | `pro_monthly` | `pro_annual` |
| Tax behavior | Exclusive | Exclusive |
| **→ Price id** | `price_1TsBOqKn6TWL2bZMpZCJ6SHn` → `STRIPE_PRICE_ID` | `price_1TsBQmKn6TWL2bZMowGMT1Xy` → `STRIPE_PRICE_ID_YEARLY` |

## Founding coupon — DONE ✅
`Founding Member` · Fixed **$0.99 off** · Duration **forever** · Max redemptions **1,000** · applies to DiemDesk Pro · promo code e.g. `FOUNDING`. Checkout already passes `allow_promotion_codes: true`, so the code box shows automatically.

## Branding (deferred — do later)
Gear ⚙ → Settings → Branding. Brand + Accent color = **`#4F46E5`** (DiemDesk indigo). If the color field won't click, it's a browser-extension overlay — do it once in an **Incognito window** (extensions off). Logo/icon already uploaded. Cosmetic only; does not block anything.

---

## Backend wiring (what the code expects)
Integration: [`backend/src/routes/stripe.js`](../backend/src/routes/stripe.js), mounted in `backend/src/index.js`.

**Env vars — set on the VPS `.env` (NOT in this file / chat):**
| Var | Value (test) |
|---|---|
| `STRIPE_SECRET_KEY` | `sk_test_…` (Developers → API keys) |
| `STRIPE_PRICE_ID` | monthly `price_…` |
| `STRIPE_PRICE_ID_YEARLY` | annual `price_…` |
| `STRIPE_WEBHOOK_SECRET` | `whsec_…` (from the webhook endpoint below) |
| `FRONTEND_URL` | `https://diemdesk.com` (optional; this is the default) |

**Endpoints:**
- Checkout: `POST /api/stripe/create-checkout-session` (auth required; body `{ interval: 'month' | 'year' }`).
- Webhook: `POST /api/stripe/webhook` (raw body, signature-verified).

**Webhook endpoint to register** (Developers → Webhooks → Add endpoint):
- URL: **`https://diemdesk.com/api/stripe/webhook`**
- Events: **`checkout.session.completed`** (→ sets `plan=pro`, stores `stripe_customer_id`) and **`customer.subscription.deleted`** (→ sets `plan=free`).
- Copy its **Signing secret** into `STRIPE_WEBHOOK_SECRET`.

**Frontend flag:** `BILLING_ENABLED` in `frontend/lib/flags.ts` (currently `false`). Leave it **false** during testing — the smoke test triggers checkout via the API directly, so nothing is exposed to real users. Flip to `true` only at real go-live (with LIVE keys).

## Checkout smoke test (test mode)
1. Set the test env vars above on the VPS, restart the backend (`pm2 restart dailydesk-backend`).
2. Trigger a checkout session (owner-authenticated) → open the returned URL.
3. Pay with **`4242 4242 4242 4242`**, any future expiry, any CVC/ZIP.
4. Confirm: subscription appears in Stripe → webhook fires → `SELECT plan FROM users WHERE …` shows **`pro`**.
5. Also try decline `4000 0000 0000 0002` and a 3DS test card to see those paths.

## Go-live (later)
Recreate product/prices/coupon in **Live mode**, set LIVE keys + live `whsec_…` in `.env`, then `BILLING_ENABLED = true` in `frontend/lib/flags.ts` + redeploy frontend. Optional final check: one real charge + refund.
