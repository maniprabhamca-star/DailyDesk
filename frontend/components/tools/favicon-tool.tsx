'use client';

import { useEffect, useRef, useState } from 'react';
import { Upload, Sparkles, Download, Loader2, AlertTriangle, X, ShieldCheck, Copy, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { downloadBlob } from '@/lib/download';
import { KeepGoing } from '@/components/app/keep-going';
import {
  buildFaviconPack, DEFAULT_FAVICON_OPTIONS, HTML_SNIPPET, type FaviconOptions, type FaviconPack,
} from '@/lib/favicon-pack';

export function FaviconTool() {
  const [file, setFile] = useState<File | null>(null);
  const [opts, setOpts] = useState<FaviconOptions>(DEFAULT_FAVICON_OPTIONS);
  const [pack, setPack] = useState<FaviconPack | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => () => { pack?.previews.forEach((p) => URL.revokeObjectURL(p.url)); }, [pack]);

  async function build(f: File, o: FaviconOptions) {
    setBusy(true);
    setError(null);
    try {
      const next = await buildFaviconPack(f, o);
      setPack((prev) => { prev?.previews.forEach((p) => URL.revokeObjectURL(p.url)); return next; });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not read that image.');
    } finally {
      setBusy(false);
    }
  }

  async function pick(f?: File) {
    if (!f) return;
    if (!f.type.startsWith('image/')) { setError('Please choose an image — PNG, JPG, SVG or WebP.'); return; }
    setFile(f);
    await build(f, opts);
  }

  function set<K extends keyof FaviconOptions>(k: K, v: FaviconOptions[K]) {
    const next = { ...opts, [k]: v };
    setOpts(next);
    if (file) void build(file, next);
  }

  async function copySnippet() {
    try { await navigator.clipboard.writeText(HTML_SNIPPET); setCopied(true); setTimeout(() => setCopied(false), 1600); } catch { /* blocked */ }
  }

  function reset() { setFile(null); setPack(null); setError(null); }

  if (!file) {
    return (
      <div>
        <button
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => { e.preventDefault(); void pick(e.dataTransfer.files?.[0]); }}
          className="flex w-full flex-col items-center justify-center rounded-2xl border-2 border-dashed border-border bg-card p-12 text-center transition hover:border-primary/50 hover:bg-primary/5"
        >
          <span className="flex size-14 items-center justify-center rounded-full bg-primary/10 text-primary"><Upload className="size-6" /></span>
          <span className="mt-4 text-base font-semibold">Drop your logo</span>
          <span className="mt-1 text-sm text-muted-foreground">every icon a site needs, plus a real .ico — made on your device</span>
          <span className="mt-4 inline-flex h-9 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground shadow-sm">Choose image</span>
        </button>
        <input ref={inputRef} type="file" accept="image/*" aria-label="Choose an image file" className="dd-file-input" onChange={(e) => { void pick(e.target.files?.[0]); e.target.value = ''; }} />
        {error && (
          <div className="mt-3 flex items-start gap-2 rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400" />
            <p className="text-muted-foreground">{error}</p>
          </div>
        )}
        <PrivacyNote />
      </div>
    );
  }

  return (
    <div>
      <div className="rounded-2xl border bg-card shadow-soft">
        <div className="flex flex-wrap items-center gap-3 border-b p-4">
          <Sparkles className="size-5 shrink-0 text-primary" />
          <span className="min-w-0 flex-1 truncate text-sm font-semibold" title={file.name}>{file.name}</span>
          {pack && <span className="shrink-0 text-xs text-muted-foreground">{pack.count} files</span>}
          <button onClick={reset} aria-label="Remove image" className="text-muted-foreground hover:text-foreground"><X className="size-4" /></button>
        </div>

        <div className="grid gap-4 p-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,230px)]">
          <div>
            {busy && !pack ? (
              <div className="flex h-40 items-center justify-center text-muted-foreground"><Loader2 className="size-6 animate-spin" /></div>
            ) : (
              <div className="flex flex-wrap items-end gap-4">
                {pack?.previews.map((p) => (
                  <figure key={p.file} className="text-center">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={p.url} alt={`${p.size}px icon`} width={Math.min(p.size, 64)} height={Math.min(p.size, 64)}
                      className="mx-auto rounded border bg-white" style={{ imageRendering: p.size <= 48 ? 'pixelated' : 'auto' }} />
                    <figcaption className="mt-1 text-[10px] leading-tight text-muted-foreground">
                      <b className="block text-foreground">{p.size}px</b>{p.why}
                    </figcaption>
                  </figure>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-3">
            <label className="block">
              <span className="mb-1 block text-[11px] font-medium text-muted-foreground">Site name (for the manifest)</span>
              <input value={opts.appName} onChange={(e) => set('appName', e.target.value)}
                className="h-9 w-full rounded-md border bg-background px-2.5 text-sm outline-none focus:border-primary" />
            </label>
            <label className="block">
              <span className="mb-1 block text-[11px] font-medium text-muted-foreground">Padding {Math.round(opts.padding * 100)}%</span>
              <input type="range" min={0} max={30} value={Math.round(opts.padding * 100)}
                onChange={(e) => set('padding', Number(e.target.value) / 100)} className="w-full accent-primary" />
            </label>
            <label className="flex items-center gap-2 text-xs">
              <input type="checkbox" checked={!!opts.background} onChange={(e) => set('background', e.target.checked ? '#ffffff' : null)} className="size-4 accent-primary" />
              Solid background
            </label>
            {opts.background && (
              <input type="color" value={opts.background} onChange={(e) => set('background', e.target.value)} className="h-8 w-full cursor-pointer rounded border bg-background" />
            )}
            <label className="flex items-center gap-2 text-xs">
              <input type="checkbox" checked={opts.rounded} onChange={(e) => set('rounded', e.target.checked)} className="size-4 accent-primary" />
              Round the corners off
            </label>
          </div>
        </div>

        <div className="border-t px-4 py-3">
          <div className="mb-1.5 flex items-center gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Paste this into your &lt;head&gt;</span>
            <button onClick={() => void copySnippet()} className="inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-medium text-muted-foreground hover:text-foreground">
              {copied ? <><Check className="size-3" /> Copied</> : <><Copy className="size-3" /> Copy</>}
            </button>
          </div>
          <pre className="overflow-x-auto rounded-lg border bg-muted/30 p-3 font-mono text-[11px] leading-relaxed">{HTML_SNIPPET}</pre>
        </div>

        <div className="flex flex-wrap items-center gap-3 border-t bg-muted/20 px-4 py-3">
          <span className="text-xs text-muted-foreground">Includes a real multi-size favicon.ico and a web manifest.</span>
          <Button onClick={() => pack && downloadBlob(pack.zip, 'favicons.zip')} disabled={!pack || busy} className="ml-auto bg-primary text-primary-foreground">
            {busy ? <Loader2 className="mr-1.5 size-4 animate-spin" /> : <Download className="mr-1.5 size-4" />} Download the pack
          </Button>
        </div>

        {error && <p className="border-t px-4 py-2.5 text-sm text-destructive">{error}</p>}
      </div>

      <PrivacyNote />
      {pack && <KeepGoing title="Do more, privately" />}
    </div>
  );
}

function PrivacyNote() {
  return (
    <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-3.5 text-[13px] leading-relaxed text-foreground">
      <ShieldCheck className="mt-0.5 size-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
      <p><b>Made on your device.</b> Every icon is drawn and packed in this browser tab — an unreleased logo never leaves your machine.</p>
    </div>
  );
}
