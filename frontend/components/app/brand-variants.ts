// Candidate brand-mark designs for side-by-side review on the temporary preview
// servers. Selected per-server via NEXT_PUBLIC_BRAND_VARIANT (see scripts/
// preview-brand.mjs). When the env var is unset (production, normal dev) the
// live mark in brand-mark.tsx is used and NONE of this applies.
//
// Each entry is the inner SVG markup for a 0 0 48 48 viewBox — shared verbatim
// by the header <BrandMark> and the browser-tab favicon (faviconDataUri), so a
// server's logo and favicon always match. License-clean, original geometry.

export type BrandVariant = 'A' | 'B' | 'C' | 'D' | 'E' | 'L1' | 'LA' | 'LC' | 'LD';

// Shared lifted "D" tile (white tile, indigo D) reused by the L* variants below.
const D_TILE = '<g transform="rotate(9 32 15)"><rect x="24" y="7" width="16" height="16" rx="4.5" fill="#fff"/><path fill-rule="evenodd" fill="#4F46E5" d="M28 9.5 H32.5 C35.7 9.5 37.8 12 37.8 15 C37.8 18 35.7 20.5 32.5 20.5 H28 Z M30.4 11.8 V18.2 H32.5 C34.3 18.2 35.4 16.9 35.4 15 C35.4 13.1 34.3 11.8 32.5 11.8 Z"/></g>';
const BASE = '<rect width="48" height="48" rx="13.5" fill="#4F46E5"/>';

export const BRAND_INNER: Record<BrandVariant, string> = {
  // L1 — lifted D, plain white document tiles (user's kept pick).
  L1: `${BASE}<rect x="10" y="10" width="12" height="12" rx="3.5" fill="#fff"/><rect x="10" y="26" width="12" height="12" rx="3.5" fill="#fff"/><rect x="26" y="26" width="12" height="12" rx="3.5" fill="#fff"/>${D_TILE}`,
  // LA — lifted D, amber/green/coral document tiles (office-suite feel, distinct colors). RECOMMENDED.
  LA: `${BASE}<rect x="10" y="10" width="12" height="12" rx="3.5" fill="#FBBF24"/><rect x="10" y="26" width="12" height="12" rx="3.5" fill="#22C55E"/><rect x="26" y="26" width="12" height="12" rx="3.5" fill="#F87171"/>${D_TILE}`,
  // LC — lifted D, office palette blue/green/amber tiles.
  LC: `${BASE}<rect x="10" y="10" width="12" height="12" rx="3.5" fill="#60A5FA"/><rect x="10" y="26" width="12" height="12" rx="3.5" fill="#34D399"/><rect x="26" y="26" width="12" height="12" rx="3.5" fill="#FBBF24"/>${D_TILE}`,
  // LD — lifted D with white "text line" hints, MUTED/desaturated palette (premium document feel).
  LD: `${BASE}<rect x="10" y="10" width="12" height="12" rx="3.5" fill="#E0BE6A"/><rect x="12.5" y="14" width="7" height="1.4" rx="0.7" fill="#fff" opacity="0.8"/><rect x="12.5" y="17" width="5" height="1.4" rx="0.7" fill="#fff" opacity="0.8"/><rect x="10" y="26" width="12" height="12" rx="3.5" fill="#74AE8C"/><rect x="12.5" y="30" width="7" height="1.4" rx="0.7" fill="#fff" opacity="0.8"/><rect x="12.5" y="33" width="5" height="1.4" rx="0.7" fill="#fff" opacity="0.8"/><rect x="26" y="26" width="12" height="12" rx="3.5" fill="#CE8686"/><rect x="28.5" y="30" width="7" height="1.4" rx="0.7" fill="#fff" opacity="0.8"/><rect x="28.5" y="33" width="5" height="1.4" rx="0.7" fill="#fff" opacity="0.8"/>${D_TILE}`,
  // A — refined lifted tile: the current concept, but full-opacity tiles and a
  // gold lifted tile so it reads crisp instead of washed-out.
  A: '<rect width="48" height="48" rx="13.5" fill="#4F46E5"/><rect x="9" y="9" width="13" height="13" rx="3.5" fill="#fff"/><rect x="9" y="26" width="13" height="13" rx="3.5" fill="#fff"/><rect x="26" y="26" width="13" height="13" rx="3.5" fill="#fff"/><rect x="25" y="7" width="15" height="15" rx="4" fill="#FBBF24" transform="rotate(10 32 14)"/>',
  // B — monogram D: cleanest, scales best to 16px.
  B: '<rect width="48" height="48" rx="13.5" fill="#4F46E5"/><path fill="#fff" fill-rule="evenodd" d="M15 11 H25 C33.3 11 39 16.8 39 24 C39 31.2 33.3 37 25 37 H15 Z M21 17.5 V30.5 H25 C29.4 30.5 32.5 27.6 32.5 24 C32.5 20.4 29.4 17.5 25 17.5 Z"/>',
  // C — daybreak: rising sun over a horizon; nods to "Diem" (day).
  C: '<rect width="48" height="48" rx="13.5" fill="#4F46E5"/><path d="M13 31 A11 11 0 0 1 35 31 Z" fill="#FBBF24"/><rect x="10" y="32.5" width="28" height="3" rx="1.5" fill="#fff"/><rect x="14" y="38" width="20" height="3" rx="1.5" fill="#fff" opacity="0.55"/>',
  // D — spark: four-point star; energy / AI.
  D: '<rect width="48" height="48" rx="13.5" fill="#4F46E5"/><path d="M24 7 C25.4 18.2 29.8 22.6 41 24 C29.8 25.4 25.4 29.8 24 41 C22.6 29.8 18.2 25.4 7 24 C18.2 22.6 22.6 18.2 24 7 Z" fill="#fff"/>',
  // E — page + fold: a document with a folded corner; nods to "Desk" / docs.
  E: '<rect width="48" height="48" rx="13.5" fill="#4F46E5"/><path d="M13 12 h16 l6 6 v18 a2 2 0 0 1 -2 2 h-20 a2 2 0 0 1 -2 -2 v-22 a2 2 0 0 1 2 -2 Z" fill="#fff"/><path d="M29 12 v6 h6 Z" fill="#C7D2FE"/><rect x="17" y="25" width="14" height="2.4" rx="1.2" fill="#4F46E5" opacity="0.4"/><rect x="17" y="30" width="10" height="2.4" rx="1.2" fill="#4F46E5" opacity="0.4"/>',
};

export function isBrandVariant(v: string | undefined): v is BrandVariant {
  return !!v && Object.prototype.hasOwnProperty.call(BRAND_INNER, v);
}

// Inline SVG favicon for a variant, so each preview server's tab icon matches
// its header logo without generating static .ico files.
export function faviconDataUri(v: BrandVariant): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48">${BRAND_INNER[v]}</svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}
