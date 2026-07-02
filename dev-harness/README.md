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
