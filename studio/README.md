# DiemDesk Studio — WIP branch (`diem-studio`)

This branch holds the in-progress **DiemDesk Studio**: a private, **on-device**, no-watermark
design studio (a Canva/Adobe-Express alternative), planned as a **Pro** feature. It lives on its
own branch so it never touches the live product on `main`. We resume it **after** the tool
roadmap (#3 Fill-form → #6 PDF→Excel) and the operational pending items ship on `main`.

## Where things are
- **Concept & plan:** `docs/designs/diemdesk-studio-concept.md` (also on `main`) — positioning
  (win on privacy + integration, not template volume), phased scope (MVP → brand kit → AI), naming.
- **Base to reinvent:** [`studio/base/hero-banner-generator.html`](base/hero-banner-generator.html)
  — the owner's single-file **vanilla-JS + HTML5-Canvas** banner generator. It already does:
  image upload (FileReader), **layers with opacity**, multiple logos, text, background processing
  (`putImageData`), rounded-rect/reflection drawing, and export via `toDataURL` (PNG/JPEG quality).

## Reinvent path
Port the base's canvas/layer engine into the Next/React app, then wrap it with **template presets**,
**platform sizes** (IG / LinkedIn / YouTube / FB / poster / certificate / business card), the
**brand kit** (already a planned Pro differentiator), and our export pipeline (PNG/JPG/PDF + compress).

## Keeping this branch fresh
Periodically merge `main` in so the branch doesn't drift before we resume:
```
git checkout diem-studio && git merge main
```
