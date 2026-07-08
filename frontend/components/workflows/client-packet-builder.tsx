'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { CheckCircle2, Circle, FilePlus2, ListChecks, ShieldCheck, Sparkles, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

const STEPS = [
  { title: 'Collect source files', body: 'Gather proposal, agreement, invoice, IDs, and reference PDFs.', href: '/merge-pdf', cta: 'Merge files' },
  { title: 'Remove extras', body: 'Use Delete Pages with blank-page detection before final merge.', href: '/delete-pages-from-pdf', cta: 'Clean pages' },
  { title: 'Add signatures or initials', body: 'Place signatures, initials, or required acknowledgements.', href: '/sign-pdf', cta: 'Sign PDF' },
  { title: 'Run Share-Safe check', body: 'Check metadata, visible risky text, links, and annotations.', href: '/share-safe-pdf-check', cta: 'Check risk' },
  { title: 'Compress for delivery', body: 'Shrink the packet while keeping pages readable.', href: '/compress-pdf', cta: 'Compress' },
];

export function ClientPacketBuilder() {
  const [done, setDone] = useState<boolean[]>(() => STEPS.map(() => false));
  const completed = done.filter(Boolean).length;
  const pct = useMemo(() => Math.round((completed / STEPS.length) * 100), [completed]);

  return (
    <Card>
      <CardContent className="p-5">
        <div className="rounded-2xl border bg-gradient-to-br from-primary/10 to-background p-4">
          <div className="flex flex-wrap items-center gap-3">
            <span className="flex size-11 items-center justify-center rounded-2xl bg-primary text-primary-foreground"><FilePlus2 className="size-5" /></span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">Client Packet workflow</p>
              <p className="text-xs text-muted-foreground">A reusable checklist for sending polished document bundles.</p>
            </div>
            <span className="rounded-full bg-background px-3 py-1 text-xs font-semibold text-primary shadow-soft">{pct}% ready</span>
          </div>
          <div className="mt-4 h-2 rounded-full bg-background">
            <div className="h-2 rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} />
          </div>
        </div>

        <div className="mt-4 grid gap-3">
          {STEPS.map((s, i) => (
            <div key={s.title} className="flex flex-wrap items-start gap-3 rounded-xl border bg-card p-3">
              <button
                type="button"
                onClick={() => setDone((cur) => cur.map((v, idx) => (idx === i ? !v : v)))}
                className="mt-0.5 text-primary"
                aria-label={done[i] ? `Mark ${s.title} incomplete` : `Mark ${s.title} complete`}
              >
                {done[i] ? <CheckCircle2 className="size-5" /> : <Circle className="size-5" />}
              </button>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">{s.title}</p>
                <p className="text-xs leading-5 text-muted-foreground">{s.body}</p>
              </div>
              <Button asChild size="sm" variant="outline"><Link href={s.href}>{s.cta}</Link></Button>
            </div>
          ))}
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border bg-muted/30 p-3">
            <ListChecks className="size-4 text-primary" />
            <p className="mt-2 text-sm font-medium">Repeatable</p>
            <p className="text-xs text-muted-foreground">Same delivery standard every time.</p>
          </div>
          <div className="rounded-xl border bg-muted/30 p-3">
            <ShieldCheck className="size-4 text-primary" />
            <p className="mt-2 text-sm font-medium">Safer sharing</p>
            <p className="text-xs text-muted-foreground">Built-in risk check before sending.</p>
          </div>
          <div className="rounded-xl border bg-muted/30 p-3">
            <Sparkles className="size-4 text-primary" />
            <p className="mt-2 text-sm font-medium">Premium finish</p>
            <p className="text-xs text-muted-foreground">Clean pages, signatures, small file.</p>
          </div>
        </div>

        <Button asChild className="mt-5 w-full" size="lg">
          <Link href="/merge-pdf">Start packet <ArrowRight className="size-4" /></Link>
        </Button>
      </CardContent>
    </Card>
  );
}
