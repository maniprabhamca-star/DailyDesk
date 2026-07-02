import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/site';

// Allow everything — thin pages (/login, /register) are handled with a
// noindex meta tag instead of a robots block, so crawlers can still SEE the
// noindex directive (blocking them in robots.txt would hide it).
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: '*', allow: '/' },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
