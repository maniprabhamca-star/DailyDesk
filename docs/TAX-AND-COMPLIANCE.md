# DiemDesk — Tax & Compliance Playbook

Everything about sales tax / VAT / GST for DiemDesk Pro, so future-you (and any
advisor) has the full picture in one place. **This is general information, not
formal tax or legal advice — confirm specifics with a CPA / sales-tax
specialist before relying on it.** Entity: **JPNM Rapid Universe LLC** (US, Georgia).

> **The one-line rule:** A **free** product owes **no** sales tax / VAT anywhere.
> Tax only starts mattering when you **charge**. So during the free-launch period
> there is **nothing to collect, register, or remit — anywhere in the world.**

---

## 1. Current status (2026-07-04)
- **Stripe Tax: OFF.** Our checkout does **not** set `automatic_tax`, so Stripe adds **$0** tax — customers pay exactly $4.99 / $49.
- **Pro billing: OFF during launch** (`BILLING_ENABLED=false`). Nobody can subscribe yet, so there is **no taxable sale anywhere.**
- Net: **no tax obligation today**, US or international.

## 2. How US sales tax works for SaaS
- **Nexus** = the connection that creates an obligation. Two kinds:
  - **Physical nexus** — office/employees/inventory in a state. For us: **Georgia only.**
  - **Economic nexus** — crossing a state's sales threshold, almost always **$100,000 in sales OR 200 transactions into that one state per year.**
- **You are NOT "nexus in most states."** A new/low-volume SaaS has economic nexus **nowhere** until it crosses those thresholds — then one state at a time.
- **SaaS isn't taxable in most states** — only ~20 tax it. Even where you have nexus, you only collect if SaaS is taxable there.
- **Georgia (home state) generally does NOT tax SaaS** delivered electronically → even our physical-nexus state likely means $0. (Confirm with CPA.)
- **Sales tax vs use tax:** *Sales tax* = the seller collects from the buyer (this is the only one that could apply to us, where we have nexus + SaaS is taxable). *Use tax* = the buyer's self-report obligation when tax wasn't collected — **that's the customer's problem, not ours.** We do not "collect and remit use tax."
- **When do we collect in the ~20 SaaS-taxing states?** **After crossing that state's economic-nexus threshold** — NOT the first sale. (First-sale only applies where we have physical presence, i.e. Georgia.)

### The ~20 states that tax SaaS (approximate — changes yearly)
Arizona, Connecticut, District of Columbia, Hawaii, Iowa, Kentucky, Maryland,
Massachusetts, Mississippi, New Mexico, New York, Ohio, Pennsylvania, Rhode
Island, South Carolina, South Dakota, Tennessee, Texas (80% taxable), Utah,
Washington, West Virginia. **The other ~30 states don't tax SaaS.**

> **You do NOT hand-configure these states.** Stripe's tax engine already knows
> each jurisdiction's SaaS rules (that's why the product tax category = "Software
> as a service"). You only add a **registration** where you have an obligation;
> Stripe then applies that state's correct rule automatically, including quirks
> like Texas's 80%.

## 3. Stripe Tax — where it is, what it does
- **Location:** Stripe Dashboard → **Settings → Tax** (or a "Tax" entry in the sidebar).
- **Monitoring / Thresholds tab** — Stripe watches your sales **per state/country** and **alerts you when you approach or cross a nexus threshold.** This is your early-warning system. **Monitoring is free** and collects nothing.
- **Registrations tab** — the list of places you've told Stripe you're registered to collect.
- **Turn it on (monitoring):** complete the short Stripe Tax setup (origin = Georgia, default category = SaaS). That activates monitoring. **Off/passive** = add no registrations and leave `automatic_tax` off → Stripe collects nothing.
- **When ready to collect:** flip `automatic_tax: { enabled: true }` in our checkout (one-line code change) + enable address collection. Then Stripe **calculates and collects** the right tax — **but only in jurisdictions where you've added a registration.** So: Stripe alerts → you register (state permit + add in Stripe) → Stripe auto-collects there.

### Who remits? (important)
- **Stripe Tax = automated *calculation + collection*.** The collected tax lands in **your** balance.
- **By default Stripe does NOT remit** — **you file and remit** to each state/country (yourself, a CPA, or an automated filing service; Stripe has a filing add-on/partners in some regions).
- Same for international with Stripe: it collects the VAT, **you remit** to HMRC/EU/etc.
- **So Stripe + per-country VAT = automated collection, but filing/remittance is still your job.**

## 4. International — UK, EU, India
International is different from the US: **VAT/GST usually applies from the FIRST sale**, with no small-seller threshold for foreign sellers.

| Region | Tax | Rate | When you owe |
|---|---|---|---|
| **UK** | VAT | 20% | From the 1st sale to a UK consumer — register with HMRC |
| **EU** | VAT | 17–27% (customer's country) | From the 1st EU-consumer sale — one "OSS" registration covers all EU |
| **India** | GST (OIDAR) | 18% | Foreign digital-service sellers must register + charge |

- **With Stripe:** Stripe Tax can calculate/collect VAT/GST for a broad country list (EU, UK, +many), **but you must register in each jurisdiction yourself**, add the registration to Stripe, then it collects; **you remit.** Confirm India specifically is in Stripe Tax's supported-country list before relying on it.
- **Stripe customer support** helps with the *product* (how Stripe Tax works, supported countries, reading the monitor) — but **is not your tax advisor and won't register you.** Use a CPA or a registration service (some are Stripe partners) for actual registrations.

### The big international option — Merchant of Record (MoR)
Services like **Paddle, Lemon Squeezy, FastSpring** become the **legal seller**.
The customer buys from *them*; **they register, collect, file, AND remit all
sales tax / VAT / GST worldwide** — it's their liability, **zero tax work for
you.** You get a payout minus their fee (~5%+$0.50 vs Stripe ~2.9%+$0.30), and
they replace Stripe as checkout. For a solo founder going global, an MoR removes
the entire multi-country compliance burden. Trade-off: higher fee + they're the
merchant of record.

## 5. Can we restrict the app to the US?
Yes — Cloudflare can geo-block (allow US, block others). **But for tax you don't
need to:** a **free** app owes no tax anywhere. When Pro launches, you can simply
**limit Pro *purchases* to the US at first** (keep the free tools worldwide) to
avoid international VAT until you choose to handle it (via Stripe registrations or
an MoR).

## 6. The recommended plan (do this, in order)
1. **Now (free launch):** collect **nothing**, register **nowhere**. No obligation exists.
2. **Before charging (Pro launch):** turn on **Stripe Tax monitoring** so you get alerted per-state; start US-only Pro billing.
3. **As Stripe alerts you** on a state: register there → I enable `automatic_tax` → Stripe collects automatically → you (or a service) file/remit.
4. **Before marketing internationally:** decide **Stripe + per-country VAT registrations** (cheaper, more work) vs a **Merchant of Record** (pricier, zero tax hassle). If global is core, seriously consider an MoR.
5. **Get a one-time CPA consult** (ideally SaaS-savvy) to confirm Georgia + set the monitoring/registration plan. Automated services when you scale: **Anrok, Numeral, TaxJar**.

## 7. Immigration note (not legal advice)
Owner is on **H-4 with EAD**. An H-4 EAD is open-market work authorization that
**generally permits self-employment / running a business** (unlike H-1B). Owner
already operates JPNM Rapid Universe LLC. **Confirm your specific situation with
an immigration attorney** — this is consequential.

## 8. Code touchpoints (for when we flip billing on)
- Enable tax collection: set `automatic_tax: { enabled: true }` on the Checkout Session in `backend/src/routes/stripe.js` + collect the customer address.
- Turn Pro billing on: `frontend/lib/flags.ts` → `BILLING_ENABLED = true` + redeploy frontend.
- Stripe live billing is already fully wired + verified (see [[dailydesk-freemium-gating-status]] / the freemium memory).
