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
    return [
      // Both must stay no-cache: a stale worker script, or a stale kill file, is
      // the one failure mode with no in-band recovery. Verified on prod that
      // Cloudflare returns cf-cache-status: BYPASS for these.
      { source: '/sw.js', headers: [{ key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' }] },
      { source: '/sw-kill.json', headers: [{ key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' }] },
    ];
  },
};

module.exports = nextConfig;
