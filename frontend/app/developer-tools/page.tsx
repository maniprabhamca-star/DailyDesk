import type { Metadata } from 'next';
import Link from 'next/link';
import { ShieldCheck } from 'lucide-react';
import { SiteHeader } from '@/components/app/site-header';
import { SiteFooter } from '@/components/app/site-footer';
import { DEV_TOOLS, DEV_GROUPS, GROUP_COLOR } from '@/lib/dev-tools';

export const metadata: Metadata = {
  title: 'Developer & CSV Tools — Free, In Your Browser | DiemDesk',
  description: 'Free developer utilities — Base64, hash, JWT, UUID, CSV↔JSON, text diff and more. Each runs in your browser; nothing is uploaded.',
  alternates: { canonical: '/developer-tools' },
  openGraph: { images: ['/og.png'], title: 'Developer & CSV tools — free, in your browser', description: 'Base64, hash, JWT, UUID, CSV↔JSON, text diff and more — all on-device.', type: 'website' },
};

const built = DEV_TOOLS.filter((t) => t.built).length;

export default function DeveloperToolsPage() {
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <SiteHeader />
      <main className="mx-auto w-full max-w-[1100px] flex-1 px-4 py-12 sm:px-6">
        <div className="max-w-2xl">
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Developer &amp; CSV tools</h1>
          <p className="mt-3 text-muted-foreground">Small, single-purpose utilities for everyday dev &amp; data work — encode, hash, decode, convert and compare. Every one runs <span className="font-medium text-foreground">100% in your browser</span>, so your data is never uploaded.</p>
          <p className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-emerald-600/25 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-700 dark:text-emerald-400"><ShieldCheck className="size-3.5" /> {built} tools live · on your device · free</p>
        </div>

        <div className="mt-10 space-y-9">
          {DEV_GROUPS.map((g) => {
            const tools = DEV_TOOLS.filter((t) => t.group === g);
            const color = GROUP_COLOR[g];
            return (
              <section key={g}>
                <h2 className="mb-3 flex items-center gap-2 text-sm font-bold tracking-tight">
                  <span className="size-2.5 rounded-[3px]" style={{ background: color }} /> {g}
                </h2>
                <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
                  {tools.map((t) => {
                    const inner = (
                      <>
                        <span className="grid size-9 shrink-0 place-items-center rounded-lg font-mono text-[13px] font-bold" style={{ background: `${color}1A`, color }}>{t.glyph}</span>
                        <span className="min-w-0">
                          <span className="flex items-center gap-2 text-sm font-semibold">{t.name}{!t.built && <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">soon</span>}</span>
                          <span className="mt-0.5 block truncate text-xs text-muted-foreground">{t.tagline}</span>
                        </span>
                      </>
                    );
                    return t.built ? (
                      <Link key={t.slug} href={`/${t.slug}`} className="flex items-start gap-3 rounded-xl border bg-card p-3 shadow-soft transition hover:-translate-y-0.5 hover:border-primary/40">{inner}</Link>
                    ) : (
                      <div key={t.slug} className="flex items-start gap-3 rounded-xl border border-dashed bg-card/50 p-3 opacity-70">{inner}</div>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
