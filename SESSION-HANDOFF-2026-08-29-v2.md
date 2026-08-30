# Session handover — DiemDesk, 2026-08-29 (second session of the day)

Paste this whole file into a fresh session.

**State:** `main` = `2cc99bf`, pushed. 167 unit tests green. 176 pages live.
Working tree clean apart from untracked `SESSION-HANDOFF-*.md` and `dev-harness/`
scratch files, plus a modified `.claude/launch.json` (local dev config, not for
commit).

---

## 1. SHIPPED — pdf.net item 1b: photos from a phone now work in the PDF-embed tools

**Commit `2cc99bf`**, pushed. Closes the last piece of the HEIC work started in
`08761a3`.

**What was broken.** Photographing your signature on paper and uploading it is
the obvious way to sign a PDF, and from an iPhone it did not work — the picker
greyed the photo out with nothing on screen explaining why. Five tools plus one
more nobody had listed: `sign`, `watermark`, `annotate`, `edit`,
`signature-maker`, and `components/tools/signature-pad.tsx` (Saved Workflows).

**Why item 1's fix did not cover them.** The other image tools only need pixels,
so `decodeToBitmap()` was enough. These hand the image to **pdf-lib**
(`embedPng`/`embedJpg`) or composite it onto a page canvas — both only speak
JPEG and PNG. A bitmap does not help; they need **bytes in one of two formats**.

**The fix — `pickedImageForPdf(file)` in `frontend/lib/image-for-pdf.ts`**,
returning `{ bytes, isPng, aspect }`. Normalises once at pick time so the
preview `<img>`, the canvas draw, the pdf-lib embed and the saved session all
get something guaranteed to work. Routed by magic bytes, never by filename:

| Sniffed | Path | Why |
|---|---|---|
| JPEG / PNG | passed through byte-for-byte | no re-encode, no quality loss |
| HEIC / TIFF / BMP | `rasterize()` → JPEG | photos; reuses the shipped libheif path + phone canvas cap |
| WebP / GIF / AVIF / unknown | decode → PNG | may carry transparency |

⚠ **The PNG branch deliberately skips the white fill `rasterize()` does.**
Flattening a transparent signature onto a white box defeats the reason people
export one as a PNG. If anyone ever unifies these two paths, keep the alpha
branch.

**Other details worth not rediscovering:**
- Annotate/Edit keep placed images as **data URLs** (`pdfImageDataUrl`), not
  object URLs — they must survive in a saved editor session, where a blob URL
  dies with the tab. **Edit's core logic was not touched**, only its loader.
- The workflows signature pad uses `decodeToBitmap` (it stores a canvas PNG in
  `localStorage`, not pdf-lib bytes) and is **capped at 1600px** — a 12MP photo
  as a PNG data URL blows the ~5MB quota.
- `KNOWN_NARROW` in `tests/unit/file-accepts.test.ts` is now **empty**, and a new
  assertion requires all five to route through `pickedImageForPdf`, so the hole
  cannot reopen. 7 assertions in that file, 167 tests overall.

**Browser-verified, not just unit-tested.** A PNG named `signature.heic` with
`type: image/heic` was accepted where the old name check refused it; a
transparent WebP came back a PNG with its corner pixel still at alpha 0 and
200×80 intact; Sign exported a valid PDF whose image object is `FlateDecode`
(PNG path, transparency survived into the document); Watermark stamped a
mislabelled logo.

**Reusable test recipe:** to drive a React file input from `javascript_tool`,
set `input.files` **and bust the value tracker** — `inp._valueTracker.setValue('')`
— or the synthetic `onChange` never fires and the file silently does nothing.
Capture output by monkey-patching `URL.createObjectURL` to collect
`application/pdf` blobs, then check bytes for `%PDF-` + `/Subtype /Image` +
`/FlateDecode` (PNG) vs `/DCTDecode` (JPEG). Also: `next dev` needs ~20s before
the first route answers; navigating early lands on `chrome-error://` and every
later `fetch` fails confusingly.

---

## 2. ⭐ RESOLVED — the AI-crawler block, and a correction I owe the record

**The owner turned Cloudflare's Managed robots.txt OFF.** Verified live:
`https://diemdesk.com/robots.txt` is now **86 bytes** — our own `app/robots.ts`
and nothing else. `/llms.txt` 200 (38 KB) and `/sign-pdf.md` 200
`text/markdown`, so the 176 twins are genuinely reachable now.

**⚠ Two things I stated as fact that were wrong. Both matter as patterns.**

1. **"The twins are invisible to AI crawlers."** False. The block only ever hit
   *training* crawlers. Every **search** bot was allowed the whole time —
   **Claude-SearchBot had made 410 requests in 24 hours.** I had recorded a
   nuanced split as a blanket block without fetching the file.
2. **"Turn off the Bots toggle / edit the signals."** Wrong control, twice.

**There are THREE independent Cloudflare layers and only one writes robots.txt:**

| Layer | Where | Effect |
|---|---|---|
| Block AI bots **Scope** | AI Crawl Control → Security → Settings | managed WAF rule; was "block only on pages with ads" — inert, we run no ads |
| Per-crawler **Block Crawler** toggles | AI Crawl Control → Security table | WAF 403 per bot |
| **Managed robots.txt** | AI Crawl Control → **Signals**, top card | ⬅ the ONLY one that writes robots.txt |

The owner turned off *every* per-crawler toggle and set Scope to "Do not block".
**The served file did not change at all.** Only the Signals toggle did it.

**The standing decision, recorded in memory as `dailydesk-robots-txt-ownership`:
robots.txt belongs to `frontend/app/robots.ts`. Never re-enable Cloudflare's
Managed robots.txt.** It does not replace our file, it **prepends** to it — so
two contradictory policies were served in one response for weeks, invisible to
the repo. Cloudflare's violations log showed CCBot being refused `/pdf-to-word`,
`/rotate-pdf` and `/`, and ClaudeBot refused `/feedback`.

**Rule: never state what robots.txt says from a dashboard label — fetch it.**
Use PowerShell/curl, **not WebFetch** (15-minute cache serves the pre-change
file).

**Deliberately NOT done:** declaring `Content-Signal: search=yes, ai-input=yes,
ai-train=yes`. It would need an `app/robots.txt/route.ts` handler because Next's
`MetadataRoute.Robots` cannot emit a custom line. Judged not worth a deploy — an
absent signal means "neither grants nor restricts", crawlers act on
allow/disallow, and the spec is barely a year old. Going from `ai-train=no` +
nine hard blocks to silence was ~95% of the win.

---

## 3. HANDED OFF — admin portal bind (separate repo, separate session)

Written up in full as **`SESSION-HANDOFF-admin-bind-fix.md`** (repo root) for a
session working in `DailyDesk-Admin-Portal`. One line:
`"start": "next start -H 127.0.0.1 -p 3100"`.

**⚠ Downgraded from how memory described it.** Measured from the public internet
2026-08-29: ports **3100, 4000 and 3000 are all closed/filtered** (ufw), `:80`
and `:443` refuse direct hits (origin takes Cloudflare only), `:22` open — which
is how the IP `2.25.71.126` was confirmed correct. And `admin.diemdesk.com`
**302s to Cloudflare Access SSO**. **Two layers already protect it. This is
defence-in-depth, not an open port.**

Worth doing anyway: ufw is the only thing between a `0.0.0.0`-bound Next and the
internet; loopback makes the exposure structurally impossible.

⚠ **Check `proxy_pass` in `/etc/nginx/sites-available/dailydesk-admin-ssl`
first** — if it targets anything but `127.0.0.1:3100`, the bind change takes the
portal offline.

---

## 4. 🔒 WHAT IS ACTUALLY BLOCKING — all owner-side, all money

The crawler item is closed, so the list is shorter and sharper than it was:

1. **Stripe Terms of Service URL** → Settings → Business → Public details →
   `https://diemdesk.com/terms`. Blocks pdf.net item 2 (`consent_collection`) —
   Stripe rejects the parameter without it.
2. **Click-test the 15 gated converters**, then tell me to un-gate.
3. **Tally test** for `/bank-statement-converter`, then un-gate *with the quota
   on* (`STATEMENT_QUOTA_ENABLED=true`, `STATEMENT_FREE_PAGES=5`).
4. **The revenue flip** — create the Stripe $5.98/$60 prices, update
   `STRIPE_PRICE_ID` / `STRIPE_PRICE_ID_YEARLY`, set `WAITLIST_MODE = false`.
5. **Admin repo** — commit the bind fix (§3).
6. ⏰ **Delete-account flow** — the owner asked to be reminded. Never tested on a
   real account. Use a throwaway.

---

## 5. 🚨 THE OPEN DECISION — asked three times, still unanswered

**34 of ~114 tools are gated `coming_soon` and `WAITLIST_MODE = true`, so the
site cannot take a single payment.**

The pdf.net queue's next items (4-8) are content pages — 29 bank guides, 6
competitor pages, 8 sector pages, two forms libraries — that funnel traffic into
a **gated flagship on a site with no working checkout**.

**Proposed re-order, owner has not decided:**
1. Un-gate the 15 click-tested converters + `/folder-preview` (verified, 5 edits)
2. Revenue flip (Stripe prices + `WAITLIST_MODE = false`)
3. Un-gate `/bank-statement-converter` (blocked on the Tally test)
4. **THEN** item 3 (passport) — it fixes 46 LIVE pages Google is deduping today
5. Then the rest of the queue

**Next unblocked code item if no answer: item 3, passport differentiation.** It
adds zero pages and still outranks items that add 29, because
`lib/passport-specs.ts` generates identical sentences for the 35×45 countries
and Search Console confirms the dedup. 21 of 46 specs are unverified and 5 still
come from `schengen()`, which encodes the **visa** standard and has been wrong 6
times out of 10. **Adding countries to that template multiplies the defect.**

⚠ **Do not start items 4-8 without asking.**

---

## 6. Standing rules touched this session

- **Crisp output only** — summary + action items. No essays, no running
  commentary. Re-asserted by the owner at the start of this session (6th time).
- **Changelog with every ship** — done for 1b (`frontend/lib/changelog.ts`).
- **Tracker with every item** — `docs/designs/pdfnet-response-tracker.md`
  updated; 1b marked shipped with the full write-up.
- **Never overwrite a hand-maintained doc** — `SESSION-HANDOFF-admin-features.md`
  (191 lines, the 3 admin features) was left untouched; the bind fix went into a
  new file that references it.

---

## 7. Memory written this session

| File | Change |
|---|---|
| `dailydesk-robots-txt-ownership` | **NEW** — the standing decision, the 3 Cloudflare layers, "fetch the file, never trust the toggle" |
| `dailydesk-image-format-sniffing` | item 1b: `pickedImageForPdf`, the alpha-branch warning, the React-file-input test recipe |
| `dailydesk-llms-txt-and-md-twins` | corrected the "invisible" claim; resolved |
| `dailydesk-pdfnet-response-roadmap` | 1b shipped; crawler action closed |
| `dailydesk-pending-tasks` | owner list rewritten; stale robots.txt decision superseded |
| `dailydesk-admin-portal-features` | measured security posture + the nginx `proxy_pass` gotcha |
| `MEMORY.md` | indexed the new file |
