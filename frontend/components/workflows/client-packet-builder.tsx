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

const PACKET_TYPES = [
  { name: 'Client onboarding', detail: 'Agreement, ID, intake form, payment authorization.' },
  { name: 'Sales proposal', detail: 'Proposal, scope, quote, terms, signature page.' },
  { name: 'Invoice packet', detail: 'Invoice, receipt, supporting docs, share-safe check.' },
];

export function ClientPacketBuilder() {
  const [done, setDone] = useState<boolean[]>(() => STEPS.map(() => false));
  const [packetType, setPacketType] = useState(PACKET_TYPES[0].name);
  const completed = done.filter(Boolean).length;
  const pct = useMemo(() => Math.round((completed / STEPS.length) * 100), [completed]);
  const nextStepIndex = done.findIndex((v) => !v);
  const nextStep = nextStepIndex >= 0 ? STEPS[nextStepIndex] : null;
  const selectedPacket = PACKET_TYPES.find((p) => p.name === packetType) || PACKET_TYPES[0];

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

        <div className="mt-4 grid gap-2 sm:grid-cols-3">
          {PACKET_TYPES.map((p) => (
            <button
              key={p.name}
              type="button"
              onClick={() => setPacketType(p.name)}
              aria-pressed={packetType === p.name}
              className={`rounded-xl border p-3 text-left transition-all hover:-translate-y-0.5 hover:shadow-soft ${packetType === p.name ? 'border-primary bg-primary/10 text-foreground' : 'bg-card'}`}
            >
              <span className="text-sm font-semibold">{p.name}</span>
              <span className="mt-1 block text-xs leading-5 text-muted-foreground">{p.detail}</span>
            </button>
          ))}
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_0.72fr]">
          <div className="grid gap-3">
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
                <Button asChild size="sm" variant={nextStepIndex === i ? 'primary' : 'outline'}><Link href={s.href}>{s.cta}</Link></Button>
              </div>
            ))}
          </div>

          <div className="rounded-2xl border bg-muted/30 p-4">
            <p className="text-sm font-semibold">Send-ready output</p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              {selectedPacket.name} creates one polished PDF bundle with cleaned pages, required signatures, smaller file size, and a final share-safe risk pass.
            </p>
            <div className="mt-4 rounded-xl border bg-card p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Next best action</p>
              {nextStep ? (
                <>
                  <p className="mt-2 text-sm font-semibold">{nextStep.title}</p>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">{nextStep.body}</p>
                  <Button asChild className="mt-3 w-full" size="sm"><Link href={nextStep.href}>{nextStep.cta} <ArrowRight className="size-3.5" /></Link></Button>
                </>
              ) : (
                <>
                  <p className="mt-2 text-sm font-semibold">Packet is ready to send</p>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">Download or share the final PDF from the last tool you used.</p>
                </>
              )}
            </div>
            <div className="mt-3 grid gap-2 text-xs text-muted-foreground">
              <p>Use this when you send the same kind of PDF package repeatedly.</p>
              <p>It does not replace the individual tools; it gives the user a guided path through them.</p>
            </div>
          </div>
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
