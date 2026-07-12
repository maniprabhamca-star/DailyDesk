# Design — Pro launch waitlist (free-first phase)

**Status:** shipped 2026-07-12. **Owner:** DiemDesk.

During the free-first launch (Pro a few months out), the Pro CTA collects a
**launch waitlist + founding-member interest** instead of charging — turning a
dead "coming soon" into a warm pre-launch list. Flip `WAITLIST_MODE=false` at Pro
launch to restore the live "Go Pro" checkout (already proven).

## Why
- **Warm launch list** — email people who raised their hand → far better than a cold launch.
- **Demand validation** — measure Pro interest before investing more.
- **Founding hook** — join now → lock in $4.99/mo for life.
- **Roadmap data** — a one-tap "most-wanted feature" vote (Batch / File Vault / AI / OCR).

## UX
- **Pricing Pro card** → the full `ProWaitlist` form: email (prefilled if logged in) + optional feature-vote chips + **"Notify me at launch"** → success state ("You're on the list — founding rate saved").
- **Everywhere else** (compare table, home) → `ProCheckout` renders a compact **"Notify me at launch"** button linking to `/pricing#pro-waitlist`.
- **Confirmation email** — branded (`waitlistEmail`), sent via Hostinger SMTP from support@diemdesk.com.

## Shape
- Flag: `frontend/lib/flags.ts` `WAITLIST_MODE`.
- Frontend: `components/app/pro-waitlist.tsx`; `ProCheckout` waitlist branch; pricing page wiring.
- Backend: `POST /api/waitlist` (`routes/waitlist.js`) → `pro_waitlist` table (email unique, optional user_id + feature), idempotent, fires confirmation email. Public + rate-limited.
- Copy: human voice, founding-member hook. No AI-tells.

Mockup approved in chat 2026-07-12.
