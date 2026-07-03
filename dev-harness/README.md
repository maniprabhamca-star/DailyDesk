# Dev harness scripts (Node — not part of the app build)

Setup: `npm i pdf-lib pdfjs-dist@6.1.200 @napi-rs/canvas` in this folder (or run
from a folder that has them). Node 22+ recommended (pdfjs v6 engines).

- `compress-sim.js` — end-to-end simulation of the Compress raster pipeline
  (scan pages) on a real file; args: rasterDpi rasterQ rasterFrac.
- `office-sim.js` — the FlateDecode-screenshot surgical pass simulation.
- `fontgut-sim.js` — FONT SUBSETTING v1 ("glyph gutting": empty unused glyph
  outlines in glyf/loca, keep all ids/cmap intact). Handles simple /TrueType
  (WinAnsi + cmap 3,1 fmt4) and /Type0 CIDFontType2 Identity-H (codes = gids).
  RESULT on "FTP Access Dropship (2).pdf": fonts 116KB->68KB, file 166->113KB
  (32% from fonts alone) — BUT the QA found MISSING GLYPHS (see below).
- `fontgut-qa.js` — renders every page of original vs gutted and pixel-diffs.
  THE GATE: ship nothing until this reports PIXEL-IDENTICAL on multiple files.
- `extract-qa.js` — QA for the Extract Images tool. Bundles + runs the REAL
  shipping engine (`frontend/lib/pdf-extract-images.ts`) and mirrors the
  component's pdf.js recovery pass. Rebuild the bundle after engine changes:
  `npx -y esbuild frontend/lib/pdf-extract-images.ts --bundle --platform=node
  --format=cjs --external:pdf-lib --outfile=dev-harness/extract-engine.cjs`
  (from repo root). Validates JPEG magic+decode+dims, RGBA non-uniformity, PNG
  encode; outputs land in `extract-out/<file>/` for eyeballing. Verified
  2026-07-02: gut-ftp1 7 imgs (1 original JPG + 6 lossless PNG), gut-handbook
  48 imgs (incl. SMask alpha composites), gut-book 116 imgs (114 JPX recovered
  via pdf.js callback-form objs.get — the sync form throws "not resolved yet"
  because image data arrives AFTER getOperatorList resolves), text-only 0 imgs.
- `compose.js` — byte-composition analyzer (images/fonts/XMP/content per file).
- `jobber-sim.js` — full office compress pipeline sim (surgical + REAL fontgut
  lib bundled to fontgut-lib.cjs, needs react-stub.cjs alias + the fetch shim
  for /pdfjs assets + file:// workerSrc). Proved the two 2026-07-02 levers:
  re-encode at-target DCT when bpp>0.10 (17KB) + metadata strip (3KB) →
  jobber.pdf 349,044 -> 224KB sim / 207KiB live (Smallpdf basic: 220kB).
- `jobber-diff.js` — page-render pixel-diff of original vs compressed.
- `wmfont-qa.js` — embeds every public/fonts TTF via @pdf-lib/fontkit
  (subset:true) + renders; note fontkit CJS default-export interop.
- `sanitize-qa.js` — real lib/pdf-sanitize.ts (bundle to sanitize-lib.cjs):
  scan -> strip -> output re-scan must be CLEAN + pixel-identical renders.
- `flatten-qa.js` — THE GATE for Flatten PDF: builds a fillable fixture
  (text field + checkbox), flattens with the EXACT shipping qpdf args
  (keep in sync with frontend/lib/qpdf-args.ts — no `--` separator), asserts
  0 fields/widgets remain AND the values are still inked (pixel check), runs
  the REAL lib/pdf-flatten.ts scan (bundle to flatten-lib.cjs), and checks
  encrypted input fails with exit 2 (mapped to "unlock first" in the UI).
- `scan-qr-qa.js` — THE GATE for the Scan QR tool: real lib/qr-parse.ts +
  lib/qr-payload.ts (bundles qr-parse-lib.cjs / qr-payload-lib.cjs), 28
  checks: every payload type round-trips through generate->jsQR->parse incl.
  escaping-heavy Wi-Fi/vCard, MECARD->.vcf, inverted codes, a QR embedded in
  a 1920×1080 screenshot, and our own styled (rounded+gradient) QR output.

## Font subsetting — state as of 2026-07-02
Corruption found: gutted output drops letters (D,O,M,N,G,b,f,g,z…) on page 1
(0.2% px diff) → the hand-rolled content-stream text collector misses some
show-text cases (suspect: escapes/octals or ops desync; possibly Form XObjects).
NEXT APPROACH (v2, much more robust): use pdf.js `page.getTextContent()` (or
getOperatorList) as the AUTHORITATIVE used-character source per font instead of
the hand-rolled parser — pdf.js already handles every operator/escape/XObject
case; map its font ids back to the PDF font dicts via commonObjs (BaseFont
match). Keep the gutting core (it's sound: ids/cmap untouched); only the
used-code COLLECTION needs replacing. Then: pixel-QA must pass on the FTP file,
the chess book, and 2+ more real docs before wiring into compress-tool.
