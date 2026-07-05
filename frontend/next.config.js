/** @type {import('next').NextConfig} */
const nextConfig = {
  // Allow a per-instance build dir so multiple `next dev` can run concurrently
  // (used for the hero A/B/C preview servers on separate ports). Defaults to .next.
  distDir: process.env.NEXT_DIST_DIR || '.next',
  images: {
    domains: ['localhost'],
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
      { source: '/sw.js', headers: [{ key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' }] },
    ];
  },
};

module.exports = nextConfig;
