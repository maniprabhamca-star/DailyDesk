# Folder Preview — design spec

**Status:** proposed, not built. Written 2026-08-10 after reading the working BAP
tool at `C:\Mani Documents\MyBiz\BonafideAutoParts\BAP-Website-Migration\design-mockups\_gallery\`
(`preview.js` 274 lines, `index.html` 684, `serve.js` 324 — local-only, unpushed).

## The observation this is built on

Windows Explorer gives you a thumbnail for pictures and videos. For everything
else you get an identical grey icon with a file extension on it. So a folder of
forty PDFs, CSVs, SVGs and markdown files is forty indistinguishable rectangles,
and the only way to find the one you want is to open them one at a time.

That is a real, daily, universal annoyance, and nobody has solved it on the web —
because solving it means reading someone's whole folder, which is exactly the
thing people won't do with a site that uploads their files.

**We can do it precisely because we don't upload.** This is the clearest case yet
of the architecture being the feature rather than a footnote.

## What we are taking from BAP, and what we are not

The BAP tool works and is worth learning from. But it is a **local Node server**
that browses `C:\` and deletes real files with no authentication. Almost none of
it ports.

| Their piece | Take it? | Why |
|---|---|---|
| `classify()` — ~50 extensions → a render strategy | **Yes, the idea** | The three-way split is the insight: *render it* / *list it and say why we can't* / *ignore it entirely*. Silently dropping unknown types made folders look emptier than they were. |
| Lazy-load queue (3 concurrent, 15 live, evict furthest from viewport) | **Yes, adapted** | They hit this wall the hard way — a screenful of live previews pegged the renderer. |
| `preview.js` renderers (markdown, csv, json, code, font) | **Mostly no** | Ours are better where they overlap: `md-render.ts` has GFM tables and escapes first; `pdf-render.ts` is pdf.js with WASM and DPR awareness. Their PDF preview is an `<iframe src>`. |
| Font specimen + code tinting | **Yes, small** | Two renderers we genuinely don't have. |
| `serve.js` + the delete flow | **No** | Browses the whole drive, no auth. A browser can't and shouldn't. |

Two gotchas they already paid for, which we inherit for free:

- **A PDF iframe must NOT carry `sandbox`.** Chrome's PDF viewer is a plugin
  document; sandboxed, it renders nothing. They measured it.
- Escape **before** applying inline formatting, never after.

## Architecture — the two decisions that matter

### 1. How we get the folder

A browser cannot be handed a path. Two mechanisms exist and we need both:

| | `<input webkitdirectory>` | `showDirectoryPicker()` |
|---|---|---|
| Support | Chrome, Edge, Firefox, Safari 14+ | **Chrome/Edge only** |
| Gives | a snapshot `FileList` | a live directory handle |
| Re-scan without re-picking | no | yes |
| Delete | impossible | possible, with granted permission |

**Baseline is `webkitdirectory`** so the tool works everywhere. The directory
picker is a progressive enhancement that unlocks re-scan and triage. This matches
the standing rule: every tool works in every browser, and the fallback is never a
dead end ([[dailydesk-cross-browser-fallbacks]]).

### 2. What actually renders — and why most of it needs no iframe

The BAP tool renders *everything* through an iframe because its previews arrive
as HTML from a server. We generate previews ourselves, so most kinds can render
as plain DOM straight into the card:

| Kind | How | Iframe? |
|---|---|---|
| image, svg | `<img>` on a checkerboard, blob URL | no |
| markdown | `renderMarkdown()` — ours, GFM tables | no |
| csv / tsv | `sheet-io.ts` parser → first ~20 rows | no |
| json | shape summary + tinted body | no |
| code / text | first ~80 lines, numbered, light tint | no |
| font | `@font-face` from a blob URL + pangram | no |
| **pdf** | `pdf-render.ts`, **page 1 only, to a canvas** | no |
| **html** | blob URL in a sandboxed iframe | **yes** |
| unsupported | a card saying which type and why | no |

**This is a real improvement on their design.** Only HTML needs an iframe, so the
iframe budget applies to a small minority of files rather than all of them. PDFs
become a canvas render of page one — cheaper, sharper, and it reuses the engine
we already trust.

⚠️ `pdf-render.ts` carries known traps: `page.render()` without `intent:'print'`
hangs forever in a background tab, and re-rendering after `page.cleanup()` never
resolves ([[dailydesk-render-handle-bloburl-gotcha]]). A grid renders many PDFs
while the tab may be backgrounded — this is the single most likely place for this
tool to hang, and it must be verified with the Node harness, not the browser pane.

### The work budget

Adapted from theirs, with the numbers re-cast because our units differ:

- **3 concurrent renders**, whatever the kind.
- **15 live iframes** (HTML only) before evicting the furthest from the viewport.
- **~40 decoded images/canvases** held; beyond that, revoke blob URLs and drop
  back to the placeholder. A 2000-file folder must not hold 2000 bitmaps.
- **256 KB read cap per file** for text-shaped kinds — theirs, and correct.
- A **5-second per-item timeout** so one pathological file never stalls the queue.

## Triage — look, then delete

Previewing without acting is half a tool. The reason you're staring at a folder
is usually to decide what to keep.

- **Delete requires the directory-picker path** (Chrome/Edge). On the fallback,
  the button is absent and the tool says why rather than failing on click.
- **Move to a `_trash` subfolder, do not `removeEntry`.** Their tool does exactly
  this and it is the right call: a web page permanently deleting someone's files
  with no undo is indefensible. Emptying the trash is a separate, explicit act.
- **Multi-select and a running count** — "12 selected · 340 MB" — because the
  actual job is usually "clear the junk", not "delete this one".

## What it will not do

Stated on the page, in our usual way:

- It reads the folder you pick. It does not upload anything, and it cannot see
  any other folder.
- `.psd`, `.ai`, `.docx`, `.xlsx`, `.pptx` are listed with a reason, not
  rendered. (`heic` we *can* decode — our `heic-to-jpg` engine already does.)
- Very large folders will be slow before they are useful. We should say where
  that line is once measured, not guess at it here.
- No recursion beyond the depth you ask for. A `node_modules` folder must not
  silently become 40,000 previews.

## Why this is worth building

1. **A search surface our conversion routes don't serve.** "CSV preview online",
   "SVG viewer", "markdown preview", "view files without opening them" — informational
   intent, and our tools are all transactional today.
2. **It proves the grid before File Vault needs it.** File Vault thumbnails are
   the obvious next step, but the vault is end-to-end encrypted: the server can
   never render a thumbnail, so they must be generated client-side at upload and
   stored as their own encrypted blob. That's a schema change. Building the
   standalone tool first de-risks it with no crypto involved
   ([[dailydesk-preview-grid-from-bap]]).
3. **It is the sharpest demo of the whole product thesis.** "Drop in a folder,
   see everything, nothing uploads — check the Network tab."

## Build order

1. `lib/file-classify.ts` — the extension map and three-way `classify()`. Pure,
   unit-testable, no DOM. Reuse for upload routing later.
2. `lib/folder-read.ts` — both access paths behind one interface, feature-detected.
3. The grid with **images and text kinds only**. No PDF, no HTML. Prove the
   queue, eviction and memory ceiling on a big real folder first.
4. Add PDF page-one canvas rendering. Verify against the Node harness for hangs.
5. Add HTML iframes, sandboxed, with the budget.
6. Triage: select, move to `_trash`, undo. Chrome/Edge only, absent elsewhere.
7. Ship gated (`coming_soon`), owner-only, per the standing rule.

Steps 1–3 are the ones that decide whether this is a real tool or a nice demo.
If the grid isn't pleasant on a folder of 300 mixed files, stop there.
