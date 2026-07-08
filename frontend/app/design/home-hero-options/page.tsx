import { SiteHeader } from '@/components/app/site-header';
import { SiteFooter } from '@/components/app/site-footer';
import { HeroVisualOptions } from '@/components/home/hero-variants';

export default function HomeHeroOptionsPage() {
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <SiteHeader />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-10 sm:px-6">
        <div className="max-w-2xl">
          <p className="text-sm font-semibold text-primary">Homepage visual options</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">Premium, privacy-safe hero directions</h1>
          <p className="mt-3 text-muted-foreground">
            These avoid real PDF screenshots and use synthetic command-center UI, so no sensitive URLs or document details are exposed.
          </p>
        </div>
        <div className="mt-8">
          <HeroVisualOptions />
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
