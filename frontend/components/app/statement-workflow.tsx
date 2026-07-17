import type { Metadata } from 'next';
import { KeywordLanding } from '@/components/app/keyword-landing';
import { getWorkflow } from '@/lib/statement-workflows';

// Shared renderer for the outcome-led Statement Converter SEO pages
// (bank-statement-to-tally / -quickbooks / -csv). One data source, one component,
// so each route file stays a 3-line stub.
export function workflowMetadata(slug: string): Metadata {
  const w = getWorkflow(slug);
  if (!w) return {};
  return {
    title: `Bank Statement to ${w.short} — Free | DiemDesk`,
    description: `Convert a bank statement PDF to ${w.target} — every transaction verified against the running balance, read in your browser and never uploaded.`,
    alternates: { canonical: `/${w.slug}` },
    openGraph: {
      images: ['/og.png'],
      title: `Bank Statement to ${w.short} — private`,
      description: `Turn a bank statement into ${w.target}, verified and on your device.`,
      type: 'website',
    },
  };
}

export function WorkflowLanding({ slug }: { slug: string }) {
  const w = getWorkflow(slug);
  if (!w) return null;
  return (
    <KeywordLanding
      h1={w.h1}
      lede={w.lede}
      ctaHref="/bank-statement-converter"
      ctaLabel="Open the converter"
      bullets={w.bullets}
      body={
        <>
          <p className="text-sm leading-relaxed text-muted-foreground">{w.intro}</p>

          <h2 className="mt-8 text-xl font-bold tracking-tight">How it works</h2>
          <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-sm text-muted-foreground">
            {w.steps.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ol>

          <div className="mt-6 rounded-xl border border-emerald-500/30 bg-emerald-500/[0.07] p-4 text-sm leading-relaxed text-muted-foreground">
            <b className="text-foreground">Private by design:</b> a bank statement is the most sensitive document you own,
            and every other converter uploads it to their servers. DiemDesk reads it in your browser — open DevTools →
            Network and you’ll see zero requests leave. It’s a conversion aid, not accounting or tax advice, and DiemDesk
            isn’t affiliated with any bank; always check the output before filing.
          </div>
        </>
      }
      faqs={w.faqs}
    />
  );
}
