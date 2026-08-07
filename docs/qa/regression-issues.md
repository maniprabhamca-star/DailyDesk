# DiemDesk — Regression Issue Log

Every issue the owner has raised (or we've hit) → the automated test that now
guards it. **Rule: no bug is closed until a test reproduces it and proves the
fix.** New issues get appended here with a `REG-NNN` id and wired into
[`test-catalog.md`](test-catalog.md).

Status: 🔴 test not written · 🟡 test written, not in CI · 🟢 guarded in CI.

---

## This session (2026-07-24 → 07-28)

| ID | Issue (owner-raised / found) | Guarding test | Layer | Status |
|---|---|---|---|---|
| REG-001 | **First-visit splash flashed home → splash → home** (client-rendered, home painted first) | `SPLASH-001`: overlay present in **home SSR HTML**; absent on tool pages; returning-visitor guard class hides pre-paint + unmounts; no hydration error | E2E + SSR assert | 🟡 |
| REG-002 | **Splash never auto-dismissed / click didn't skip** (motion.div had no `animate`, AnimatePresence exit hung) | `SPLASH-002`: first-timer overlay shows then fades to gone within HOLD+FADE; keydown/pointer/scroll skips within ~0.5s | E2E | 🟡 |
| REG-003 | Splash must be **once-only + home-only + reduced-motion-safe** | `SPLASH-003`: reload after first view → not shown; not present on `/compress-pdf`; reduced-motion → never shown | E2E | 🟡 |
| REG-004 | Mobile: **hero trust chips not centered** | `HOME-M-001`: at 375px chips `justify-content:center`, symmetric gutters; at ≥640px `flex-start` | E2E responsive | 🟡 |
| REG-005 | Mobile: **empty "+N more" box** beside the tile (redundant with "See all") | `HOME-M-002`: at 375px 0 "+N more" tiles visible; at 1280px they return | E2E responsive | 🟡 |
| REG-006 | Edit PDF **had no properties panel / context bar** (only editor without one) | `EDIT-001`: panel renders; X/Y/W/H reflect selection (X=10.4% on 62/595pt fixture); editing a field moves block + enables Save/Undo; undo reverts | E2E + component | 🟡 |
| REG-007 | Edit PDF **no document-wide find & replace** | `EDIT-002`: find counts matches on detected pages; "scan the rest" walks undetected pages; replace-all writes through block path; export re-read shows replacements drawn | E2E + headless | 🟡 |
| REG-008 | Edit PDF **added-text box had no resize grip** | `EDIT-003`: selected added-text shows corner grip; drag scales font; arrow keys resize | E2E | 🔴 |
| REG-009 | Edit PDF **Times/Courier redrawn in OS font, not matched** | `EDIT-004`: on times-courier fixture, panel says "Bundled twin"; canvas pixel-diff vs OS Times > 0 (Liberation applied); lazy-loaded only when family present | E2E + component | 🟡 |
| REG-010 | **Replaced/edited text still copyable from the file** (cover, not delete) — honesty | `EDIT-005`: after replace, UI states original remains in text layer + links to Redact; export headless confirms both strings present (documented contract) | E2E + headless | 🟡 |
| REG-011 | Tool pages **identical to competitors** — no differentiators | `TOOLPAGE-001`: UploadWatch + tool-facts + last-improved render on tools with data; degrade cleanly where absent | E2E | 🟡 |
| REG-012 | **Upload counter must never lie** (site makes same-origin requests) | `TOOLPAGE-002`: counter `0 bytes` on load despite analytics beacon; flips to "N MB uploaded" + amber on a real multipart POST | E2E + component | **🟡 P0** |
| REG-013 | **Recurring: dev service-worker serves stale home shell** (cost time ×3 this session) | `XC-013` + a dev-checklist doc note; SW `test:sw` (17/17); prod SSR asserted fresh | mixed | 🟡 |
| REG-014 | Showcase-wall shipped but **must stay off in prod** pending decision | `HOME-003`: with `SHOW_SHOWCASE_WALL=false`, wall not in prod HTML | E2E/SSR assert | 🟢 (verified on prod) |

## Live-user reports (2026-08-06)

| ID | Issue (owner-raised / found) | Guarding test | Layer | Status |
|---|---|---|---|---|
| REG-015 | **File picker never opened for a real user.** The input was `display:none` (Tailwind `.hidden`) — the documented reason iOS Safari refuses to open a picker: the element isn't laid out, so the forwarded tap goes nowhere. Failed consistently for some browsers, never for others. | `file-picker.spec.ts` → *no file input is display:none* (per tool page) + *does not reintroduce `.hidden`* — **runs on WebKit**, the engine that punishes it | E2E ×4 engines | 🟢 |
| REG-016 | **Dead window before hydration.** Every dropzone opened the picker from a React `onClick` and the served HTML has no `<label for>`, so a tap between first paint and hydration did **nothing** — silently, with no error for the beacon to catch. | `file-picker.spec.ts` → *rescue script is served, parses, and is early* (also asserts **no `//` comments**, after a one-line minified version commented out the whole script) + *a click in the dead window opens the picker, and only once* | E2E | 🟢 |
| REG-017 | **Hydration mismatch on `/color-picker` + `/pdf-to-audio`** (React #418/#423). Capability checks (`'EyeDropper' in window`, `'speechSynthesis' in window`) ran during render, so the server said false and the browser said true. React then discarded the server DOM and re-rendered — which *lengthens* the REG-016 dead window. **Found by the new suite, not by a user.** | `xc-crosscutting.spec.ts` → XC-002 console-error assertion on every route; fixed with `lib/use-client-capability.ts` | E2E, all routes | 🟢 |
| REG-018 | **Titles over 60 characters** get truncated in search results (silent click-through loss). `/bates-numbering` was 61. | `xc-crosscutting.spec.ts` → XC-003 title ≤60 / description ≤155 on **every** route | E2E, all routes | 🟢 |
| REG-019 | A public tool **missing from the sitemap** is invisible to search; a gated tool **present** in it advertises a locked door. | `xc-crosscutting.spec.ts` → *no gated route is advertised* + *every public route is advertised* + *every advertised URL is real and indexable* | E2E | 🟢 |
| REG-020 | A catalog tile pointing at a **missing page** (404) — the kind of thing a rename leaves behind. | `file-picker.spec.ts` → *every tool tile points at a real page* | E2E | 🟢 |
| REG-021 | **Every pre-existing gated tool was still `index, follow`** — `/chat-pdf`, `/ocr-pdf`, `/redact-pdf`, `/file-vault`, `/workflows` and 9 more were serving a "coming soon" panel to Google. Found by the suite, not by a person; 14 pages fixed. | `xc-crosscutting.spec.ts` → XC-004 *gated ⇒ noindex* on every route | E2E, all routes | 🟢 |

## Historical (from project memory — seed the suite)

| ID | Issue | Guarding test | Status |
|---|---|---|---|
| REG-101 | **Compress gave up on scanned PDFs** (JPX/CCITT) — rivals returned ~1% | `COMPRESS-001`: 27MB scan → ≥60% smaller, still legible (headless re-render) | 🔴 |
| REG-102 | Compress **cancel didn't stop** rasterization | `TC-008` on compress | 🔴 |
| REG-103 | Edit PDF **scrambled saved PDF** (fontkit subset corrupts Carlito) | `EDIT-006`: export with bundled font → headless render legible, not scrambled | 🔴 |
| REG-104 | Edit PDF **wrong font shape** (Calibri redrawn as LiberationSans) — the ~50-round saga | `EDIT-007`: detects Calibri→Carlito; redraw matches | 🔴 |
| REG-105 | **Redact placed 83 boxes for 30 findings** (window stitching) / reverse-fragment containment | `RED-001`: real statement → grouped rows, boxes = values, 0 unplaced, no amount-cell over-cover | 🔴 |
| REG-106 | Redact **stray tap silently deleted a box** (privacy hazard) → select-then-remove | `RED-002`: tap selects (not deletes); explicit remove pill | 🔴 |
| REG-107 | **Checkout dead-ended** on stale `stripe_customer_id` (mode switch) | `API-STRIPE-003`: stale customer → retry with email, fresh customer, no 500 | 🔴 |
| REG-108 | **"Works fully offline" was false** after SW caching was removed; and cross-route `caches.match('/')` served stale home | `XC-013` + copy audit: no "fully offline" claim; SW never serves cross-route shell | 🟡 |
| REG-109 | Canary **self-metered the 3/day quota** → auto-disabled tools | `API-CONVERT-005`: canary token bypasses quota; 429/503 never auto-disable | 🔴 |
| REG-110 | Mobile **back-scroll bug** (forced `scrollRestoration=manual`) | `XC-005` + scroll-restoration test | 🔴 |
| REG-111 | **Count drift** (hand-typed "35+/50+") | `LP-005`: all counts catalog-derived; grep guard for hardcoded "N tools" | 🔴 |
| REG-112 | Bio **abandoned schema shadowed real table** | `API-BIO-004`: config-JSONB table used; sanitize 11/11 | 🟡 |
| REG-113 | **Pro tool missing from `PRO_TOOLS`** → no badge/gate | `SEC-002`: every Pro/gated route 402/upsell by direct URL; badge present | 🔴 |
| REG-114 | AI/translate **run-on unformatted output** (extraction lost line structure) | `AI-008`: extraction preserves `hasEOL`; output paragraphs/bullets | 🔴 |

---

## How to add a new one
1. Append a `REG-NNN` row with the exact symptom + root cause.
2. Write the smallest test that **fails on the old behaviour**.
3. Fix (or confirm fixed), watch it go green, set 🟢 once in CI.
4. Cross-link the test id into [`test-catalog.md`](test-catalog.md).
