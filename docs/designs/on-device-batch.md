# Design — On-device Batch (Pro)

**Status:** shipped (Compress-Image, Compress-PDF) → rolling to Convert-Image, Resize-Image, Rotate-PDF, Remove-Metadata.
**Owner:** DiemDesk. **Last updated:** 2026-07-11.

The flagship Pro differentiator: process a whole folder of files **at once, in the
browser** — nothing uploaded. Competitors that offer batch upload your files to a
server. Ours never leaves the device, so batch is both a convenience win and a
privacy win at the same time. That pairing is the pitch: *"Pro processes them all
at once — privately, on your device, nothing uploaded."*

## The two states

### 1. Gate (Free user, >1 file)
Free users get one file at a time; dropping several surfaces the upsell. It sells
the value (privacy + all-at-once), never scolds.

- Amber→orange gradient card, centered, sparkle badge.
- Heading: **"On-device batch is a Pro feature"**
- Body: *"You dropped **N files**. Pro processes them all at once — **privately, on
  your device**, nothing uploaded. On Free, add one file at a time."*
- Buttons: **"Go Pro — batch all N"** (gradient) · **"Use one file"** (outline).

### 2. Runner (Pro / owner)
- Header chip row: green **On-device** pill + gradient **Pro** pill, `N files`,
  `done/N` counter.
- Per-file list: status icon (queued dot / spinner / green check / red ✗), file
  icon, name, `before → after` size, per-file download; scrolls past ~8 rows.
- Controls slot (per tool — see below) sits above the list.
- Footer: **"Process all (N)"** → on finish → **"Download all (.zip)"**, plus a
  **"Saved X% across N files"** line when the batch actually shrank bytes.
- **Clear** returns to the empty dropzone.

## Per-tool controls
Batch settings are chosen **once** and applied to every file, so any control that
only makes sense per-file is replaced with a batch-appropriate equivalent:

| Tool | Batch controls |
|------|----------------|
| Compress-Image | Quality (Light/Recommended/Strong) · Dimensions cap |
| Compress-PDF | Level (Light/Recommended/Strong/Maximum) |
| Convert-Image | Convert-to format · Quality |
| Resize-Image | **Percentage** or **Fit-within long edge** (absolute px can't apply across mixed sizes) · format · Quality |
| Rotate-PDF | One angle (Right 90° / 180° / Left 90°) applied to **every page** |
| Remove-Metadata | none — strips every file, no options |

## Engineering shape
- One reusable `components/app/batch-runner.tsx`. Props: `files`, `process(file) → {blob,name,before?,after?}`,
  `controls`, `actionLabel`, `zipName`, `fileIcon`, `onReset`.
- Each tool exposes a **headless core** (`fn(file) → blob`) that is byte-for-byte
  the same pipeline as its single-file run, so batch output == one-at-a-time output.
  Image cores live in `lib/image-convert.ts` / `lib/image-compress-core.ts`; PDF
  cores are small closures in each tool.
- Gate is enforced by `usePlan()` + `FREE_MAX_BATCH` (client-side, offline-friendly;
  owner/localhost/Pro-email resolve to `pro`). Merge and JPG→PDF are inherently
  multi-file and stay exempt.
- Zip via lazy `jszip` import with filename de-duplication.

## Copy rules
Human voice only (no AI-tells). "On your device", "nothing uploaded", "all at once".
Never "leverage", "seamless", "unlock the power of".
