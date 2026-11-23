import { NextResponse } from 'next/server';
import { US_FORMS } from '@/lib/us-forms';

// Fetch a BLANK government form from the agency, live, at the moment someone
// clicks "get this form".
//
// ── Why this exists ──────────────────────────────────────────────────────────
// We will not host copies of federal forms: they are revised without notice and
// a stale file served from our domain looks current, which is worse than none.
// But that left the reader doing the work — go to irs.gov, find the PDF,
// download it, come back, open the tool, pick the file. Competitors hand it over
// in one click precisely because they host a copy. This closes the gap without
// taking on the staleness: nothing is stored, so there is nothing to go stale.
//
// ── Why this does not weaken the privacy claim ───────────────────────────────
// What passes through here is a blank public form that anyone can download, on
// its way IN. Nothing the user types ever comes back through it — the filling,
// signing and exporting all still happen in the browser. The only request this
// server makes carries no information about who asked.
//
// ── Why there is no SSRF surface ─────────────────────────────────────────────
// The caller supplies a SLUG, never a URL. The URL comes from our own data
// table, so there is nothing to inject. The host allowlist below is defence in
// depth for the case where someone adds a bad `pdfUrl` to lib/us-forms.ts, and
// tests/unit/forms-api.test.ts checks every entry against the same list.

export const dynamic = 'force-dynamic'; // never cached: "live" has to be true

const ALLOWED_HOSTS = new Set(['www.irs.gov', 'www.uscis.gov', 'www.ssa.gov', 'www.dol.gov', 'www.vba.va.gov', 'www.va.gov']);

// Generic, and deliberately says nothing about the person who clicked.
const UA = 'Mozilla/5.0 (compatible; DiemDesk form fetch; +https://diemdesk.com)';

export async function GET(_req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const form = US_FORMS.find((f) => f.slug === slug);
  if (!form) return NextResponse.json({ error: 'Unknown form.' }, { status: 404 });

  let url: URL;
  try {
    url = new URL(form.pdfUrl);
  } catch {
    return NextResponse.json({ error: 'That form has no source file configured.' }, { status: 500 });
  }
  if (url.protocol !== 'https:' || !ALLOWED_HOSTS.has(url.hostname)) {
    // Only reachable if someone edits the data file wrongly; the test catches it first.
    return NextResponse.json({ error: 'That form has no source file configured.' }, { status: 500 });
  }

  // The agency is a third party that can be slow or down. Fail with something
  // the page can turn into "here is the link, download it yourself" rather than
  // hanging the user's tab.
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 20_000);
  try {
    const upstream = await fetch(url, {
      headers: { 'user-agent': UA, accept: 'application/pdf' },
      signal: ctl.signal,
      cache: 'no-store',
      redirect: 'follow',
    });
    if (!upstream.ok) {
      return NextResponse.json(
        { error: `The ${form.authority} returned ${upstream.status} for that file.` },
        { status: 502 },
      );
    }

    const body = await upstream.arrayBuffer();
    // A login page or an error page would arrive as HTML with a 200. Check the
    // magic bytes rather than the content-type the agency claims.
    const head = new TextDecoder('latin1').decode(new Uint8Array(body.slice(0, 5)));
    if (head !== '%PDF-') {
      return NextResponse.json({ error: 'That file did not come back as a PDF.' }, { status: 502 });
    }

    return new NextResponse(body, {
      status: 200,
      headers: {
        'content-type': 'application/pdf',
        'content-disposition': `inline; filename="${form.slug}.pdf"`,
        'content-length': String(body.byteLength),
        // Not ours to cache. Every click goes to the agency, which is the only
        // way "the revision you get is the one they publish today" stays true.
        'cache-control': 'no-store',
        'x-dd-source': url.hostname,
        'x-dd-revision': form.revision,
      },
    });
  } catch (e) {
    const aborted = (e as { name?: string })?.name === 'AbortError';
    return NextResponse.json(
      { error: aborted ? `The ${form.authority} did not respond in time.` : 'Could not reach the agency.' },
      { status: 504 },
    );
  } finally {
    clearTimeout(timer);
  }
}
