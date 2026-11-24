import { NextResponse } from 'next/server';
import { US_FORMS } from '@/lib/us-forms';
import { INDIA_FORMS } from '@/lib/india-forms';
import { FORM_TASKS, formFor } from '@/lib/form-tasks';

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
    // Task pages, last so a typed form number still surfaces that form's own
    // page first. The form shorts go into `a` on purpose: typing "w9" then also
    // answers "what else goes with a W-9", which is the question behind it.
    ...FORM_TASKS.map((t) => ({
      s: t.title,
      n: t.audience,
      a: [...t.aka, ...t.forms.map((tf) => formFor(tf)?.short ?? '')].join(' '),
      g: 'Form checklists',
      h: `/forms/${t.slug}`,
    })),
  ];
  return NextResponse.json(rows, {
    headers: { 'cache-control': 'public, max-age=3600, stale-while-revalidate=86400' },
  });
}
