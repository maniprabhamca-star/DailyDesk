import Link from 'next/link';
import { Compass, ArrowRight } from 'lucide-react';
import { SiteHeader } from '@/components/app/site-header';
import { SiteFooter } from '@/components/app/site-footer';
import { Button } from '@/components/ui/button';

export const metadata = {
  title: 'Page not found | DiemDesk',
  robots: { index: false, follow: true },
};

// Branded, useful 404 — a mistyped URL, a dead link, or a delisted page lands
// here with the full header (search + nav) and a jump-off to popular tools,
// instead of the framework's bare "404" dead-end.
const POPULAR = [
  { name: 'Compress PDF', href: '/compress-pdf' },
  { name: 'Merge PDF', href: '/merge-pdf' },
  { name: 'PDF to Word', href: '/pdf-to-word' },
  { name: 'JPG to PDF', href: '/jpg-to-pdf' },
  { name: 'Split PDF', href: '/split-pdf' },
  { name: 'PDF to JPG', href: '/pdf-to-jpg' },
  { name: 'Add page numbers', href: '/add-page-numbers-to-pdf' },
  { name: 'Sign PDF', href: '/sign-pdf' },
];

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <SiteHeader />
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-center justify-center px-4 py-20 text-center">
        <span className="flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <Compass className="size-7" />
        </span>
        <p className="mt-6 text-5xl font-bold text-primary/25">404</p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">We couldn&rsquo;t find that page</h1>
        <p className="mt-3 max-w-md text-muted-foreground">
          The link may be off, or the page may have moved. Use the search up top, head back home, or jump straight to a popular tool below.
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-4">
          <Button asChild size="lg"><Link href="/">Back to home</Link></Button>
          <Link href="/#tools" className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">
            Browse all tools <ArrowRight className="size-4" />
          </Link>
        </div>
        <div className="mt-9 w-full border-t pt-8">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Popular tools</p>
          <div className="flex flex-wrap items-center justify-center gap-2">
            {POPULAR.map((t) => (
              <Link key={t.href} href={t.href} className="rounded-full border bg-card px-3.5 py-1.5 text-sm font-medium transition-colors hover:border-primary/50 hover:bg-accent/40">
                {t.name}
              </Link>
            ))}
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
