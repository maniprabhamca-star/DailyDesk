# DiemDesk — Session Summary, 2026-07-09

Everything below is **shipped to `main` + deployed to the VPS + verified** (typecheck, build, HTTP 200, and Node render/logic checks where noted). Owner-only tools are gated `coming_soon` (public sees a "coming soon" page; you see the real tool via the localhost/owner bypass) and are kept out of the sitemap.

## 1. Edit PDF — premium editor merged
- Reviewed the Codex `edit-pdf-premium_codex` branch, scoped it to edit-pdf only, merged to `main`, deployed.
- Adds: premium toolbar (stamps, images, shapes, links, align, underline/strike), paragraph drag + resize, colour preservation, and a **cover-vs-draw box** that fixes the tail-overlap. Kept the `subset:false` scramble fix.
- Verified the real export in Node: legible, correct font, no scrambling.

## 2. New document tools (OWNER-ONLY — not for free launch)
- **Clean-Scanned-PDF** — fixed the broken preview (blob URL was revoked by the pdf handle) and rewrote the export loop: render straight to canvas, one JPEG/page, lower raster, bounded concurrency. **~24s for your 116-page book** (was minutes).
- **Share-Safe PDF Check** — per-field metadata checkboxes (keep/remove individually) + a **verified before→after receipt** (re-scans the output: "6 items → none left").
- **Compare PDF** — two-file text diff (per-page similarity, added/removed/changed).
- **Client Packet Builder** — guided workflow + assembles a real merged packet with cover page.
- **Redact + Remove-metadata** — same **verified receipts** (Redact proves selectable-chars → 0, i.e. text truly gone, not just covered).

## 3. Public tool features (live for everyone)
- **Delete Pages → "Detect blank pages"** (auto-selects likely-blank pages).
- **JPG to PDF → "Screenshot Story mode"** (paste screenshots → captioned, numbered pages).

## 4. HTML / TXT / RTF / ODT → PDF (owner-only)
- New `/html-to-pdf` reusing the LibreOffice endpoint. Live-tested: HTML + TXT → valid PDF.

## 5. Reliability
- **Error beacon**: confirmed already built + wired; added a PII scrub (redacts email/URL/token-shaped text before it leaves the browser).
- **Responsiveness pass (COMPLETE)** — every long-running tool now has a **Cancel button + a guaranteed never-stuck spinner**:
  - Rewrite tools (Rotate, Delete, Reorder, Page-numbers, Split, Merge, Watermark) — Cancel terminates the worker.
  - Compress + raster tools (Clean-Scan, PDF→JPG, Extract-images) — cooperative cancel in their loops.
  - Server tools (Office→PDF, PDF→Word) — Cancel via `xhr.abort()`. OCR already had it.
  - Shared infra: `lib/use-cancelable-job.ts` + an optional `{signal}` on the rewrite worker.

## 6. Feature-pack wins
- **Page-numbers font picker** (any bundled family; Node-verified Montserrat renders clean).
- **Page-numbers facing-pages (mirror) mode** (book-style outer edge; Node-verified odd=right / even=left).
- **Crop PDF** (`/crop-pdf`, owner-only) — real drag-to-crop box; lossless `CropBox` op in the worker (cancellable); Node-verified the crop is exact on every page.

## 7. Pricing/gating correction
- Removed a confusing "20 MB size-gate" flag. **Confirmed live state:** client-side PDF tools = **100 MB free**; **OCR = 20 MB free** (its own server-cost lever). Unchanged.

## Still staged (next sessions)
- **Font subsetting for Compress** — the big compression win vs Smallpdf; its own focused, QA-heavy session (corruption-risky).
- Remaining feature packs: visual page-level Merge, Split-by-max-size, Sign initials/date/fields, Extract-images-only for PDF→JPG.
- **Owner real-browser checks** (can't be done from the agent): the Cancel buttons + the owner-only tools before anything flips public.

## Idea on the table (needs your call)
- **Self-healing / auto-patch** — recommend: yes to auto-monitor + auto-*protect* (auto-disable a failing tool via the existing kill-switch + alert) + auto-*draft* a fix; **no** to auto-deploying fixes to production without a human approve. Details in chat.
