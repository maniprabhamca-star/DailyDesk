// The route list every cross-cutting spec iterates.
//
// Derived from the APP ITSELF — the sitemap for public routes, the tool-flags
// map for gated ones — so a new tool is covered the moment it ships and nobody
// has to remember to add it here. That is the whole point: the last regression
// log entry (REG-111) was a hand-maintained list drifting from reality.

import sitemap from '@/app/sitemap';
import { DEFAULT_TOOL_FLAGS } from '@/lib/tool-flags';
import { catalog } from '@/components/app/catalog';

export type Route = { path: string; kind: 'public' | 'gated' };

const pathOf = (url: string) => {
  try { return new URL(url).pathname; } catch { return url; }
};

/** Every URL the sitemap advertises — these must be indexable and work. */
export function publicRoutes(): string[] {
  return (sitemap() as { url: string }[])
    .map((e) => pathOf(e.url))
    // Dynamic segments need real params; they're covered by their own specs.
    .filter((p) => !p.includes('['))
    .map((p) => (p === '' ? '/' : p));
}

/** Tools deliberately held back — must show the coming-soon panel, carry
 *  noindex, and never appear in the sitemap. */
export function gatedRoutes(): string[] {
  return Object.entries(DEFAULT_TOOL_FLAGS)
    .filter(([, status]) => status === 'coming_soon' || status === 'disabled')
    .map(([path]) => path);
}

export function allRoutes(): Route[] {
  const gated = new Set(gatedRoutes());
  return [
    ...publicRoutes().filter((p) => !gated.has(p)).map((path) => ({ path, kind: 'public' as const })),
    ...gatedRoutes().map((path) => ({ path, kind: 'gated' as const })),
  ];
}

/** Every catalog entry that points at a real page — used to prove the catalog
 *  never links somewhere that 404s. */
export function catalogRoutes(): { name: string; href: string; soon?: boolean }[] {
  return catalog
    .flatMap((g) => g.tools)
    .filter((t): t is typeof t & { href: string } => typeof t.href === 'string');
}

/** A representative page of each archetype. The full sweep runs on one browser;
 *  every browser runs this smaller set, which is what actually catches
 *  engine-level differences between Chrome, Firefox and Safari. */
export const ARCHETYPES: { path: string; arch: string }[] = [
  { path: '/', arch: 'home' },
  { path: '/tools', arch: 'directory' },
  { path: '/compress-pdf', arch: 'client-tool-pdf' },
  { path: '/compress-image', arch: 'client-tool-image' },
  { path: '/word-to-pdf', arch: 'server-tool' },
  { path: '/json-formatter', arch: 'micro-utility' },
  { path: '/qr-code-generator', arch: 'generator' },
  { path: '/why-diemdesk', arch: 'landing' },
  { path: '/pricing', arch: 'commerce' },
  { path: '/security', arch: 'legal' },
  { path: '/changelog', arch: 'content' },
];

/** Console noise that is the environment, not the app: the Express backend is
 *  not running under test, and browser extensions inject their own errors. */
export function isEnvNoise(text: string): boolean {
  return /\/api\//.test(text)
    || /Failed to load resource/i.test(text)
    || /net::ERR_/i.test(text)
    || /the server responded with a status of (4\d\d|5\d\d)/i.test(text)
    || /fetching the script|ServiceWorker|service worker/i.test(text)
    || /chrome-extension:|moz-extension:|webkit-masked-url:/i.test(text)
    // Firefox/WebKit shout about cookies and CSS the app doesn't control.
    || /Partitioned cookie|Cookie “|Unrecognized feature|was preloaded using link preload/i.test(text);
}
