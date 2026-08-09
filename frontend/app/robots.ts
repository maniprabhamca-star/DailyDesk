import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/site';

// Allow everything — thin pages (/login, /register) are handled with a
// noindex meta tag instead of a robots block, so crawlers can still SEE the
// noindex directive (blocking them in robots.txt would hide it).
//
// The one exception is /cdn-cgi/, which is not ours. Cloudflare's email
// obfuscation rewrites every mailto: on /about, /privacy, /terms and /security
// into a /cdn-cgi/l/email-protection link so scrapers cannot harvest the
// address. That decode endpoint is meant for the browser, not for crawlers —
// Googlebot follows it and gets a 404, which is what showed up under
// "Not found (404)" in Search Console. Excluding the path keeps the spam
// protection and stops the crawl. Turning the obfuscation OFF would also clear
// the report, at the cost of publishing our support address in plain text.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: '*', allow: '/', disallow: '/cdn-cgi/' },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
