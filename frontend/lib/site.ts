// Single source of truth for the site's public URL — used by metadataBase,
// sitemap.xml, robots.txt, and JSON-LD. Until the real domain goes live it
// falls back to the planned production domain; override with
// NEXT_PUBLIC_SITE_URL in the deployment env when the domain is finalized.
export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://dailydesk.app';

export const SITE_NAME = 'DailyDesk';
