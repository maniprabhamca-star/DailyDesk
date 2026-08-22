# DiemDesk — Session Handover (2026-08-22)

Paste this whole file into a fresh session as the opening message.

---

## 0. HOW TO REPLY TO ME (standing, non-negotiable)

**Crisp summary + action items only. No commentary, no essays, no narration.**
I have now asked three times. Reply shape: *what changed → state (green/live/blocked) → action items*. Causes and reasoning go in the commit message and memory, not in chat. Tables and one-line bullets over paragraphs. Corrections: state the fact once, move on.

Also standing:
- **Be proactive** — recommend as problem → fix → quantified benefit → "want me to do it?". Just do cheap/reversible things; only ask for risky ones.
- **Never overwrite** hand-maintained docs/artifacts — update in place.
- **Auto-update** `/overview`, `docs/designs/master-roadmap.md` and the status board after every ship, unasked. Counts are catalog-derived, never hand-typed.
- **Auto-add** a user-facing `/changelog` entry (`frontend/lib/changelog.ts`) with every meaningful public ship.
- Copy must not read as AI-generated. Design intelligently — never insert UI literally as described. Mock up before building.

---

## 1. PRODUCT

**DiemDesk** — https://diemdesk.com — privacy-first, on-device document toolkit. ~57 live tools, 149 routes. Files are processed in the browser; nothing is uploaded. That constraint is the moat and the marketing.

- Repo: `C:\Mani Documents\MyBiz\DailyDesk` (frontend + backend one checkout), GitHub `maniprabhamca-star/DailyDesk`, branch `main`.
- Stack: Next.js 14 App Router · TypeScript (**ES5 target — no Map/Set spread; use `Array.from`**) · Tailwind · Playwright + Vitest · pm2 on a VPS.
- Business: USA / Georgia LLC. Site is **public**; Stripe is **built, live and keyed**. **Revenue is blocked only by `WAITLIST_MODE=true` in `lib/flags.ts`.**

---

## 2. EXACT CURRENT STATE

| | |
|---|---|
| `main` HEAD | `1fd65d6` |
| Prod checkout | `1fd65d6` (in sync, frontend rebuilt + pm2 reloaded) |
| CI | **green on all 5 browsers** (chromium, firefox, webkit, edge, mobile) |
| Unit tests | 127/127 across 8 files |
| Full chromium e2e | 394 passed |

Last five commits:

```
1fd65d6 test: let XC-006 wait for the page to stop changing its mind
f2f734f fix: say what happened when a folder move fails
a210e24 test: stop assuming every preview renders at once
bd72f3e test: Folder Preview builds its own fixture folder
2df49b4 feat: undo a delete, and confirm before a bulk one
```

Working tree has **uncommitted**: `.claude/launch.json` (modified) plus many untracked `SESSION-HANDOFF-*.md` and `dev-harness/` scratch files. Nothing load-bearing.

---

## 3. WHAT THIS SESSION DID

### Folder Preview write-path bug (owner-reported, fixed, live)

Owner selected 24 files in `/folder-preview`, pressed **Move to trash**, saw nothing — no result, no error, no way back. Three compounding faults, all fixed in `f2f734f`:

1. **Chrome does not keep a `readwrite` grant.** `showDirectoryPicker({mode:'readwrite'})` grants at pick time and silently downgrades to `prompt` (long-lived tab, sensitive folder, or the user chose "View files"). Every write then threw `NotAllowedError`. → `ensureWritable(handle)` in `lib/folder-read.ts`: `queryPermission` then `requestPermission`, **called inside the click handler** (needs a live user gesture). Refuses with an actionable sentence; the selection is kept so the user can grant and retry.
2. **Feedback rendered below the grid.** The result line *and* the Undo button sat under up to 2000 cards — invisible. → moved to a **`fixed` bottom dock** with a live `Moving N of M…` progress count. ⚠️ `sticky` cannot work here: the tool's root card is `overflow-hidden`, which makes it the sticky element's scroll container, and that never scrolls.
3. **`catch { failed.push(name) }` swallowed the reason** — a permission error was indistinguishable from a bug. → keeps the first real `e.message`.

**The write path had ZERO test coverage.** That is why it reached the owner. `tests/e2e/folder-preview.spec.ts` now stubs `window.showDirectoryPicker` via `addInitScript` with an in-memory folder (`withFakeFolder`) — `values()`, `getFileHandle`, `getDirectoryHandle`, `createWritable`, `removeEntry`, `queryPermission`/`requestPermission`. Setting permission to `'prompt'` reproduces the reported bug exactly. 14 tests now.

Verified live in a real browser: confirm dialog with correct count + size; dock visible at y=646 while scrolled 2191px down; Undo restored all 5 files; permission failure showed its message with all files intact.

### XC-006 flake (`1fd65d6`, test-only)

`/pricing` and `/changelog` failed a full parallel run, passed 33/33 alone. `visit()` uses a fixed `waitForTimeout(SETTLE)` then a single computed-style read — a loaded run is still hydrating, or mid colour-transition where a colour genuinely passes through its own background. Now `expect.poll(...)` until stable. Same lesson as REG-041.

---

## 4. ⏰ IMMEDIATE NEXT STEPS (owner)

1. **Hard-refresh `https://diemdesk.com/folder-preview` (Ctrl+Shift+R)** — the service worker serves stale JS — then retry the same `Screenshots` folder. Expect: progress counter + visible result, **or** a plain-English permission message.
2. **Check for a `_trash` folder inside `Screenshots`.** If absent, the writes were failing on permission and **nothing was ever moved** — no files lost.
3. **Test the delete-account flow on a THROWAWAY account** (long-outstanding; owner asked to be reminded). Sign up → add data → `/account` → Download everything → Delete → email+password gate → `/account-deleted` → confirm login dead and rows gone from DB. Built + E2E-tested against stubs, but nobody has watched a real account be destroyed.

---

## 5. OPEN DECISIONS

- **Un-gate Folder Preview?** Technically ready, owner-verified. Five edits in `docs/designs/master-roadmap.md` §2c: drop `'/folder-preview': 'coming_soon'` from `lib/tool-flags.tsx`; drop `soon: true` in `components/app/catalog.tsx` (keep `newUntil`); add to `app/sitemap.ts`; drop `robots: {index:false}` in `app/folder-preview/page.tsx`; retitle the `lib/changelog.ts` entry from "Coming soon:".
- **⚠️ Pricing conflict, unresolved.** Folder Preview would be the first public in-browser tool with a cap (30 free / 2000 Pro). That contradicts the canonical *"Every in-browser tool, no daily cap"* line. Decide: reword the promise, or drop the free cap.
- **No `/changelog` entry** was added for this fix — the tool is still owner-gated. Add at un-gate.
- **Revenue flip:** `WAITLIST_MODE=false` in `lib/flags.ts` whenever you want to sell.
- Counsel review of `/for/healthcare`; Cloudflare "Block AI Bots" master switch; Cloudflare Full-strict upgrade; USPTO check. SDK licence is **parked** — do not raise it.

---

## 6. ⚠️ TRAPS — read before trusting any local test run

1. **`next start` serves a PREBUILT `.next`.** `playwright.config.ts` runs `npm run start`, not `next dev`. Edit source → run Playwright → **you test the OLD bundle**. This session reported "24 passed" on code never exercised. **Always `npm run build` first.** `reuseExistingServer: !CI` also reuses a stale server — free port 3100 or set `E2E_FRESH_SERVER=1`.
2. **`npm run dev` WIPES the production `.next`** — the next e2e run dies with "Could not find a production build". After any dev-server/preview session, rebuild before testing.
3. **Fixtures must be generated in `tests/e2e/_fixtures.ts`, never committed.** `tests/.fixtures/` is gitignored — a hand-made fixture is local-green, CI-red with ENOENT on all five browsers. Verify by deleting `tests/.fixtures` entirely and re-running.
4. **Fixed wall-clock waits flake under parallel load.** Poll (`expect.poll` / `.toPass()`) until the answer stops moving. Never file a defect off ONE sample on a loaded machine — REG-041 was withdrawn for exactly that.
5. **Lazy loading ≠ everything rendered.** At 412px most grid cards are below the fold. Scroll the target into view and assert that tile, not the whole page.
6. **vitest can silently drop test files** — saw "1 passed (1), 16 tests" when the truth is 8 files / 127 tests. `pool: 'threads'` is deliberate (`forks` fails on paths with spaces — "Mani Documents"). **Always sanity-check the count.**
7. **Firefox will not launch on this Windows box** (`spawn UNKNOWN`) — machine, not code. Trust CI for that engine.
8. **Don't pipe long background test runs through `tail`** — you lose the failure detail.
9. **React: refs read inside lazy `setState(fn)` updaters are stale.** Bit this codebase twice in Folder Preview. Capture the value *before* the updater.
10. **Tailwind tokens need `<alpha-value>`** or opacity modifiers generate no CSS at all.
11. **pdf.js:** `intent:'print'` is required or rAF pacing hangs in a backgrounded tab; re-rendering after `page.cleanup()` never resolves.
12. **"Public sees coming-soon" is untestable locally** — `lib/plan.ts` grants owner bypass on localhost, so under test everyone is the owner. Needs a non-local hostname.

---

## 7. DEPLOY RUNBOOK

```bash
ssh root@2.25.71.126
cd /var/www/dailydesk && git pull --ff-only origin main
cd backend && pm2 reload dailydesk-backend --update-env
cd ../frontend && npm ci && npm run build && pm2 reload dailydesk-frontend --update-env
```

- SSH **by IP** — the domain is Cloudflare and port 22 is not proxied.
- Ports: frontend 3000 · **backend 4000** (not 5000) · separate admin app.
- `/api/health` does not exist — a 404 there is normal. Prove the API alive by POSTing bad credentials to `/api/auth/login` and expecting **401**.
- **`--update-env` matters** — without it pm2 reuses the old environment.
- **Prod `.env` OVERRIDES code defaults.** Grep it before assuming a default applies.
- **Prod does not auto-deploy** and drifts behind main. Check first: `git log --oneline HEAD..origin/main`.
- Test-only commits need no rebuild.

---

## 8. KEY FILES (Folder Preview)

| File | Role |
|---|---|
| `frontend/components/tools/folder-preview-tool.tsx` | the tool (~750 lines): grid, viewer, selection, trash, dock, confirm dialog |
| `frontend/lib/folder-read.ts` | both access paths + `moveToTrash` / `restoreFromTrash` / `ensureWritable` |
| `frontend/lib/file-classify.ts` | three-way classify: render / list-with-reason / ignore |
| `frontend/lib/folder-pdf-thumb.ts` | page-one canvas via our own pdf.js |
| `frontend/tests/e2e/folder-preview.spec.ts` | 14 tests incl. the `withFakeFolder` picker stub |
| `frontend/tests/e2e/_fixtures.ts` | `demoFolder()` — generated, never committed |
| `docs/designs/folder-preview-tool.md` | spec + mockup |
| `docs/designs/master-roadmap.md` §2c | status + the five un-gate edits |

Design decisions worth keeping: deleting is **never** deleting (files move to `_trash` inside the picked folder); bulk confirms but single doesn't (a confirm on every delete trains people to click through — undo protects them after the mistake instead); `restoreFromTrash` refuses to overwrite and appends ` (restored)`.

---

## 9. MEMORY

All of the above is in memory under `dailydesk-*`. Most relevant here: `dailydesk-preview-grid-from-bap` · `dailydesk-e2e-test-gotchas` (new) · `dailydesk-pending-tasks` · `dailydesk-deploy-runbook` · `dailydesk-feedback-crisp-replies` · `dailydesk-freemium-gating-status` · `dailydesk-pro-pricing-and-differentiators` · `dailydesk-qa-program` · `dailydesk-naming-domains`.
