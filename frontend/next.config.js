/** @type {import('next').NextConfig} */
const nextConfig = {
  // Allow a per-instance build dir so multiple `next dev` can run concurrently
  // (used for the hero A/B/C preview servers on separate ports). Defaults to .next.
  distDir: process.env.NEXT_DIST_DIR || '.next',
  // No `images` config at all, deliberately.
  //
  // It used to say `domains: ['localhost']`, which Next 16 deprecates in favour
  // of remotePatterns. Neither is the right answer here: every one of the 30
  // <Image> uses in this app points at a local path under public/, so no remote
  // host should be optimisable at all. Converting the deprecation to
  // remotePatterns would have carried a permission we do not use into a config
  // that outlives whoever remembers why.
  //
  // This is also the advisory that was waived until 2026-11-30 — a DoS through
  // the Image Optimizer's remote fetching. Allowing no remote host closes it by
  // construction rather than by version number.
  // /for/government was renamed to /for/public-sector so the URL matches the
  // label the whole site already used. It was live for four days and is in a
  // published sitemap, so it gets a permanent redirect rather than a 404 —
  // anything that linked or indexed it still lands on the page.
  async redirects() {
    return [
      { source: '/for/government', destination: '/for/public-sector', permanent: true },
    ];
  },
  // pdfjs-dist has an optional Node "canvas" dependency that is never used in
  // the browser. Both bundlers need telling, because Next 16 builds with
  // Turbopack by default and refuses to start at all if a webpack config is
  // present without a turbopack one — it cannot know whether the webpack config
  // still matters.
  //
  // Both are kept rather than dropping webpack: `--webpack` is still a supported
  // escape hatch, and if a pdf.js upgrade ever needs it, the alias has to be
  // there or every PDF tool breaks on a build nobody thought was risky.
  turbopack: {
    resolveAlias: { canvas: './lib/empty-module.js' },
  },
  webpack: (config) => {
    config.resolve.alias = { ...config.resolve.alias, canvas: false };
    return config;
  },
  // Never cache the service worker, so a kill-switch / update reaches browsers
  // immediately instead of being pinned for hours (a stale SW broke styling once).
  async headers() {
    // Content-Security-Policy. The other security headers are set at nginx
    // (/etc/nginx/conf.d/security.conf on prod, which is NOT in this repo);
    // CSP lives here instead so it is version-controlled and reviewable — an
    // audit found it was the one significant header missing.
    //
    // It matters most for the tools that open a file you did not write. pdf.js
    // has had "a malicious PDF executes JavaScript" advisories, and the value
    // of connect-src is that even if something does run, it cannot post your
    // document anywhere: this app talks to its own origin and nothing else.
    //
    // 'unsafe-inline' for scripts is a real weakness and is here because Next
    // emits inline bootstrap scripts; removing it needs nonces via middleware,
    // which is a separate change. Everything else is tight, and the directives
    // that cost nothing — object-src, base-uri, form-action, frame-ancestors —
    // are worth having on their own.
    const csp = [
      "default-src 'self'",
      // wasm-unsafe-eval: the compression, image and PDF engines are WASM.
      // blob: — pdf.js and the workers are loaded from blob URLs.
      "script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval' blob: https://static.cloudflareinsights.com https://accounts.google.com",
      "style-src 'self' 'unsafe-inline'",
      // blob:/data: are how every result is previewed before download — the
      // files never leave the browser, so they have no URL but these.
      "img-src 'self' data: blob:",
      "font-src 'self' data:",
      "worker-src 'self' blob:",
      "child-src 'self' blob:",
      // The exfiltration boundary. Same-origin API, the analytics beacon, and
      // Google only for sign-in.
      "connect-src 'self' https://static.cloudflareinsights.com https://cloudflareinsights.com https://accounts.google.com",
      // blob: is not optional here. Every PDF preview in the app frames a
      // blob: URL built in the browser — that is what "the file never leaves
      // your device" means in practice, so there is no http URL to allow
      // instead. Omitting it blocked the previews outright, and child-src does
      // not cover the gap: frame-src overrides it for frames.
      "frame-src 'self' blob: https://accounts.google.com",
      // 'self', not 'none' — and the difference is not cosmetic.
      //
      // A blob: document INHERITS the CSP of the page that created it. So a blob
      // built here carries `frame-ancestors 'none'` of its own, and when this
      // page then frames it, WebKit refuses the load: "Refused to load blob:…
      // because it does not appear in the frame-ancestors directive". Our own
      // page is not allowed to embed our own blob. Chromium does not enforce it
      // that way, which is why this only ever showed up on Safari — where it
      // broke Print (result-actions.tsx loads the finished PDF into a hidden
      // iframe to print it) and every card preview in Folder Preview.
      //
      // 'self' still refuses every third-party embed, which is the entire point
      // of the directive; the only thing it additionally permits is this origin
      // framing itself, and an attacker who can already serve a page from this
      // origin is not being held back by a framing rule.
      "frame-ancestors 'self'",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      // upgrade-insecure-requests, EXCEPT when we are deliberately serving over
      // plain http — which is only ever the E2E run on localhost:3100.
      //
      // The spec says a potentially-trustworthy origin like localhost should not
      // be upgraded, and Chromium honours that. WebKit does not: it rewrote
      // every script, stylesheet and manifest URL to https://localhost:3100,
      // each one failed with an SSL connect error, no JavaScript ever executed,
      // and so nothing hydrated. The pages still rendered — Next had already
      // sent the server HTML — which is why this looked like forty unrelated
      // webkit failures (a splash that never lifts, a file input that never
      // appears, an account page stuck on "Loading…", the dark theme never
      // applying) instead of one cause. It was waived as engine flake for
      // months. Every one of them was this line.
      //
      // This is read at BUILD time, not at boot: next compiles headers() into
      // .next/routes-manifest.json, so `next start` never re-evaluates it. The
      // variable therefore has to be set for `npm run build`, which is what the
      // QA workflow does for the build it hands to the E2E jobs. A production
      // build sets nothing and keeps the directive.
      //
      // tests/unit/csp.test.ts asserts the default build still carries it, so
      // this switch cannot quietly become the way it gets dropped for everyone.
      ...(process.env.DD_ALLOW_PLAIN_HTTP === '1' ? [] : ['upgrade-insecure-requests']),
    ].join('; ');

    return [
      { source: '/:path*', headers: [{ key: 'Content-Security-Policy', value: csp }] },
      // Both must stay no-cache: a stale worker script, or a stale kill file, is
      // the one failure mode with no in-band recovery. Verified on prod that
      // Cloudflare returns cf-cache-status: BYPASS for these.
      { source: '/sw.js', headers: [{ key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' }] },
      { source: '/sw-kill.json', headers: [{ key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' }] },
    ];
  },
};

module.exports = nextConfig;
