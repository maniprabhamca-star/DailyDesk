'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Check, AlertTriangle, X } from 'lucide-react';
import { factsFor } from '@/lib/tool-facts';

// "What this does to your file" + "Where this won't help".
//
// Reads its own route, so every tool page inherits these without a single
// per-page edit; a tool with no data in lib/tool-facts renders nothing.

export function ToolFacts() {
  const pathname = usePathname() || '';
  const facts = factsFor(pathname);
  if (!facts || (!facts.effects?.length && !facts.limits?.length)) return null;

  return (
    <div className="mt-14 grid gap-8 md:grid-cols-2">
      {facts.effects?.length ? (
        <section>
          <h2 className="text-xl font-bold tracking-tight">What this does to your file</h2>
          <p className="mt-1.5 text-sm text-muted-foreground">The whole list, so there are no surprises after you download.</p>
          <dl className="mt-4 rounded-xl border bg-card px-4 shadow-soft">
            {facts.effects.map((e) => (
              <div key={e.what} className="flex items-baseline justify-between gap-4 border-b py-3 last:border-b-0">
                <dt className="text-sm text-muted-foreground">{e.what}</dt>
                <dd className={`flex shrink-0 items-center gap-1.5 text-sm font-medium ${e.tone === 'warn' ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-700 dark:text-emerald-400'}`}>
                  {e.tone === 'warn' ? <AlertTriangle className="size-3.5" /> : <Check className="size-3.5" />}
                  {e.value}
                </dd>
              </div>
            ))}
          </dl>
        </section>
      ) : null}

      {facts.limits?.length ? (
        <section>
          <h2 className="text-xl font-bold tracking-tight">Where this won&rsquo;t help</h2>
          <p className="mt-1.5 text-sm text-muted-foreground">Cases we&rsquo;re the wrong tool for, and what to use instead.</p>
          <ul className="mt-4 space-y-3">
            {facts.limits.map((l) => (
              <li key={l.title} className="flex gap-2.5 rounded-xl border bg-card p-3.5 shadow-soft">
                <X className="mt-0.5 size-4 shrink-0 text-rose-600 dark:text-rose-400" />
                <p className="text-sm leading-relaxed text-muted-foreground">
                  <span className="font-medium text-foreground">{l.title}.</span> {l.detail}
                  {l.href && (
                    <>
                      {' '}
                      <Link href={l.href} className="font-medium text-primary underline underline-offset-2">
                        {l.hrefLabel ?? 'Use this instead'} &rarr;
                      </Link>
                    </>
                  )}
                </p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
