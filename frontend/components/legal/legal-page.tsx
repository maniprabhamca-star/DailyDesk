import Link from 'next/link';
import { LayoutGrid } from 'lucide-react';
import { Button } from '@/components/ui/button';

/** Shared chrome (header + footer) for static info pages: /security, /privacy, etc. */
export function LegalPage({
  eyebrow,
  title,
  intro,
  updated,
  children,
}: {
  eyebrow: string;
  title: string;
  intro: string;
  updated: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-5xl items-center gap-4 px-4 sm:px-6">
          <Link href="/" className="flex items-center gap-2.5">
            <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground"><LayoutGrid className="size-[18px]" /></span>
            <span className="text-lg font-semibold tracking-tight">DailyDesk</span>
          </Link>
          <Link href="/#tools" className="ml-auto text-sm font-medium text-foreground/80 hover:text-foreground">All tools</Link>
          <Button asChild size="sm"><Link href="/register">Get started</Link></Button>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
        <p className="text-sm font-bold uppercase tracking-wider text-primary">{eyebrow}</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">{title}</h1>
        <p className="mt-4 text-lg leading-relaxed text-muted-foreground">{intro}</p>
        <p className="mt-3 text-xs text-muted-foreground">Last updated {updated}</p>

        <div className="mt-10 space-y-12">{children}</div>

        {/* Cross-links */}
        <div className="mt-14 flex flex-wrap gap-3 border-t pt-8 text-sm">
          <Link href="/security" className="font-semibold text-primary hover:underline">Security</Link>
          <span className="text-muted-foreground">·</span>
          <Link href="/privacy" className="font-semibold text-primary hover:underline">Privacy</Link>
          <span className="text-muted-foreground">·</span>
          <Link href="/terms" className="font-semibold text-primary hover:underline">Terms</Link>
          <span className="text-muted-foreground">·</span>
          <Link href="/#tools" className="font-semibold text-primary hover:underline">All tools</Link>
        </div>
      </main>

      <footer className="border-t py-8">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 text-sm text-muted-foreground sm:px-6">
          <span className="flex items-center gap-2"><span className="flex size-6 items-center justify-center rounded-md bg-primary text-primary-foreground"><LayoutGrid className="size-3.5" /></span> DailyDesk</span>
          <span className="text-xs">© {new Date().getFullYear()} DailyDesk</span>
        </div>
      </footer>
    </div>
  );
}

/** A titled content section. */
export function Section({ id, title, children }: { id?: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-20">
      <h2 className="text-2xl font-bold tracking-tight">{title}</h2>
      <div className="mt-4 space-y-4 leading-relaxed text-muted-foreground">{children}</div>
    </section>
  );
}

/** Coloured callout box for promises, warnings, and highlights. */
export function Callout({
  tone = 'default',
  icon,
  title,
  children,
}: {
  tone?: 'default' | 'success' | 'warning' | 'danger';
  icon?: React.ReactNode;
  title?: string;
  children: React.ReactNode;
}) {
  const tones: Record<string, string> = {
    default: 'border-border bg-muted/40',
    success: 'border-emerald-500/30 bg-emerald-500/10',
    warning: 'border-amber-500/30 bg-amber-500/10',
    danger: 'border-red-500/30 bg-red-500/10',
  };
  const titleTones: Record<string, string> = {
    default: 'text-foreground',
    success: 'text-emerald-700 dark:text-emerald-400',
    warning: 'text-amber-700 dark:text-amber-400',
    danger: 'text-red-700 dark:text-red-400',
  };
  return (
    <div className={`rounded-xl border p-5 ${tones[tone]}`}>
      {title && (
        <p className={`flex items-center gap-2 font-bold ${titleTones[tone]}`}>
          {icon} {title}
        </p>
      )}
      <div className={`${title ? 'mt-2' : ''} space-y-2 text-sm leading-relaxed text-foreground/80`}>{children}</div>
    </div>
  );
}

/** A labelled step in a numbered flow. */
export function FlowStep({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <li className="flex gap-4">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">{n}</span>
      <div>
        <p className="font-semibold text-foreground">{title}</p>
        <p className="mt-0.5 text-sm leading-relaxed text-muted-foreground">{children}</p>
      </div>
    </li>
  );
}
