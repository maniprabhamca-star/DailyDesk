/** @type {import('next').NextConfig} */
const nextConfig = {
  // Allow a per-instance build dir so multiple `next dev` can run concurrently
  // (used for the hero A/B/C preview servers on separate ports). Defaults to .next.
  distDir: process.env.NEXT_DIST_DIR || '.next',
  images: {
    domains: ['localhost'],
  },
  // /for/government was renamed to /for/public-sector so the URL matches the
  // label the whole site already used. It was live for four days and is in a
  // published sitemap, so it gets a permanent redirect rather than a 404 —
  // anything that linked or indexed it still lands on the page.
  async redirects() {
    return [
      { source: '/for/government', destination: '/for/public-sector', permanent: true },
    ];
  },
  webpack: (config) => {
    // pdfjs-dist has an optional Node "canvas" dependency that isn't used in the browser.
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
      "frame-src 'self' https://accounts.google.com",
      // Nothing may embed us — stronger than X-Frame-Options and it supersedes it.
      "frame-ancestors 'none'",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "upgrade-insecure-requests",
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
