# Session summary — 2026-07-02 evening/night (all shipped, deployed, live-e2e-verified)

**19 tools now live.** Commits: b70714d, 4ea8cc0, 7d08a50, a623c00, 0357f79, d0393de.

## Shipped this session
1. **Extract images from PDF** (tool #17) — byte-for-byte original JPEGs, lossless PNGs w/ transparency,
   JPX/CCITT recovery; later sped up 2.9× (401s→139s on the 27MB book) via parallel doc pool + native encode.
2. **Compress: Smallpdf office gap CLOSED** — jobber file 341→207 KiB (Smallpdf: 220 kB). Levers: bpp>0.10
   at-target DCT re-encode (≥15%-win guard) + lossless metadata strip at every level (lib/pdf-sanitize.ts).
3. **Remove PDF metadata** (tool #18) — scan (shows Author/dates/XMP) + one-click clean, pixel-identical.
4. **Watermark fonts → 12-family dropdown** (user corrected me: DROPDOWN like iLovePDF, not buttons) —
   each option rendered in its own face; OFL TTFs + LICENSES.txt; fontkit subset (+2.5-5.8KB).
5. **Bug fixes:** Keep-going rail icons were invisible (tailwind content globs missed lib/ — LESSON:
   any file with literal Tailwind classes must be in the globs); extract speed; auto-allow permissions
   (.claude/settings.local.json defaultMode dontAsk — user-approved).
6. **Worker rollout COMPLETE** — merge/split/page-numbers/watermark applies now in the rewrite worker;
   new single-source architecture: lib/pdf-rewrite-core.ts (all 9 ops, worker + inline fallback),
   lib/pdf-stamp.ts (preview==apply geometry), lib/page-ranges.ts. E2E on 27MB book: merge 2×27MB 43s,
   split ≤35s, numbers 31s, watermark 30s — page responsive, zero console errors.
7. **Competitor-parity features** (per the NEW mandatory rule in memory: scan iLovePDF/Smallpdf/TinyWow
   before every tool/change): Split "Every N pages" mode; Page numbers color/edge-distance/custom {n}/{p}
   templates; **Watermark "Behind content" layer** (content-stream sink; harness-proven text-on-top).
8. **HEIC to JPG** (tool #19, user approved licensing option a) — libheif wasm on-device, separate
   swappable files + LICENSE.txt at /public/libheif/ (LGPL), mozjpeg/PNG out, burst multi-image support,
   batch = Pro lever (first gated tool), 12MP in 15.9s live. **⚠ Counsel-review flag: HEVC patent pools.**

## QA gates now in dev-harness/ (run before touching these areas)
extract-qa.js · sanitize-qa.js · wmfont-qa.js · jobber-sim.js + jobber-diff.js (compress) ·
rewrite-qa.js (ALL rewrite ops incl. under-layer) · heic-qa.js (exact served assets) · fontgut-qa.js

## Feature-pack backlog (from competitor scans — in pending-tasks memory)
Split by max-file-size · smart split · facing-pages numbering · page-number font picker ·
visual page-level merge (Sejda-style) · multi-line watermark text · custom hex colors ·
HEIC decode/encode in a worker (12MP mozjpeg ≈ 10-15s on main).

## Next up
Business blockers: **domain + SSL** (highest leverage — 19 tools invisible to Google behind basic-auth),
Stripe/billing (only thing blocking Pro revenue). Then: PDF metadata sanitizer FAQ SEO pass? (done),
server features (Office/OCR/AI/Vault), QR+Password onto SiteHeader/SiteFooter, per-tool OG images,
VPS Node 20→22, docs/TECHNOLOGY.md + docx refresh, counsel review (privacy claims + HEIC).
