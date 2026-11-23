'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, Loader2, AlertCircle } from 'lucide-react';
import { setHandoff } from '@/lib/file-handoff';

// One click from "here is what this form is" to "here is the form, open and
// ready to type into".
//
// The fetch goes to our own /forms-api/file/<slug>, which pulls the blank form from
// the agency live and stores nothing. The file then rides the existing in-memory
// handoff (lib/file-handoff.ts) into the tool — the same path the PDF viewer
// uses to pass a file to a tool. It never touches disk and a hard refresh
// clears it.
//
// When the agency is slow or down this does NOT become a dead end: the error
// state keeps the direct link, so the reader can always do it the manual way.

export function GetFormButton({
  slug,
  /** e.g. "W-9" — used in the label and the downloaded filename. */
  short,
  /** Where the reader goes if we cannot fetch it. The agency's own page. */
  officialUrl,
  authority,
  /** Which tool to open it in. */
  toolHref = '/fill-pdf-form',
  toolLabel = 'fill it in your browser',
}: {
  slug: string;
  short: string;
  officialUrl: string;
  authority: string;
  toolHref?: string;
  toolLabel?: string;
}) {
  const router = useRouter();
  const [state, setState] = useState<'idle' | 'loading' | 'error'>('idle');
  const [message, setMessage] = useState('');

  async function go() {
    setState('loading');
    setMessage('');
    try {
      const r = await fetch(`/forms-api/file/${slug}`, { cache: 'no-store' });
      if (!r.ok) {
        const j = await r.json().catch(() => ({ error: '' }));
        throw new Error(j.error || `The ${authority} could not be reached.`);
      }
      const blob = await r.blob();
      const file = new File([blob], `${slug}.pdf`, { type: 'application/pdf' });
      setHandoff(file);
      router.push(toolHref);
    } catch (e) {
      setState('error');
      setMessage(e instanceof Error ? e.message : 'Could not fetch that form.');
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={go}
        disabled={state === 'loading'}
        className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground shadow-sm transition hover:opacity-90 disabled:opacity-70"
      >
        {state === 'loading' ? (
          <>
            <Loader2 className="size-4 animate-spin" /> Fetching Form {short} from the {authority}…
          </>
        ) : (
          <>
            Get Form {short} and {toolLabel} <ArrowRight className="size-4" />
          </>
        )}
      </button>

      <p className="mt-2 text-xs text-muted-foreground">
        {state === 'error' ? (
          <span className="flex items-start gap-1.5 text-amber-700 dark:text-amber-500">
            <AlertCircle className="mt-0.5 size-3.5 shrink-0" />
            <span>
              {message} Download it from{' '}
              <a href={officialUrl} target="_blank" rel="noopener noreferrer" className="font-medium underline underline-offset-2">
                the {authority}
              </a>{' '}
              and drop it into{' '}
              <a href={toolHref} className="font-medium underline underline-offset-2">
                the tool
              </a>{' '}
              instead — it works exactly the same.
            </span>
          </span>
        ) : (
          <>
            We fetch the blank form from the {authority} when you click, and keep no copy — so you always get the
            revision they publish today. Everything you then type stays in your browser.
          </>
        )}
      </p>
    </div>
  );
}
