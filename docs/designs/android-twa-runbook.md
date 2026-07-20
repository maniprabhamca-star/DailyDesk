# Android via TWA — runbook

**Status:** not started. Prerequisites tracked below.
**Decision (2026-07-20):** ship Android as a **Trusted Web Activity**, not a Capacitor native app.

## Why TWA and not native

A TWA is a Play Store listing that renders diemdesk.com **in the user's own Chrome**, not a WebView.
Blob downloads, `navigator.share({files})`, `share_target`, `file_handlers` and WASM SIMD all work
unchanged, and assets stream from the CDN rather than shipping in the bundle.

Native (Capacitor) was rejected: 57 tools × 2 platforms is ~114 QA passes against the project's own
testing bar, and it imposes a **permanent 3× QA tax on every future tool** — that, not App Store
review risk, is the argument. iOS has no TWA equivalent (Apple does not permit it), so iOS stays
parked until paying customers ask for it.

India is the primary market and is ~95% Android, so a TWA captures nearly all the realistic upside.

## Prerequisites

| # | Requirement | Status |
|---|---|---|
| 1 | Installable manifest (name, short_name, start_url, standalone, 192+512+maskable icons, theme + background colour) | ✅ verified 2026-07-20 |
| 2 | HTTPS on the origin | ✅ live |
| 3 | Service worker with a working `fetch` handler | ✅ built 2026-07-20 (`public/sw.template.js`) — **but soak it for a week before wrapping** |
| 4 | `/.well-known/assetlinks.json` carrying the app's SHA-256 signing fingerprint | ❌ blocked — see the ordering gotcha |
| 5 | Play developer account | ⚠️ check account type — see below |
| 6 | Store assets: icon, feature graphic, screenshots, content rating, Data safety form, privacy policy | ⚠️ privacy policy exists (`/privacy`); the rest not started |

## ⚠️ The ordering gotcha — read before starting

`assetlinks.json` must contain the SHA-256 fingerprint of the key that signs the app. With **Play App
Signing** (the default, and recommended), **Google generates the final signing key and only reveals
its fingerprint after the first upload.**

So the order is:

1. Build and upload the AAB
2. Read the fingerprint from **Play Console → Setup → App integrity → App signing key certificate**
3. *Then* write `assetlinks.json` and deploy it
4. Re-open the app to confirm the URL bar is gone

**Do not deploy a placeholder `assetlinks.json`.** A malformed or wrong-fingerprint file fails
verification and the app shows a browser URL bar — visibly worse than not shipping. There is no
useful "prepare it early" step here.

## Play account type — check before planning a date

**play.google.com/console → Settings → Developer account → Account details → `Account type`**

| | Personal | Organization |
|---|---|---|
| Closed test before production | **12 testers opted in, 14 consecutive days** | not required |
| D-U-N-S number | not needed | required |

The owner **already holds a D-U-N-S: `13-161-1478`** (JPNM Rapid Universe LLC), so the Organization
path is open with no ~30-day wait.

Two caveats:
- That D-U-N-S belongs to **JPNM Rapid Universe LLC** (website `nimblewags.com`). If DiemDesk trades
  under a different entity, that entity needs its own.
- **Whatever entity registers becomes the public developer name on the listing.** "JPNM Rapid
  Universe LLC" would appear under the app unless a separate store display name is set.

## Build steps (once prerequisites clear)

```bash
npm i -g @bubblewrap/cli
bubblewrap init --manifest https://diemdesk.com/manifest.webmanifest
bubblewrap build          # produces app-release-bundle.aab
```

Bubblewrap will ask for a signing key. Use Play App Signing and keep the upload key safe — losing it
means you cannot ship updates.

Then: upload the AAB → read the fingerprint → write `frontend/public/.well-known/assetlinks.json`:

```json
[{
  "relation": ["delegate_permission/common.handle_all_urls"],
  "target": {
    "namespace": "android_app",
    "package_name": "com.diemdesk.twa",
    "sha256_cert_fingerprints": ["<FROM PLAY CONSOLE — App integrity>"]
  }
}]
```

Deploy, then verify with Google's Digital Asset Links API before announcing anything.

## Sequencing — do not skip this

**The TWA is not the next thing to build.** Order:

1. **Flip `WAITLIST_MODE`** and set the $5.98/$60 prices → find out whether anyone pays. Six Pro
   users covers all fixed infra. Everything below is a bet placed before that answer is known.
2. **Soak the service worker for a week** on the live site. A TWA over a broken worker is a Play
   Store app that goes blank offline, which is worse than no app.
3. **Then** the TWA, ~1 week.

Wrapping the site before the worker has proven itself in production means shipping the July 2026
stale-shell class of bug into an app store, where the recovery path is a review queue instead of a
deploy.
