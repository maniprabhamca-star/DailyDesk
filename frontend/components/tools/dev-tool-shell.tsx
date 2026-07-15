'use client';

import { useCallback, useEffect, useState } from 'react';
import { Copy, Check, ShieldCheck, RefreshCw, AlertCircle } from 'lucide-react';
import type { DevTool } from '@/lib/dev-tools';
import { runDev, type DevResult } from '@/lib/dev-run';

// The one template every tool in the pack uses: a clear Input → Output, one
// action, one-click copy, options only when the tool needs them.
export function DevToolShell({ tool }: { tool: DevTool }) {
  const [a, setA] = useState(tool.sampleA ?? '');
  const [b, setB] = useState(tool.sampleB ?? '');
  const [mode, setMode] = useState(tool.modes?.[0] ?? '');
  const [algo, setAlgo] = useState(tool.algos?.includes('SHA-256') ? 'SHA-256' : (tool.algos?.[0] ?? ''));
  const [count, setCount] = useState(5);
  const [pattern, setPattern] = useState(tool.pattern ?? '');
  const [flags, setFlags] = useState(tool.flags ?? 'g');
  const [res, setRes] = useState<DevResult>({});
  const [copied, setCopied] = useState(false);

  const run = useCallback(async () => {
    setRes(await runDev(tool.slug, { a, b, mode, algo, count, pattern, flags }));
  }, [tool.slug, a, b, mode, algo, count, pattern, flags]);

  // Live tools recompute as you type / switch options. Generators run once on
  // mount (so the page isn't empty) and then only on the Generate button.
  useEffect(() => {
    void run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [a, b, mode, algo, pattern, flags, tool.slug]);

  const outText = res.diff ? res.diff.map((d) => (d.t === 'add' ? '+ ' : d.t === 'del' ? '- ' : '  ') + d.s).join('\n') : (res.text ?? '');
  const copy = () => { if (!outText) return; navigator.clipboard?.writeText(outText); setCopied(true); setTimeout(() => setCopied(false), 1200); };

  const seg = (opts: string[], val: string, set: (v: string) => void) => (
    <div className="inline-flex overflow-hidden rounded-lg border">
      {opts.map((o) => (
        <button key={o} onClick={() => set(o)} className={`border-r px-3 py-1.5 text-xs font-semibold last:border-r-0 transition ${val === o ? 'bg-primary text-primary-foreground' : 'bg-muted/40 text-muted-foreground hover:bg-card'}`}>{o}</button>
      ))}
    </div>
  );

  const mono = 'w-full min-h-[168px] rounded-xl border bg-muted/30 p-3 font-mono text-[13px] leading-relaxed text-foreground outline-none resize-y focus:border-primary focus:ring-2 focus:ring-primary/25 whitespace-pre-wrap break-words';

  return (
    <div className="rounded-2xl border bg-card shadow-soft">
      {/* header */}
      <div className="flex items-center gap-3 border-b px-4 py-4 sm:px-5">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl border border-primary/25 bg-primary/[0.08] font-mono text-sm font-bold text-primary">{tool.glyph}</span>
        <div className="min-w-0">
          <h2 className="truncate text-base font-semibold tracking-tight">{tool.h1 || tool.name}</h2>
          <p className="truncate text-xs text-muted-foreground">{tool.tagline}</p>
        </div>
        <span className="ml-auto hidden items-center gap-1.5 whitespace-nowrap rounded-full border border-emerald-600/25 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-medium text-emerald-700 dark:text-emerald-400 sm:inline-flex"><ShieldCheck className="size-3.5" /> on your device</span>
      </div>

      <div className="p-4 sm:p-5">
        {/* regex pattern + flags */}
        {tool.kind === 'regex' && (
          <div className="mb-4 flex flex-wrap items-end gap-3">
            <div className="min-w-[220px] flex-1">
              <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Pattern</label>
              <div className="flex items-center rounded-lg border bg-muted/30 font-mono text-sm focus-within:border-primary">
                <span className="pl-2.5 text-muted-foreground">/</span>
                <input value={pattern} onChange={(e) => setPattern(e.target.value)} placeholder="pattern" className="w-full bg-transparent px-1 py-2 outline-none" spellCheck={false} />
                <span className="text-muted-foreground">/</span>
                <input value={flags} onChange={(e) => setFlags(e.target.value.replace(/[^gimsuy]/g, ''))} placeholder="flags" className="w-14 bg-transparent px-1.5 py-2 outline-none" spellCheck={false} />
              </div>
            </div>
          </div>
        )}

        {/* options */}
        {(tool.modes || tool.algos || tool.count) && (
          <div className="mb-4 flex flex-wrap items-center gap-3">
            {tool.modes && seg(tool.modes, mode, setMode)}
            {tool.algos && seg(tool.algos, algo, setAlgo)}
            {tool.count && (
              <div className="flex items-center gap-2">
                <label className="text-xs text-muted-foreground">How many</label>
                <input type="number" min={1} max={1000} value={count} onChange={(e) => setCount(Math.max(1, Math.min(1000, parseInt(e.target.value) || 1)))} className="w-20 rounded-lg border bg-muted/30 px-2.5 py-1.5 text-sm outline-none focus:border-primary" />
                <button onClick={() => void run()} className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-1.5 text-sm font-semibold text-primary-foreground shadow-sm"><RefreshCw className="size-3.5" /> Generate</button>
              </div>
            )}
          </div>
        )}

        {/* diff = two inputs; everything else = one input (unless pure generator) */}
        {tool.kind === 'diff' ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <Pane label={tool.inLabel || 'Original'}><textarea value={a} onChange={(e) => setA(e.target.value)} className={mono} spellCheck={false} /></Pane>
            <Pane label={tool.inLabelB || 'Changed'}><textarea value={b} onChange={(e) => setB(e.target.value)} className={mono} spellCheck={false} /></Pane>
          </div>
        ) : tool.kind === 'generate' ? null : (
          <div className="grid gap-3 lg:grid-cols-2">
            <Pane label={tool.inLabel || 'Input'}><textarea value={a} onChange={(e) => setA(e.target.value)} placeholder="Type or paste here…" className={mono} spellCheck={false} /></Pane>
            <OutputPane label={tool.outLabel || 'Output'} onCopy={copy} copied={copied} res={res} />
          </div>
        )}

        {/* diff + generate render their output full-width below */}
        {(tool.kind === 'diff' || tool.kind === 'generate') && (
          <div className="mt-3"><OutputPane label={tool.outLabel || 'Output'} onCopy={copy} copied={copied} res={res} /></div>
        )}
      </div>
    </div>
  );
}

function Pane({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col">
      <span className="mb-1.5 flex h-6 items-center text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</span>
      {children}
    </div>
  );
}

function OutputPane({ label, onCopy, copied, res }: { label: string; onCopy: () => void; copied: boolean; res: DevResult }) {
  const has = !!(res.text || res.diff?.length);
  return (
    <div className="flex flex-col">
      <div className="mb-1.5 flex h-6 items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</span>
        <button onClick={onCopy} disabled={!has} className="inline-flex items-center gap-1.5 rounded-md border border-primary/25 bg-primary/[0.06] px-2 py-0.5 text-[11px] font-semibold text-primary disabled:opacity-40">
          {copied ? <><Check className="size-3" /> Copied</> : <><Copy className="size-3" /> Copy</>}
        </button>
      </div>
      <div className="min-h-[168px] overflow-auto rounded-xl border bg-muted/30 p-3 font-mono text-[13px] leading-relaxed">
        {res.error ? (
          <p className="flex items-start gap-2 text-amber-600 dark:text-amber-400"><AlertCircle className="mt-0.5 size-3.5 shrink-0" /> {res.error}</p>
        ) : res.diff ? (
          res.diff.length === 0 ? <span className="text-muted-foreground/60">Identical.</span> : res.diff.map((d, i) => (
            <span key={i} className={`block whitespace-pre-wrap break-words rounded px-1 ${d.t === 'add' ? 'bg-emerald-500/12 text-emerald-700 dark:text-emerald-400' : d.t === 'del' ? 'bg-rose-500/12 text-rose-600 dark:text-rose-400 line-through decoration-rose-400/50' : ''}`}>{(d.t === 'add' ? '+ ' : d.t === 'del' ? '− ' : '  ') + (d.s || ' ')}</span>
          ))
        ) : has ? (
          <pre className="whitespace-pre-wrap break-words text-foreground">{res.text}</pre>
        ) : (
          <span className="text-muted-foreground/60">Output appears here…</span>
        )}
      </div>
    </div>
  );
}
