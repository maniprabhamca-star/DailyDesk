/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    domains: ['localhost'],
  },
  webpack: (config) => {
    // pdfjs-dist has an optional Node "canvas" dependency that isn't used in the browser.
    config.resolve.alias = { ...config.resolve.alias, canvas: false };
    return config;
  },
};

module.exports = nextConfig;
