import Script from 'next/script';

// Cloudflare Web Analytics — privacy-first, COOKIELESS, no consent banner needed,
// no data to Google. Renders the beacon ONLY when a token is provided via
// NEXT_PUBLIC_CF_ANALYTICS_TOKEN (set it in the VPS frontend env, then rebuild).
// The token is not secret (it ships in the page). Until set, this renders nothing.
const TOKEN = process.env.NEXT_PUBLIC_CF_ANALYTICS_TOKEN;

export function CloudflareAnalytics() {
  if (!TOKEN) return null;
  return (
    <Script
      id="cf-web-analytics"
      src="https://static.cloudflareinsights.com/beacon.min.js"
      strategy="afterInteractive"
      data-cf-beacon={JSON.stringify({ token: TOKEN })}
    />
  );
}
