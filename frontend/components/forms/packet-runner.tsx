'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Download,
  FileText,
  Info,
  Loader2,
  ShieldCheck,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { setHandoff } from '@/lib/file-handoff';
import { reviewedOnLabel } from '@/lib/form-tasks';
import { extractNativeFields, exportFilledPdf, type NativeValue } from '@/lib/fill-pdf';
import {
  SHARED_LABELS,
  SKIP,
  blankFormUrl,
  groupSkipped,
  groupWrites,
  lineLabel,
  keysUsedBy,
  packetFor,
  planFill,
  type FillPlan,
  type SharedDetails,
  type SharedKey,
} from '@/lib/form-packet';

// The packet: every form a job involves, fetched in the job's own order, with
// the details that repeat across them already in the boxes.
//
// ── What this component is careful about ────────────────────────────────────
// 1. It asks only for the details the forms in THIS set actually use. Asking
//    for a taxpayer number that nothing needs would be indefensible on a page
//    whose argument is that we keep nothing.
// 2. The details live in this component's state and nowhere else. No storage,
//    no request carries them: the blank forms come IN through our proxy and
//    everything after that happens here.
// 3. It says, per form, whether anything was pre-filled — and names every box
//    it left alone and why. A packet that quietly skips something looks
//    broken; one that explains itself is the product.

type Result = {
  formSlug: string;
  short: string;
  name: string;
  /** Why this form is in THIS set — the task’s own words for it. */
  role: string;
  file: File;
  plan: FillPlan | null;
  verifiedOn?: string;
  unmapped: readonly { line: string; label: string; why: string }[];
};

export function PacketRunner({
  taskSlug,
  forms,
}: {
  taskSlug: string;
  /** Title data, passed in from the server so this component does no lookups. */
  forms: { slug: string; short: string; name: string; role: string }[];
}) {
  const router = useRouter();
  const keys = useMemo(() => keysUsedBy(taskSlug), [taskSlug]);
  const [details, setDetails] = useState<SharedDetails>({});
  const [state, setState] = useState<'idle' | 'working' | 'done' | 'error'>('idle');
  const [progress, setProgress] = useState('');
  const [error, setError] = useState('');
  const [results, setResults] = useState<Result[]>([]);

  const set = (k: SharedKey, v: string) => setDetails((d) => ({ ...d, [k]: v }));
  const anything = keys.some((k) => (details[k] ?? '').trim().length > 0);

  async function build() {
    setState('working');
    setError('');
    setResults([]);
    const out: Result[] = [];
    try {
      for (const { formSlug, map } of packetFor(taskSlug)) {
        const meta = forms.find((f) => f.slug === formSlug);
        setProgress(`Fetching ${meta?.short ?? formSlug}…`);

        const res = await fetch(blankFormUrl(formSlug));
        if (!res.ok) {
          const body = (await res.json().catch(() => null)) as { error?: string } | null;
          throw new Error(body?.error ?? `Could not fetch ${meta?.short ?? formSlug}.`);
        }
        const blob = await res.blob();
        let file = new File([blob], `${formSlug}.pdf`, { type: 'application/pdf' });

        let plan: FillPlan | null = null;
        if (map) {
          setProgress(`Filling ${meta?.short ?? formSlug}…`);
          // What the file the agency served a moment ago actually reports —
          // not what the map was authored against. planFill compares the two
          // and refuses any box that moved.
          const native = await extractNativeFields(file);
          const actual = new Map(
            native
              .filter((f) => f.type === 'text')
              .map((f) => [f.name, { maxLength: f.maxLen ?? null }] as const),
          );
          plan = planFill(map, details, actual);

          if (plan.writes.length) {
            const values: Record<string, NativeValue> = {};
            for (const w of plan.writes) values[w.name] = w.value;
            // ⚠ Only the boxes we are actually writing. exportFilledPdf walks
            // every field it is handed and rewrites its appearance — for one
            // with no value that means setText(''), a fresh default
            // appearance and a re-render. Harmless on a blank form, but it
            // would touch all 89 boxes of an SS-4 to fill six, and “touch
            // nothing outside the map” is the property the weekly verifier
            // checks. Keep the two honest with each other.
            const written = new Set(plan.writes.map((w) => w.name));
            const filled = await exportFilledPdf(file, [], {
              values,
              custom: {},
              fields: native.filter((f) => written.has(f.name)),
              flatten: false, // the reader still has to finish it
            });
            file = new File([filled], `${formSlug}-part-filled.pdf`, { type: 'application/pdf' });
          }
        }

        out.push({
          formSlug,
          short: meta?.short ?? formSlug,
          name: meta?.name ?? formSlug,
          role: meta?.role ?? '',
          file,
          plan,
          verifiedOn: map?.verifiedOn,
          unmapped: map?.unmapped ?? [],
        });
      }
      setResults(out);
      setState('done');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong building the packet.');
      setResults(out); // keep whatever did come back
      setState('error');
    } finally {
      setProgress('');
    }
  }

  function download(r: Result) {
    const url = URL.createObjectURL(r.file);
    const a = document.createElement('a');
    a.href = url;
    a.download = r.file.name;
    a.click();
    // Revoke on the next tick: revoking synchronously races the download in
    // Chromium and leaves a .crdownload stub.
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  }

  async function downloadAll() {
    const JSZip = (await import('jszip')).default;
    const zip = new JSZip();
    for (const r of results) zip.file(r.file.name, await r.file.arrayBuffer());
    const blob = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${taskSlug}-packet.zip`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  }

  function openInFiller(r: Result) {
    setHandoff(r.file, '/fill-pdf-form');
    router.push('/fill-pdf-form');
  }

  return (
    <div className="mt-8">
      {/* ── the details ──────────────────────────────────────────────── */}
      <section className="rounded-xl border bg-card p-5">
        <h2 className="text-base font-semibold">Your details, once</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {keys.length > 0
            ? `The ${keys.length} details these ${forms.length} forms draw on. Type each one once. They stay on this device, in this tab — there is no account to save them to and nothing is sent anywhere.`
            : 'Nothing in this set repeats, so there is nothing to type here. The forms still come down in order, blank and ready.'}
        </p>

        {keys.length > 0 && (
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {keys.map((k) => {
              const secret = k === 'ssn' || k === 'ein';
              return (
                <label key={k} className="block">
                  <span className="text-xs font-medium text-muted-foreground">{SHARED_LABELS[k]}</span>
                  <input
                    type="text"
                    value={details[k] ?? ''}
                    onChange={(e) => set(k, e.target.value)}
                    inputMode={secret ? 'numeric' : 'text'}
                    autoComplete={secret ? 'off' : 'on'}
                    spellCheck={false}
                    placeholder={k === 'ssn' ? '123-45-6789' : k === 'ein' ? '12-3456789' : ''}
                    className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                  />
                </label>
              );
            })}
          </div>
        )}

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <Button onClick={build} disabled={state === 'working'}>
            {state === 'working' ? (
              <>
                <Loader2 className="size-4 animate-spin" /> {progress || 'Working…'}
              </>
            ) : (
              <>
                Get the {forms.length} forms <ArrowRight className="size-4" />
              </>
            )}
          </Button>
          {keys.length > 0 && !anything && state === 'idle' && (
            <span className="text-xs text-muted-foreground">
              Leave them blank and you still get the set, just unfilled.
            </span>
          )}
        </div>

        <p className="mt-4 flex items-start gap-2 text-xs text-muted-foreground">
          <ShieldCheck className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          Each form is fetched blank from the agency that publishes it, at the moment you click. The filling
          happens here, on your device. Close the tab and what you typed is gone.
        </p>
      </section>

      {error && (
        <p className="mt-4 flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
          {error}
        </p>
      )}

      {/* ── the packet ───────────────────────────────────────────────── */}
      {results.length > 0 && (
        <section className="mt-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-base font-semibold">
              Your packet — {results.length} {results.length === 1 ? 'form' : 'forms'}
            </h2>
            <Button variant="outline" size="sm" onClick={downloadAll}>
              <Download className="size-4" /> Download all as a zip
            </Button>
          </div>

          <ol className="mt-4 space-y-4">
            {results.map((r, i) => {
              const rows = groupWrites(r.plan?.writes ?? []);
              const wrote = r.plan?.writes.length ?? 0;
              // A box left blank because the reader did not type anything is not
              // news. A box left blank because it MOVED is the whole point.
              const skipped = groupSkipped((r.plan?.skipped ?? []).filter((s) => s.why !== SKIP.empty));
              return (
                <li key={r.formSlug} className="rounded-xl border bg-card p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs text-muted-foreground">Step {i + 1}</p>
                      {/* `short` is "I-9" and `name` is "Form I-9", so printing
                          both gave "I-9 — Form I-9". The useful second half is
                          what the form is FOR in this particular job. */}
                      <h3 className="mt-0.5 font-semibold">
                        <Link href={`/us-forms/${r.formSlug}`} className="underline-offset-2 hover:underline">
                          {r.name}
                        </Link>
                      </h3>
                      {r.role && <p className="mt-0.5 text-xs text-muted-foreground">{r.role}</p>}
                    </div>
                    <span
                      className={`shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-medium ${
                        wrote > 0
                          ? 'border-emerald-600/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
                          : 'border-border bg-muted text-muted-foreground'
                      }`}
                    >
                      {wrote > 0 ? `${wrote} ${wrote === 1 ? 'box' : 'boxes'} filled` : 'Blank'}
                    </span>
                  </div>

                  {wrote > 0 && (
                    <dl className="mt-3 divide-y rounded-lg border text-sm">
                      {rows.map((w) => (
                        <div key={w.key} className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 p-2.5">
                          <dt className="text-xs text-muted-foreground">
                            {lineLabel(w.line)} · {w.label}
                          </dt>
                          <dd className="font-medium tabular-nums">{w.value}</dd>
                          {w.boxes > 1 && (
                            <span className="text-[11px] text-muted-foreground">
                              across {w.boxes} printed boxes
                            </span>
                          )}
                          {w.note && (
                            <p className="w-full text-xs text-amber-700 dark:text-amber-500">{w.note}</p>
                          )}
                        </div>
                      ))}
                    </dl>
                  )}

                  {wrote === 0 && (
                    <p className="mt-3 text-sm text-muted-foreground">
                      {r.plan
                        ? 'Nothing from your details belongs in this one, so it comes down as the agency publishes it.'
                        : 'This form takes details we do not ask for, so it comes down blank and you fill it in the editor.'}
                    </p>
                  )}

                  {(skipped.length > 0 || r.unmapped.length > 0) && (
                    <ul className="mt-3 space-y-1.5 rounded-lg border border-amber-500/25 bg-amber-500/5 p-3 text-xs">
                      {skipped.map((s) => (
                        <li key={s.key} className="flex items-start gap-2">
                          <Info className="mt-0.5 size-3.5 shrink-0 text-amber-600" aria-hidden />
                          <span>
                            <span className="font-medium">
                              {lineLabel(s.line)} · {s.label}
                            </span>{' '}
                            — {s.why}
                          </span>
                        </li>
                      ))}
                      {r.unmapped.map((u) => (
                        <li key={u.line} className="flex items-start gap-2">
                          <Info className="mt-0.5 size-3.5 shrink-0 text-amber-600" aria-hidden />
                          <span>
                            <span className="font-medium">
                              {lineLabel(u.line)} · {u.label}
                            </span>{' '}
                            — {u.why}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}

                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    <Button size="sm" onClick={() => openInFiller(r)}>
                      <FileText className="size-4" /> Finish it here
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => download(r)}>
                      <Download className="size-4" /> Download
                    </Button>
                    {r.verifiedOn && (
                      <span className="ml-auto flex items-center gap-1.5 text-[11px] text-muted-foreground">
                        <CheckCircle2 className="size-3.5" aria-hidden />
                        Boxes on this form last read {reviewedOnLabel(r.verifiedOn)}
                      </span>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        </section>
      )}
    </div>
  );
}
