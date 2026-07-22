// Public Link-in-Bio page — a server component so social shares get real OG
// tags. Fetches the sanitized config from the backend at request time; a missing
// or hidden page 404s. No app chrome (header/footer) — this is a standalone page.
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { BioPageView } from '@/components/bio/bio-page-view';
import { EMPTY_BIO, type BioConfig } from '@/lib/bio-themes';

export const dynamic = 'force-dynamic'; // always fresh; never cached stale

// Server-side the backend is reachable on localhost; fall back to the public API.
const INTERNAL = process.env.INTERNAL_API_URL || 'http://127.0.0.1:4000';

async function fetchBio(slug: string): Promise<{ slug: string; config: BioConfig } | null> {
  try {
    const res = await fetch(`${INTERNAL}/api/bio/public/${encodeURIComponent(slug)}`, { cache: 'no-store' });
    if (!res.ok) return null;
    const data = await res.json();
    return { slug: data.slug, config: { ...EMPTY_BIO, ...(data.config || {}) } };
  } catch { return null; }
}

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const page = await fetchBio(params.slug);
  if (!page) return { title: 'Page not found | DiemDesk', robots: { index: false } };
  const name = page.config.displayName || page.slug;
  const desc = page.config.bio || `${name}'s links`;
  return {
    title: `${name} — Links`,
    description: desc,
    alternates: { canonical: `/u/${page.slug}` },
    openGraph: { title: name, description: desc, type: 'profile', images: page.config.avatar ? [page.config.avatar] : ['/og.png'] },
    twitter: { card: 'summary', title: name, description: desc },
  };
}

export default async function PublicBioPage({ params }: { params: { slug: string } }) {
  const page = await fetchBio(params.slug);
  if (!page) notFound();
  return (
    <main className="min-h-screen">
      <BioPageView config={page.config} live />
    </main>
  );
}
