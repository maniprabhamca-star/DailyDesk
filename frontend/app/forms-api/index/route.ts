import { NextResponse } from 'next/server';
import { US_FORMS } from '@/lib/us-forms';
import { INDIA_FORMS } from '@/lib/india-forms';

// A slim search index of every form page, for the ⌘K palette.
//
// Why an endpoint rather than an import: the palette is mounted by the root
// layout, so anything it imports lands in the chunk that every page loads.
// US_FORMS and INDIA_FORMS carry several paragraphs of prose per form — the
// whole point of those pages — which is tens of kilobytes nobody needs until
// they actually type a form number. The palette fetches this once, on the first
// search of a session, and caches it in memory.
//
// Derived from the same data the pages render, so it cannot drift.
//
// Not under /api/: in production nginx proxies that whole prefix to the Express
// backend on :4000, so a Next route handler there 404s on the server and
// nowhere else.

export const dynamic = 'force-static';

export type FormIndexEntry = { s: string; n: string; a: string; g: string; h: string };

export async function GET() {
  const rows: FormIndexEntry[] = [
    ...US_FORMS.map((f) => ({ s: f.short, n: f.name, a: f.aka ?? '', g: 'US federal forms', h: `/us-forms/${f.slug}` })),
    ...INDIA_FORMS.map((f) => ({ s: f.short, n: f.name, a: f.aka ?? '', g: 'Indian forms', h: `/india-forms/${f.slug}` })),
  ];
  return NextResponse.json(rows, {
    headers: { 'cache-control': 'public, max-age=3600, stale-while-revalidate=86400' },
  });
}
