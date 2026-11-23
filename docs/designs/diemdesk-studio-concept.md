# DiemDesk Studio — on-device design studio (Pro) · concept

_Owner idea, 2026-07-13. A Canva/Adobe-Express-style design studio as a **Pro** feature, built
on the owner's existing **"Bonafide banner studio"** tool as the base. This doc captures the
concept, positioning, scope, and open questions so we build it deliberately, not sprawling._

## The one-line pitch
**A private, no-watermark design studio inside your document workspace** — make social posts,
banners, posters, certificates and invoices on your device, and send them straight into the tools
you already use here (compress, PDF, QR, background remover).

## Why it fits DiemDesk
- **Revenue:** creative tools have high willingness to pay — a strong Pro anchor.
- **Differentiation we can actually win:** we will NOT out-spend Canva on template/asset volume or
  collaboration. We win on our edges: **on-device/privacy** (the design never leaves the browser),
  **no watermark**, **deterministic**, **offline PWA**, and **integration** with the rest of the
  toolkit — export → our PDF/compress, drop in a QR from our generator, cut out a background with our
  remover, and apply a saved **brand kit** (already a planned Pro differentiator).
- **Positioning line:** _"Canva makes you upload. DiemDesk Studio keeps your work on your device."_

## Scope discipline (don't clone all of Canva)
Canva is enormous; the failure mode is trying to match it. Hold a phased, focused line:

**Phase 1 — MVP (no AI):**
- Canvas editor: text, shapes, images, layers, align/distribute, color, fonts, snap/guides, undo.
- A focused template set for outputs our audience already makes: **social posts** (Instagram, LinkedIn,
  X, Facebook, YouTube thumbnail), **banners/headers**, **posters/flyers**, **certificates**,
  **invoices/letterheads**, **business cards**, **QR posters**.
- Preset canvas sizes per platform; export **PNG / JPG / PDF** (reuse compress + PDF export).

**Phase 2 — power + integration:**
- **Brand kit** (logo/colors/fonts saved once, one-click apply — already on the Pro differentiator list).
- **Background remover** integration; **magic resize** (one design → every platform size); **batch**.

**Phase 3 — AI (cost-gated):**
- Text-to-image, AI background, copy suggestions — behind the AI budget guardrails
  (Haiku + per-user cap + revenue-pegged kill-switch), per `dailydesk-ai-cost-control`.

## Tech
On-device canvas editor (client-side render + export). Likely **fabric.js** or **konva**, or whatever
the Bonafide base uses. Offline PWA. Every template/asset/font original or license-clean for commercial
use (per the assets-licensing policy). No design ever uploaded.

## Naming
Recommended: **DiemDesk Studio** (short form "Diem Studio"). Alternatives considered: Diem Design,
Compose, Frame, Maker. Avoid "Canvas" (too close to Canva / generic).

## Open questions
1. **The base:** where is the owner's "Bonafide banner studio"? (repo/folder/URL, stack, canvas library.)
2. Print/export formats needed in P1 beyond PNG/JPG/PDF?
3. Which template categories matter most to launch with?

## Risks
- **Scope creep** — the biggest one. Keep to the phased, focused output list.
- **Licensing** — templates/fonts/assets must be original or license-clean.
- **AI cost** — non-AI first; AI only behind the budget kill-switch.

## → Implementation plan (2026-11-23)

This doc stays the **concept of record**. The build plan — phases, template counts,
risks and the open decisions S1–S5 — now lives alongside it at
**[studio-implementation-plan.html](studio-implementation-plan.html)**
(published: https://claude.ai/artifact/SQeJHAY3p2z2EgJpZm1N3S).

One thing it adds that this concept did not anticipate. Studio now has to carry
**two template families, not one**: the design templates described above (canvas
work — social posts, banners, certificates), and a second family of **document
templates** (invoice, agenda, CV, cover letter, expense report) that arrived via
decision D5 on the forms plan. The second family **does not need the canvas editor**
— a document whose layout must not move is the wrong job for a canvas — and should
route through the existing fill-and-export path instead.

⚠ **Legal instruments are deliberately excluded** — bills of sale, agreements,
by-laws, affidavits, leases. Competitors carry them; US Legal Forms is explicitly a
legal-forms business with the counsel to match, and we are not. Our standing
invariant is that we supply a tool, not advice. Not in Phase 1, and not at all
without counsel signing off the category — a category decision, not a traffic one.

## Next
Owner shares the Bonafide base → review it → build a mockup (matched exactly on approval) → phased build.
