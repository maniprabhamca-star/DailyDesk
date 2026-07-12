# DiemDesk — docs

Reference docs and shareable overviews for DiemDesk (privacy-first, on-device document toolkit).

## Visual overviews (open the HTML in a browser)
- **[product-overview.html](product-overview.html)** — the full product story: the three moats (privacy · convenience · determinism), the complete toolkit, the free-vs-Pro model, the Pro differentiators, and how the in-browser tools work end-to-end. Theme-aware, responsive.
- **[tool-status-board.html](tool-status-board.html)** — the tool inventory at a glance: what's live, built-but-gated, and planned; free vs Pro; on-device vs server (with the 3/day Office chip); plus the planned Pro differentiators.

## Model in one line
Every in-browser tool is **free & unlimited forever** (they run on your device and cost us nothing). Only the few server-processed tools are metered: **Office conversions = 3 free/day → Pro unlimited**; OCR + AI = Pro. The Pro tier's moat is a set of features rivals structurally can't copy — **on-device batch, redaction certificate, saved workflows, encrypted File Vault** (flagships), plus self-destruct shares, certificate of completion, Bates numbering, brand kit, and an offline PWA.

## Design specs
- **[designs/on-device-batch.md](designs/on-device-batch.md)** — the on-device Batch (Pro) design: gate + runner states, per-tool controls, engineering shape. New designs we discuss get committed under `designs/`.

## Launch
- **[wednesday-launch-runbook.md](wednesday-launch-runbook.md)** — the tight ordered go-public runbook for launch day (flip basic-auth, reset data, tool gating, verify, submit sitemap) — Claude-vs-you steps + exact commands.
- **[pr/press-release.md](pr/press-release.md)** — two press-release versions for EIN Presswire (privacy angle + free-alternative angle).
- **[launch-checklist.md](launch-checklist.md)** — the fuller go-live runbook: what's done + the ordered steps to launch (QA, SEO, Stripe live, Google OAuth publish, reset test data, remove basic-auth, DMARC reject, hardening).
- **[stripe-setup-sheet.md](stripe-setup-sheet.md)** — Stripe fields + env wiring reference.

## Other docs here
- `TECHNOLOGY.md` — tech stack & architecture
- `SCALING-AND-OPS.md` — scaling playbook & ops
- `edit-pdf-approach.md` — Edit PDF engine approach
- `TAX-AND-COMPLIANCE.md`, `ADMIN-MONITORING-DASHBOARD-SPEC.md`
