# Session summary — 2026-07-02 (evening session, all shipped + live-verified)

## 1. NEW TOOL: Extract images from PDF (commit b70714d) — tool #17
`/extract-images-from-pdf` — pulls the actual embedded pictures out of a PDF, client-side.
- JPEG photos: **byte-for-byte original** (zero re-encode — Smallpdf charges for extraction AND re-encodes).
- Screenshots/graphics: lossless PNGs, **SMask transparency composited** (checkerboard preview).
- JPX/CCITT/JBIG2/palette: recovered via pdf.js WASM decode (photos → mozjpeg q90 JPG, fax/alpha → PNG).
- Junk filter: mask streams, <24px, solid-colour patches skipped. ZIP + Keep-moving → JPG-to-PDF.
- KEY FIND: pdf.js image objects resolve ASYNC after getOperatorList() — callback-form `objs.get(id, cb)` required.
- QA: dev-harness/extract-qa.js (real bundled engine) — office 7 imgs, 64MB handbook 48, JPX book 116, text-only 0.
- Live e2e: office 7 imgs/6.3s; book 116 imgs/401s, live progress, zero console errors.

## 2. COMPRESS: Smallpdf office gap CLOSED (commit 4ea8cc0)
Your complaint: jobber file ours 230 KiB @Strong vs Smallpdf basic 220 kB. Root causes found by harness:
- The JPEG fast-skip left "at-target-dims" images untouched even when stored at ~q90 (Word does this) — one 804×391 banner = 17KB.
- 3KB XMP + Info metadata rode along for free.
Fixes: (a) at-target DCT re-encode when bytes-per-pixel > 0.10, accepted only on a ≥15% win (no generational loss for crumbs);
(b) NEW `lib/pdf-sanitize.ts` strips Info/XMP/thumbnails/PieceInfo at every level (lossless + privacy; note shows "metadata cleaned"; FAQ added).
**Live result: 341 → 207 KiB ("8 images recompressed · 2 fonts slimmed · metadata cleaned · 4s") ≈ 212 kB vs Smallpdf 220 kB — WE NOW BEAT SMALLPDF on this file.**
Quality proof: jobber-diff.js pixel-diff all 5 pages mean ≤0.9/255; fine print + hyperlink text verified crisp.
(Orphan-object GC was measured too: ~0 bytes on real files → deliberately NOT shipped; corruption risk > gain.)

## 3. WATERMARK: font families 3 → 6 (commit 4ea8cc0)
Helvetica/Times/Courier (built-ins) + **Oswald** (the Impact look), **Comic Neue**, **Open Sans** — all OFL,
bundled in `public/fonts/` with LICENSES.txt, embedded on demand via @pdf-lib/fontkit (MIT) with subset:true →
stamped PDFs gain only **2.5–5.8KB**. Oswald has no italic (toggle auto-disabled). Helvetica fallback if fetch fails.
QA: wmfont-qa.js all 8 TTFs embed+render PASS; live: all 6 families visible, Oswald/Comic previews verified, no console errors.
(iLovePDF's Lohit Marathi/Devanagari = Indic-script support — separate roadmap item if we want it.)

## 4. NEW TOOL: Remove PDF metadata (commit 7d08a50) — tool #18
`/remove-pdf-metadata` — scans and shows the hidden info (Author, Creator, Producer, dates, XMP size,
thumbnails, PieceInfo; sensitive keys highlighted), one-click strip via the shared lib/pdf-sanitize.ts.
Honest scope note: cleans metadata, does NOT redact page content. Already-clean files → green no-op state.
QA: sanitize-qa.js — output re-scan CLEAN + all pages pixel-identical. Live e2e: found the real author
name ("Michelle Fino") + Word 365 + 3KB XMP on jobber; "Cleaned — 6 items removed · 341 KB → 330 KB". Zero console errors.

## ⚠ 5. HEIC→JPG — NEEDS YOUR DECISION BEFORE BUILDING (licensing)
Every practical browser HEIC decoder wraps **libheif + libde265 (LGPL-3.0)**. LGPL as a separate,
swappable .wasm file with the license text shipped = fine. The real issue is **HEVC patents**
(MPEG LA / Access Advance pools) — decoding HEVC commercially may need a patent license regardless
of the code license; it's why Chrome/Firefox never shipped HEIC support. Thousands of web tools ship
it anyway (enforcement against small web tools is essentially unheard of, but the risk isn't zero).
Options:
  a) Ship libheif wasm + LGPL text + attribution — standard industry practice, accept the gray zone. (My recommendation, flagged for counsel at the pre-launch review.)
  b) Safari-native decode only — zero bundled decoder, but dead-ends Chrome users (violates our fallback rule).
  c) Skip HEIC until counsel review.
Pick one and I'll proceed.

## QA/e2e bar — confirmation
Every item above went through: Node harness against the REAL shipping code (bundled via esbuild) →
tsc + prod build → deploy (npm ci/build/pm2) → SSR title/H1/JSON-LD/canonical/sitemap check → real-Chrome
e2e with staged files → console-error check → staged test files removed from the VPS → benchmark logged
to the test-results memory. That is the standing per-tool pipeline.

## Next up (after your HEIC decision)
rewritePdf worker rollout to Merge/Split/Page-numbers/Watermark applies → watermark layer-below-content →
business blockers (Stripe/billing; domain + SSL). docs/TECHNOLOGY.md + docx refresh also pending (new
tools + compress passes are captured in the compress-tech memory for it).
