'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import { Upload, Loader2, ShieldCheck, Download, ArrowRight, CheckCircle2, RotateCcw, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { setHandoff } from '@/lib/handoff';
import { downloadBlob } from '@/lib/download';
import type { HeroCompressResult } from '@/lib/hero-compress';

// Concept A — the hero IS the product working. Drop a PDF and it's compressed
// right here, on-device (engine lazy-loaded on first drop so the homepage stays
// fast). Proves "nothing uploads" in two seconds — the one thing no upload-based
// competitor can show. Hands the file straight to the full Compress tool for more.

function fmt(b: number) {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(0)} KB`;
  return `${(b / 1024 / 1024).toFixed(1)} MB`;
}

type Done = HeroCompressResult & { name: string; file: File };

function Ring({ pct }: { pct: number }) {
  const r = 30;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative size-[76px] shrink-0">
      <svg viewBox="0 0 76 76" className="size-full">
        <circle cx="38" cy="38" r={r} fill="none" stroke="currentColor" strokeWidth="7" className="text-emerald-500/20" />
        <circle cx="38" cy="38" r={r} fill="none" stroke="currentColor" strokeWidth="7" strokeLinecap="round" className="text-emerald-500" transform="rotate(-90 38 38)" strokeDasharray={c} strokeDashoffset={c * (1 - Math.min(1, Math.max(0, pct) / 100))} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-base font-bold leading-none text-emerald-600">{pct}%</span>
        <span className="text-[9px] font-medium text-emerald-700/80">smaller</span>
      </div>
    </div>
  );
}

export function HeroLiveDemo() {
  const [phase, setPhase] = useState<'idle' | 'working' | 'done' | 'error'>('idle');
  const [done, setDone] = useState<Done | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handle(file?: File) {
    if (!file) return;
    if (file.type !== 'application/pdf' && !/\.pdf$/i.test(file.name)) {
      setErr('That’s not a PDF — drop a PDF to try it.');
      setPhase('error');
      return;
    }
    setErr(null);
    setPhase('working');
    try {
      const { heroCompress } = await import('@/lib/hero-compress'); // lazy — keeps homepage light
      const r = await heroCompress(file);
      setDone({ ...r, name: file.name, file });
      setPhase('done');
    } catch {
      setErr('Couldn’t process that one here — open it in the full tool.');
      setPhase('error');
    }
  }

  function reset() { setPhase('idle'); setDone(null); setErr(null); }
  function toCompress() { if (done) setHandoff({ files: [done.file], from: 'the homepage demo' }); }

  return (
    <div className="mx-auto w-full max-w-[440px]">
      <div className="overflow-hidden rounded-2xl border bg-card shadow-lift">
        {/* header strip — reads as a real, private workspace */}
        <div className="flex items-center gap-2 border-b bg-muted/30 px-4 py-2.5">
          <span className="flex items-center gap-1.5 text-[13px] font-semibold"><Sparkles className="size-4 text-primary" /> Try it — right here</span>
          <span className="ml-auto flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-600"><ShieldCheck className="size-3" /> On your device</span>
        </div>

        <div className="p-4">
          {phase === 'idle' || phase === 'error' ? (
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => { e.preventDefault(); handle(e.dataTransfer.files?.[0]); }}
              onClick={() => inputRef.current?.click()}
              className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-primary/30 bg-primary/[0.04] px-4 py-8 text-center transition-colors hover:border-primary/55 hover:bg-primary/[0.07]"
            >
              <Upload className="size-7 text-primary" />
              <p className="mt-2 text-sm font-semibold">Drop a PDF to compress it</p>
              <p className="mt-0.5 text-xs text-muted-foreground">It runs in this tab — your file never uploads.</p>
              <span className="mt-4 inline-flex h-9 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground shadow-sm">Choose a PDF</span>
              <input ref={inputRef} type="file" accept="application/pdf,.pdf" className="hidden" onChange={(e) => { handle(e.target.files?.[0]); e.currentTarget.value = ''; }} />
              {err && <p className="mt-3 text-xs font-medium text-amber-600">{err}</p>}
            </div>
          ) : phase === 'working' ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed px-4 py-10 text-center">
              <Loader2 className="size-7 animate-spin text-primary" />
              <p className="mt-3 text-sm font-medium">Compressing on your device…</p>
              <p className="mt-0.5 text-xs text-muted-foreground">Not a single byte leaves this tab.</p>
            </div>
          ) : done ? (
            <div>
              {done.savedPct > 0 ? (
                <div className="flex items-center gap-4 rounded-xl border border-emerald-500/30 bg-emerald-500/[0.07] p-3.5">
                  <Ring pct={done.savedPct} />
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-1.5 text-sm font-semibold text-foreground"><CheckCircle2 className="size-4 text-emerald-500" /> Compressed, privately</p>
                    <p className="mt-1 text-sm"><span className="text-muted-foreground">{fmt(done.before)}</span> <span className="text-muted-foreground">→</span> <span className="font-semibold text-emerald-600">{fmt(done.after)}</span></p>
                  </div>
                </div>
              ) : (
                <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/[0.07] p-3.5">
                  <p className="flex items-center gap-1.5 text-sm font-semibold"><CheckCircle2 className="size-4 text-emerald-500" /> Already lean — nothing to squeeze</p>
                  <p className="mt-1 text-xs text-muted-foreground">{fmt(done.before)}, and it never left your device. The full tool has stronger modes for scans.</p>
                </div>
              )}

              <div className="mt-3 grid grid-cols-2 gap-2">
                {done.savedPct > 0 ? (
                  <Button size="sm" onClick={() => downloadBlob(done.blob, done.name.replace(/\.pdf$/i, '') + '-compressed.pdf')}><Download className="size-4" /> Download</Button>
                ) : (
                  <Button size="sm" asChild><Link href="/compress-pdf" onClick={toCompress}>Full compressor <ArrowRight className="size-4" /></Link></Button>
                )}
                <Button size="sm" variant="outline" asChild><Link href="/compress-pdf" onClick={toCompress}>Open in Compress <ArrowRight className="size-4" /></Link></Button>
              </div>
              <button onClick={reset} className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-md py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground">
                <RotateCcw className="size-3.5" /> Try another file
              </button>
            </div>
          ) : null}

          {/* honest proof line — the differentiator, verifiable */}
          <p className="mt-3 flex items-center justify-center gap-1.5 text-center text-[11px] text-muted-foreground">
            <ShieldCheck className="size-3.5 text-emerald-500" /> Open your Network tab — you&rsquo;ll see zero uploads.
          </p>
        </div>
      </div>
    </div>
  );
}
