'use client';

// Shared shell for the AI document tools (Summarize / Translate / Questions):
// the on-device load/extract pipeline, the left document panel, the premium
// segmented controls, and the honest privacy note. Mirrors Chat with PDF so the
// whole AI family looks and behaves like one product.
import { useCallback, useEffect, useRef, useState } from 'react';
import { Upload, X, Loader2, ShieldCheck, Lock, FileText, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { openPdf, renderPage, dprTarget, getPdfjs, type PdfHandle } from '@/lib/pdf-render';
import { extractChunks, type Chunk } from '@/lib/pdf-chat';
import { useFileHandoff } from '@/lib/file-handoff';

export type AiDocState = {
  file: File | null;
  numPages: number;
  chunks: Chunk[];
  status: 'idle' | 'reading' | 'ready';
  readPct: number;
  noText: boolean;
  error: string | null;
  preview: { url: string; w: number; h: number } | null;
  loadFile: (f?: File) => Promise<void>;
  reset: () => void;
  showPage: (idx: number) => void;
};

export function useAiDoc(): AiDocState {
  const [file, setFile] = useState<File | null>(null);
  const [handle, setHandle] = useState<PdfHandle | null>(null);
  const [preview, setPreview] = useState<{ url: string; w: number; h: number } | null>(null);
  const [chunks, setChunks] = useState<Chunk[]>([]);
  const [numPages, setNumPages] = useState(0);
  const [status, setStatus] = useState<'idle' | 'reading' | 'ready'>('idle');
  const [readPct, setReadPct] = useState(0);
  const [noText, setNoText] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => () => { handle?.destroy?.(); }, [handle]);

  // Warm the pdf.js engine the moment the tool opens — cold-loading it at drop
  // time was the owner-reported 5-10s lag before anything visibly happened.
  useEffect(() => { void getPdfjs().catch(() => {}); }, []);

  const paint = useCallback(async (h: PdfHandle, idx: number) => {
    try {
      const img = await renderPage(h, Math.max(0, Math.min(idx, h.numPages - 1)), dprTarget(360, 2, 1000));
      setPreview({ url: img.url, w: img.w, h: img.h });
    } catch { /* ignore */ }
  }, []);

  const loadFile = useCallback(async (f?: File) => {
    if (!f) return;
    if (f.type !== 'application/pdf' && !/\.pdf$/i.test(f.name)) { setError('Please choose a PDF.'); return; }
    setError(null); setNoText(false); setChunks([]);
    setStatus('reading'); setReadPct(0);
    try {
      const h = await openPdf(f);
      setHandle(h); setNumPages(h.numPages); setFile(f);
      void paint(h, 0);
      const { chunks: cx, hasText } = await extractChunks(f, setReadPct);
      setChunks(cx);
      setNoText(!hasText);
      setStatus('ready');
    } catch {
      setError('Could not open that PDF. It may be corrupt or password-protected.');
      setStatus('idle');
    }
  }, [paint]);

  useFileHandoff(loadFile);

  const reset = useCallback(() => {
    handle?.destroy?.();
    setFile(null); setHandle(null); setPreview(null); setChunks([]); setNumPages(0);
    setStatus('idle'); setNoText(false); setError(null);
  }, [handle]);

  const showPage = useCallback((idx: number) => { if (handle) void paint(handle, idx); }, [handle, paint]);

  return { file, numPages, chunks, status, readPct, noText, error, preview, loadFile, reset, showPage };
}

export function AiDropzone({ doc, prompt, hint }: { doc: AiDocState; prompt: string; hint?: string }) {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <div>
      <button
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => { e.preventDefault(); void doc.loadFile(e.dataTransfer.files?.[0]); }}
        className="flex w-full flex-col items-center justify-center rounded-2xl border-2 border-dashed border-border bg-card p-12 text-center transition hover:border-primary/50 hover:bg-primary/5"
      >
        <span className="flex size-14 items-center justify-center rounded-full bg-primary/10 text-primary"><Upload className="size-6" /></span>
        <span className="mt-4 text-base font-semibold">{prompt}</span>
        <span className="mt-1 text-sm text-muted-foreground">{hint || 'or click to choose — it opens on your device, never uploaded'}</span>
      </button>
      <input ref={inputRef} type="file" accept="application/pdf,.pdf" className="hidden"
        onChange={(e) => { void doc.loadFile(e.target.files?.[0]); e.target.value = ''; }} />
      {doc.error && <p className="mt-3 text-center text-sm text-destructive">{doc.error}</p>}
      <AiPrivacyNote />
    </div>
  );
}

export function AiDocPanel({ doc }: { doc: AiDocState }) {
  return (
    <aside className="flex flex-col gap-3 rounded-2xl border bg-card p-4">
      <div className="flex items-center gap-2 text-sm font-semibold">
        <FileText className="size-4 shrink-0 text-primary" />
        <span className="truncate" title={doc.file?.name}>{doc.file?.name}</span>
      </div>
      <div className="text-xs text-muted-foreground">{doc.numPages} {doc.numPages === 1 ? 'page' : 'pages'}</div>
      <div className="overflow-hidden rounded-lg border bg-muted/40">
        {doc.preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={doc.preview.url} alt="Page preview" className="w-full object-contain" draggable={false} />
        ) : (
          <div className="flex aspect-[1/1.3] items-center justify-center text-muted-foreground/40"><Loader2 className="size-5 animate-spin" /></div>
        )}
      </div>
      <div className="flex items-start gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-[11px] leading-snug text-emerald-700 dark:text-emerald-400">
        <ShieldCheck className="mt-px size-3.5 shrink-0" />
        <span>Text read <b>on your device</b>. Only the text goes to the AI — never the file. Exports are built on-device too.</span>
      </div>
      <Button variant="outline" size="sm" onClick={doc.reset} className="mt-auto"><X className="mr-1 size-3.5" /> New file</Button>
    </aside>
  );
}

export function NoTextNote() {
  return (
    <div className="flex items-center gap-2 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-700 dark:text-amber-400">
      <AlertTriangle className="size-4 shrink-0" /> This PDF has no text layer — it looks like a scan. <a href="/ocr-pdf" className="font-semibold underline">Run OCR first →</a>
    </div>
  );
}

export function AiPrivacyNote() {
  return (
    <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-amber-500/40 bg-amber-500/10 p-3.5 text-[13px] leading-relaxed text-foreground">
      <Lock className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400" />
      <p>
        <b>Straight talk on privacy:</b> AI is the one DiemDesk feature where something leaves your device. We read the PDF's
        text <b>in your browser</b>, then send only the <b>text</b> — never the file — to our server, which asks Claude.
        We don't store it or train on it. Even the exports (PDF, Word, CSV) are generated on your device.
      </p>
    </div>
  );
}

// ---- premium controls (shared look across the trio) -------------------------

export function Ctl({ label, uniq, children }: { label: string; uniq?: boolean; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="flex items-center gap-1.5 text-[10.5px] font-extrabold uppercase tracking-wide text-muted-foreground/70">
        {label}
        {uniq && <span className="rounded border border-violet-500/40 bg-violet-500/10 px-1 text-[8.5px] font-extrabold uppercase text-violet-600 dark:text-violet-400">only here</span>}
      </span>
      {children}
    </div>
  );
}

// T infers from `value` ONLY (NoInfer on the rest) — otherwise the options
// array / Dispatch<SetStateAction<...>> callers widen it to plain string.
export function Seg<T extends string>({ value, onChange, options, disabled }: {
  value: T; onChange: (v: NoInfer<T>) => void; options: Array<{ v: NoInfer<T>; label: string }>; disabled?: boolean;
}) {
  return (
    <span className="inline-flex flex-wrap overflow-hidden rounded-lg border bg-card">
      {options.map((o, i) => (
        <button key={o.v} type="button" disabled={disabled} onClick={() => onChange(o.v)}
          className={`px-3 py-1.5 text-xs font-semibold transition disabled:opacity-50 ${i ? 'border-l' : ''} ${
            value === o.v ? 'bg-violet-500/10 text-violet-600 dark:text-violet-400' : 'text-muted-foreground hover:text-foreground'
          }`}>
          {o.label}
        </button>
      ))}
    </span>
  );
}

export function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button type="button" onClick={() => onChange(!on)} className="flex items-center gap-2 py-1.5 text-xs font-semibold">
      <span className={`relative h-[17px] w-[30px] rounded-full transition ${on ? 'bg-violet-600' : 'bg-muted-foreground/30'}`}>
        <span className={`absolute top-[2px] size-[13px] rounded-full bg-white shadow transition-all ${on ? 'left-[15px]' : 'left-[2px]'}`} />
      </span>
      {label}
    </button>
  );
}

// Renders "(p.N)" citations in AI text as clickable page chips.
export function CiteText({ text, onCite }: { text: string; onCite: (p: number) => void }) {
  const parts = text.split(/(\(p\.?\s*\d+\))/gi);
  return (
    <>
      {parts.map((part, i) => {
        const m = part.match(/\(p\.?\s*(\d+)\)/i);
        if (m) {
          return (
            <button key={i} onClick={() => onCite(Number(m[1]))}
              className="mx-0.5 inline-flex items-center rounded-md border border-primary/40 bg-primary/10 px-1.5 py-px align-baseline text-[11px] font-semibold text-primary hover:bg-primary/20">
              p.{m[1]}
            </button>
          );
        }
        return <span key={i}>{part}</span>;
      })}
    </>
  );
}

export function CapChip({ remaining }: { remaining: number | null }) {
  if (remaining == null) return null;
  return <span className="ml-auto rounded-full border bg-muted/40 px-2.5 py-0.5 text-[11px] text-muted-foreground">{remaining} AI actions left this month</span>;
}
