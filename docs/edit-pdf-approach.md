# Edit PDF — approach, limits, and why we use a hybrid

_Reference doc. Short and blunt on purpose._

## The problem: a PDF is not a document
A PDF page is **fixed‑position glyph‑drawing instructions**, not paragraphs.
"Hello" is stored as *"draw glyph #43 at x=100, glyph #72 at x=112, …"*. Two hard
walls follow from this:

1. **Subsetted fonts.** To stay small, PDFs embed **only the glyphs actually
   used**. If the file's font has only the letters in "Invoice #204" and you type
   a "Z", **that glyph does not exist in the file** — it cannot be drawn in that
   font, and we don't have the original full font to pull it from.
2. **No reflow.** Fixed layout means a longer word **overlaps** the next one; a
   shorter one leaves a **gap**. There is no paragraph to re‑wrap.

## Two approaches

| | Approach A — Overlay | Approach B — True in‑place edit |
|---|---|---|
| What it does | Adds new text/shapes on TOP of the page | Rewrites the PDF's own text operators |
| Existing text | Untouched (you cover/add over it) | Actually changed + re‑encoded |
| Font of edit | Any font you bring | Must re‑use the original font's glyphs |
| Reflow | n/a | Would need it — PDF can't |
| Feasible in a browser? | Yes | **No** (see walls above) |

## What the market actually does
- **Adobe Acrobat Pro** — the only one doing near‑true editing. Reconstructs
  paragraphs, re‑embeds/substitutes fonts from **Adobe's own font library**,
  reflows within a block. Heavy desktop app; even it falls back to "font not
  available, substituting" often.
- **Smallpdf, iLovePDF** — **Approach A (overlay).** They do NOT truly edit
  existing paragraphs; you add elements on top.
- **Sejda** — a **hybrid**: detects each text run and, to "edit", **precisely
  covers the original and redraws** your new text in a matched font. Looks
  native; is not true re‑encoding.

**Bottom line:** true Approach B in a browser is not achievable — it's a PDF
format limitation, not an effort limitation. Only Adobe does a heavy version.

## What DiemDesk does — the hybrid (max quality that's physically possible)
Private, in‑browser, and better than the overlay‑only competitors:

1. **Precise detection.** pdf.js gives every text run's exact box, size, colour,
   and font (same technique as Redact's search). Click a line → we know exactly
   what and where it is, pre‑filled with the original words.
2. **True re‑encoding where the format allows** (the real Approach‑B tier).
   If the run's font is a **standard base‑14 font** (Helvetica/Times/Courier —
   always available, never subsetted) or a fully‑embedded font that already has
   your glyphs, we edit the text **natively** — no cover‑up.
3. **Seamless cover‑and‑redraw everywhere else** (the universal tier). We sample
   the local background so the patch is invisible, then redraw your text in the
   **closest match from our 30 bundled fonts** at the original size/colour.

### Honest limitation (shown in the UI)
Edits over **photos/textured backgrounds**, or text in **exotic subsetted fonts**,
use the cover‑redraw path and may show a faint patch or a substitute font. For
normal documents (the vast majority) the result looks native.

100% on‑device — the file never leaves the browser (unlike the competitors, who
upload). See [[dailydesk-architecture]].
