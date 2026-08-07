# DiemDesk — Test Catalogue

Every scenario, curated. Structure per the [master plan §7](qa-master-plan.md):
**Cross-cutting** (every page) **×** **Archetype matrix** **+** **Per-route
specifics** **+** **Regression seeds** ([`regression-issues.md`](regression-issues.md)).

Test IDs: `AREA-NNN` (e.g. `XC-001`, `TOOL-CLIENT-004`, `EDIT-012`, `API-AUTH-003`).
Priority: **P0** blocker / promise-guard · **P1** core · **P2** edge/polish.

---

> **Implemented (2026-08-06):** XC-001 → XC-005 and the SEO/sitemap cases are
> live in `frontend/tests/e2e/xc-crosscutting.spec.ts`, driven by
> `_routes.ts` — which reads `app/sitemap.ts`, `DEFAULT_TOOL_FLAGS` and the
> catalog, so the route list can never drift from the app. Engine journeys are
> in `engines.spec.ts` (real files via `_fixtures.ts`); the file-picker
> regressions are in `file-picker.spec.ts`. XC-006 (theme contrast), XC-007
> (axe, focus, Escape) and XC-008 (reduced motion) are in `xc-a11y.spec.ts`,
> written 2026-08-07 — they found REG-023…REG-027 on their first run.
>
> ⚠ Two traps that made early versions of that spec lie:
> `test.use({ reducedMotion: 'reduce' })` does **not** take effect here —
> `matchMedia` still reports no-preference, so the assertions were meaningless.
> Use `page.emulateMedia({ reducedMotion: 'reduce' })`. And next-themes with
> `attribute="class"` adds `dark` but adds **nothing** for light, so light must
> be asserted as the absence of `dark`, not the presence of a class.

## Part 1 — Cross-cutting scenarios (run against EVERY route)

Data-driven: one spec iterates the full route list. `XC-*` cases.

| ID | Scenario | Assert | Pri |
|---|---|---|---|
| XC-001 | Page loads | HTTP 200, no error boundary, `<h1>` present | P0 |
| XC-002 | No console errors/warnings on load | console clean (allowlist known 3rd-party) | P0 |
| XC-003 | SEO meta | `<title>` ≤60, meta description ≤155, canonical, OG tags, JSON-LD valid | P1 |
| XC-004 | Indexability correct | tools/legal indexable; gated/design/dashboard `noindex`; in `sitemap.ts` if public | P1 |
| XC-005 | Responsive 375/768/1280/1440 | no horizontal body scroll, 0 overflowing els, nav usable | P0 |
| XC-006 | Light + dark theme | both designed, contrast AA, no invisible text | P1 |
| XC-007 | Keyboard + a11y (axe) | 0 serious/critical; focus-visible; tab order; Esc closes overlays | P0 |
| XC-008 | Reduced-motion | animations suppressed (splash, hero, tiles) | P2 |
| XC-009 | Header/footer/nav | logo→home, links resolve (no 404), ⌘K opens, theme toggle works | P1 |
| XC-010 | Perf budget (archetype) | Lighthouse meets [budget](qa-master-plan.md#51-performance-budgets) | P1 |
| XC-011 | Security headers | CSP/HSTS/X-Frame-Options present; no secret strings in bundle | P0 |
| XC-012 | 404 & wrong-file | unknown route → styled 404; wrong file type → friendly redirect (`suggest-tool`) | P1 |
| XC-013 | Service worker | SW `no-cache`; deploy invalidates; kill-switch works; **never serves cross-route stale shell** | P0 |

---

## Part 2 — Archetype matrices

Every route maps to one archetype (Part 3). Each archetype's matrix is its full
functional scenario set; wire it with the route's real fixture.

### A. In-browser (on-device) file tool — the core archetype
`compress-pdf, merge-pdf, split-pdf, rotate-pdf, reorder-pdf, delete-pages, crop-pdf,
add-page-numbers, jpg-to-pdf, pdf-to-jpg, extract-images, pdf-to-excel, pdf-to-markdown,
compress-image, convert-image, resize-image, crop-image, heic-to-jpg, remove-background,
remove-metadata, flatten-pdf, sign-pdf, watermark-pdf, protect-pdf, unlock-pdf,
fill-pdf-form, repair-pdf, scan-to-pdf, bates-numbering, pdf-to-audio, compress-to-size,
passport-photo, photo-privacy, share-safe-pdf-check, pdf-viewer, compress-video, video-to-gif`

| ID | Scenario | Assert | Pri |
|---|---|---|---|
| TC-001 | Drop a valid file | processes, result/download appears | P0 |
| TC-002 | Choose-file button | same as drop | P1 |
| TC-003 | **Zero-upload promise** | `UploadWatch` stays `0 bytes`; Network shows no file body leaving | **P0** |
| TC-004 | Output correctness (headless re-read) | re-open output, assert pages/text/dims/quality vs expected | P0 |
| TC-005 | Wrong file type | friendly error + suggested tool, no crash | P1 |
| TC-006 | Corrupt / password-protected input | graceful message, no hang | P1 |
| TC-007 | Huge file (100 MB) | completes or clear guidance; no tab OOM | P1 |
| TC-008 | Cancel mid-run | actually stops; UI resettable | P1 |
| TC-009 | Tab-discard restore | file/edits restored (`useFileSession`) after background discard | P2 |
| TC-010 | "Keep going" handoff | next free tool receives the file, no re-upload; Pro chip routes w/o carrying | P1 |
| TC-011 | Batch (where supported) | multi-file → zip; free=1 gate; Pro=many | P1 |
| TC-012 | Cross-browser | works on Chromium/Firefox/WebKit incl. WASM + fallbacks | P0 |
| TC-013 | Tool-facts + last-improved blocks render | correct data, links resolve | P2 |
| TC-014 | Result quality preview stable | no page jump on click; consistent output | P2 |

### B. Server-conversion tool (metered)
`word-to-pdf, powerpoint-to-pdf, excel-to-pdf, html-to-pdf, pdf-to-word,
pdf-to-powerpoint, pdf-to-pdfa, ocr-pdf`

Adds to A (TC-003 inverts): `SC-001` **counter counts UP and says "processed on
our server"** (honest); `SC-002` uploaded copy deleted immediately; `SC-003`
**3/day free quota** enforced → 4th blocked/upsell; `SC-004` Pro bypass;
`SC-005` server-down → degrade-don't-fail message, no dead-end; `SC-006` output
fidelity re-read; `SC-007` canary bypasses quota (no self-DoS).

### C. Micro-utility (pure client, no file)
`base64, url-encode, html-entities, hash-generator, jwt-decoder, uuid-generator,
csv-to-json, json-to-yaml, csv-cleaner, case-converter, slugify, sort-lines,
regex-tester, lorem-ipsum, timestamp-converter, text-diff, json-formatter,
word-counter, unit-converter, color-picker, password-generator, qr-code-generator,
scan-qr-code, wifi-qr-code, vcard-qr-code`

`MU-001` known-vector correctness (MD5/SHA/base64/JWT/CSV/regex groups — unit-tested);
`MU-002` empty input; `MU-003` huge input (10 MB paste) no freeze; `MU-004` unicode/emoji;
`MU-005` malformed input → clear error not crash; `MU-006` copy-to-clipboard;
`MU-007` both-way round-trip (csv↔json, json↔yaml) lossless; `MU-008` QR scan via camera/file.

### D. AI tool (Pro, server + Claude)
`chat-pdf, summarize-pdf, translate-pdf, pdf-question-generator` (+ in-tool: excel cleanup,
compare-pdf meaning-diff, redact AI-scan, ⌘K natural-language)

`AI-001` gated: anon/free → coming-soon/402/upsell, owner bypass; `AI-002` on-device
text extract, only text sent (never raw file) — assert payload; `AI-003` citations
map to real pages; `AI-004` per-user daily cap + global USD kill-switch (Redis) enforced;
`AI-005` translate weight=3 counted; `AI-006` privacy copy present ("AI runs only when you ask");
`AI-007` graceful when key unset (503 coming-soon); `AI-008` output structure (bold figures,
paragraphs, MCQ answerIndex correct); `AI-009` prompt-injection in doc doesn't exfiltrate.

### E. Editor (Annotate / Redact / Edit) — heavy, owner-gated
`EDIT-*` for Edit; `RED-*` Redact; `ANN-*` Annotate. Shared `EditorShell` frame:
toolbar/rail/contextBar/properties/zoom mount; undo-redo; page nav; auto-restore.
Per-tool specifics in Part 3. **Never regress Edit's Codex-stabilised core.**

### F. Account / auth
`login, register, forgot, reset-password, account, logged-out, dashboard`

`AU-001` register (validation, dup email, weak pw); `AU-002` login + wrong pw 401;
`AU-003` Google sign-in (GIS token, aud check); `AU-004` password reset (single-use,
1h expiry, no enumeration); `AU-005` protected route redirects when logged out;
`AU-006` plan reflected (free/Pro/owner); `AU-007` Stripe portal opens; `AU-008` logout clears;
`AU-009` dashboard = admin-only, human-only counts.

### G. SEO landing / alternative / keyword page
`*-alternative, compress-pdf-to-100kb, us-visa-photo, fill-pdf-form-online,
bank-statement-to-*, remove-exif, blur-image, clean-scanned-pdf, free, why-diemdesk,
compare, overview, tools, developer-tools, changelog`

`LP-001` renders + XC pass; `LP-002` CTA routes to the real tool; `LP-003` competitor
claims precise/sourced (policy); `LP-004` structured data (SoftwareApplication/FAQ/Breadcrumb);
`LP-005` counts are catalog-derived, never hand-typed drift; `LP-006` in sitemap.

### H. Legal / info
`about, privacy, terms, refund-policy, security`
`LG-001` renders, LegalPage JSON-LD; `LG-002` claims match reality (offline claim ⚠ see regressions);
`LG-003` last-updated present; `LG-004` links resolve.

### I. Standalone / account-app
`file-vault, notes, habits, budget, link-in-bio (+ public /u/[slug]), receipt-scanner,
bank-statement-converter (+ /[bank]), client-packet-builder`
Vault: `VA-*` envelope crypto roundtrip, recovery-key path, chunked upload integrity
(SHA-256 identical), quota, recycle-bin, names sealed server-side, never persisted outside E2E store.
Statement converter: `ST-*` **balance verification is the oracle**, Tally XML imports correctly
(debit sign), CSV/Excel/QuickBooks exports, page quota.

---

## Part 3 — Per-route matrix (the checklist)

Legend: Arch = archetype (Part 2). Gate: `pub` public · `soon` owner-only · `pro` Pro.
Every route also gets the full Part 1 cross-cutting pass. "Specifics / edge" lists
what's unique beyond the archetype matrix.

### Home & shell
| Route | Arch | Gate | Specifics / edge |
|---|---|---|---|
| `/` | — | pub | **First-visit splash: SSR-covers from first paint, NO home→splash→home flash (SPLASH-001); once-only; skippable; reduced-motion; home-only.** Hero live-compressor works. Showcase-wall flag. Trust chips centered on mobile. Category nav + "+N more" hidden on mobile. |
| `/tools` | G | pub | full catalog, search, group anchors |
| `/dashboard` | F | soon | admin-only; human-only analytics; date range |
| `/account` | F | auth | plan state; Stripe portal |

### Organize / core PDF (Archetype A unless noted)
| Route | Gate | Specifics / edge |
|---|---|---|
| `/pdf-viewer` | pub | entry point; "Do more" handoff to 8 tools; `?shared=1` share-target; `file_handlers` open-with |
| `/merge-pdf` | pub | visual page-level reorder; drag; bookmarks-not-carried note |
| `/split-pdf` | pub | by-range, by-size (MB cap greedy), per-range multi-output→zip |
| `/compress-pdf` | pub | **27MB→6.8MB benchmark holds; scanned JPX/CCITT path; font-skip on scans; cancel stops; timing labels; −75% vs rivals**; signatures-invalidated fact |
| `/compress-to-size` | pub | exact KB target incl. exam presets; "reached/couldn't reach" honesty |
| `/rotate-pdf` | pub | 1GB in ~56s (stress); one-angle batch |
| `/reorder-pdf` `/delete-pages-from-pdf` `/crop-pdf` | pub | page grid ops; crop `soon` |
| `/add-page-numbers-to-pdf` | pub | facing-pages mirror |
| `/repair-pdf` | pub | corrupted xref recovery (headless proven) |

### Convert (A / B)
| Route | Gate | Specifics / edge |
|---|---|---|
| `/jpg-to-pdf` `/scan-to-pdf` | pub | multi-image assembly; OCR nudge |
| `/pdf-to-jpg` `/extract-images-from-pdf` | pub | JPX/CCITT recovery |
| `/pdf-to-excel` | pub | table reconstruct; editable grid; sheet-per-table; scanned→OCR nudge; borderless-table edge |
| `/pdf-to-markdown` | pub | headings/lists/GFM tables; v1 no image extract (flagged) |
| `/pdf-to-audio` | pub | Web Speech; voice/speed/pitch; follow-highlight; long-utterance chunking; MP3=future Pro |
| `/word-to-pdf` `/powerpoint-to-pdf` `/excel-to-pdf` | pub(B) | LibreOffice; 3/day quota |
| `/html-to-pdf` | soon(B) | — |
| `/pdf-to-word` `/pdf-to-powerpoint` `/pdf-to-pdfa` | pub(B) | server; quota; scanned→OCR; PDF/A pdfaid marker |
| `/ocr-pdf` | soon(B) | server OCR; adds text layer |

### Edit & sign (Archetype E / A)
| Route | Gate | Specifics / edge |
|---|---|---|
| `/edit-pdf` | soon | **Part A regressions: properties panel (X/Y/W/H write-back), context bar, find&replace across doc (multi-page, replace-all, scan-rest), added-text resize grip, Times/Courier→Liberation Serif/Mono preview fidelity, "replaced text still in layer → Redact" honesty.** Paragraph block edit in matched font; add-text; stamps; shapes; image move/rotate/resize; undo/redo; NEVER regress core |
| `/annotate-pdf` | soon | premium toolbar; drag-resize grip; highlight/draw/shapes/stamp; My Library |
| `/redact-pdf` | soon | **true burn (raster, content gone not overlay)**; regex presets + visa chips; AI PII scan (verbatim, review-before-box); select-then-remove box UX; scanned detection |
| `/sign-pdf` | pub | draw/type/upload signature; drag-place; (initials/date parked) |
| `/watermark-pdf` | pub | 29 fonts; opacity; tiling |
| `/protect-pdf` `/unlock-pdf` | pub | encrypt/decrypt; unlock ≠ cracker (owner-pw removal only) |
| `/fill-pdf-form` `/fill-pdf-form-online` | pub | native AcroForm click/Tab; text/tick/date/sign; flatten |
| `/flatten-pdf` `/remove-metadata` `/remove-pdf-metadata` | pub | flatten annotations; strip metadata (content untouched → Redact for content) |
| `/bates-numbering` | pub | continuous across file set→zip; 6 corners; range; padding |
| `/share-safe-pdf-check` | pub | metadata/hidden-data scan report |

### Image / media (A)
| Route | Gate | Specifics / edge |
|---|---|---|
| `/compress-image` `/convert-image` `/resize-image` `/crop-image` | pub | EXIF stripped; quality consistent; resize batch by % or long-edge |
| `/heic-to-jpg` | pub | HEIC decode (patent note); browser fallback |
| `/remove-background` | pub | 46MB model lazy-load; cutout quality |
| `/photo-privacy` `/remove-exif` `/blur-image` | pub | strip EXIF + manual blur free; auto-face-blur + batch = Pro |
| `/passport-photo` (+`/[country]` ×45, `/us-visa-photo`) | pub | 45 specs exact size/bg; face auto-place (FaceDetector) + manual guides; print sheet 300dpi; dynamic route per country |
| `/compress-video` `/video-to-gif` | pub | ffmpeg.wasm; large-file; mute/trim |

### Micro-utilities (Archetype C) — all `pub`
`/base64 /url-encode /html-entities /hash-generator /jwt-decoder /uuid-generator
/csv-to-json /json-to-yaml /csv-cleaner /case-converter /slugify /sort-lines
/regex-tester /lorem-ipsum /timestamp-converter /text-diff /json-formatter
/word-counter /unit-converter /color-picker /password-generator` → matrix C.
QR family `/qr-code-generator /scan-qr-code /wifi-qr-code /vcard-qr-code /tools/qr-code /tools/password` → C + camera/file scan.

### AI suite (Archetype D)
`/chat-pdf /summarize-pdf /translate-pdf /pdf-question-generator` → matrix D. All `soon`/Pro.

### Standalone apps (Archetype I)
| Route | Gate | Specifics / edge |
|---|---|---|
| `/file-vault` | soon(pro) | VA-* crypto/chunk/recovery/bin; owner click-test still pending |
| `/notes` | pub(account) | free ≤10 cap → 402; autosave debounce; tags/search |
| `/habits` | pub(account) | server streaks; free ≤5; 21-day grid; optimistic toggle |
| `/budget` | pub(account) | free ≤50/mo; category totals; month nav; negative-amount reject |
| `/link-in-bio` (+ `/u/[slug]`) | soon(pro) | sanitize (control chars, url schemes, avatar ≤280KB); handle reserve; public SSR OG; view counter |
| `/receipt-scanner` | soon(pro) | Tesseract OCR → editable review (never auto-commit number) → save to budget; image deleted |
| `/bank-statement-converter` (+`/[bank]`, `/bank-statement-to-{csv,tally,quickbooks}`) | soon | **ST-* balance-verify oracle; Tally XML import (debit sign); exports; page quota. Blocks go-public until owner Tally test.** |
| `/client-packet-builder` | pub | multi-doc assembly |

### SEO / info / legal (Archetypes G/H)
`*-alternative (adobe-acrobat/ilovepdf/smallpdf/sejda), /compare, /why-diemdesk,
/overview, /free, /changelog, /developer-tools, /feedback` → G.
`/about /privacy /terms /refund-policy /security` → H.
`/design/brand /design/editor` → internal noindex.

---

## Part 4 — API test matrix (backend, 18 modules)

| Module | Key cases (P0 bold) |
|---|---|
| `auth.js` | **register/login/JWT**, wrong-pw 401, Google token (aud/iss/email_verified), **forgot: single-use+1h+no-enumeration**, reset |
| `stripe.js` | **checkout session**, **webhook flips plan→pro**, **stale-customer retry (degrade-don't-fail)**, portal, `subscription.deleted`→free, `BILLING_ENABLED` gate |
| `convert.js` | **3/day quota**, Pro bypass, immediate delete, canary bypass, buildCmd per engine, kill-switch |
| `ai.js` | **auth+Pro gate**, per-user cap + **global USD kill-switch**, translate weight, key-unset 503, only-text payload, parseJson retry |
| `vault.js` | **ciphertext-only**, one-vault/account 409, **chunked offset guard + exact-size**, quota, bin auto-purge, streamed download; users.id is UUID |
| `bio.js` | **sanitizeConfig** (control chars, url schemes, avatar size), reserved handles, one-page 409, public GET + rate-limit + view counter |
| `notes/habits/budget.js` | auth, **free caps (10/5/50) → 402**, Pro bypass, sanitize, streak calc, negative-amount reject, name NOT NULL |
| `receipts.js` | Pro gate, OCR parse (merchant/total/date/category), image deleted, non-auth 402 |
| `statements.js` | **balance verification**, quota (`STATEMENT_FREE_PAGES`), export formats |
| `ocr.js` | Pro/quota, text-layer output |
| `events.js` | beacon ingest, `pro_used` marker, human-only filter, canary excluded |
| `feedback.js` | store, rate-limit, sanitize |
| `geo.js` | country detect (no PII in URL) |
| `tools.js` | flags endpoint (drives client gating) |
| `user.js` | profile, plan read |
| `waitlist.js` | signup, `WAITLIST_MODE` behaviour |
| *(cross)* | **rate-limit `/api/auth*` (10/10s→429)**, security headers, no 5xx under burst, chunk PUTs exempt from global budget |

---

## Part 5 — Non-functional test list
Perf (`XC-010` + budgets) · Throttle (`NF-THR-001..004` Slow-3G+CPU4× on home/compress/edit/AI)
· Load/stress (`NF-LOAD-*` 100MB/1GB/500-page + backend burst) · A11y (`XC-007` axe per archetype)
· Cross-browser (`TC-012` ×3 engines) · Security (`XC-011` + `SEC-*` gating/authz/sanitize/headers)
· Visual-regression (`VIS-*` snapshots light+dark ×2 widths per archetype). Specs live in
`frontend/tests/e2e/` and `frontend/tests/perf/`.

---

## Part 6 — Fixtures
`frontend/tests/fixtures/`: `sample.pdf` (text), `scanned.pdf` (image-only, JPX),
`contract-27mb.pdf` (benchmark), `times-courier.pdf` (font fidelity), `huge-100mb.pdf`
(generated in CI, not committed), `sample.docx/.xlsx/.pptx`, `photo.heic`, `photo-exif.jpg`,
`table.pdf`, `form.pdf` (AcroForm), `corrupt.pdf`, `encrypted.pdf`. Generators in
`tests/fixtures/gen-*.mjs` (pdf-lib) so large files are made on demand, never committed.

---

## Part 7 — Scaffold status
`playwright.config.ts`, `vitest.config.ts`, `tests/perf/lighthouserc.json` +
`budget.json`, and starter specs (`home.spec.ts` incl. SPLASH-001, `smoke.spec.ts`
data-driven XC pass, `throttle.spec.ts`) are scaffolded under `frontend/tests/`.
One-time install per [master plan §3](qa-master-plan.md#3-tooling-stack-to-install), then `npm run test:all`.
