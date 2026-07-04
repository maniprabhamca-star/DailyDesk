'use client';

import { useRef, useState } from 'react';
import { Upload, ScanText, X, Loader2, Cloud, Copy, Check, FileDown } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { downloadBlob as download } from '@/lib/download';
import { PdfDone } from '@/components/app/pdf-done';
import { openPdf, yieldToLoop } from '@/lib/pdf-render';

// OCR — scanned PDF/image → searchable PDF + extracted text.
// License-clean: pages are rasterized to 300-DPI PNG IN THE BROWSER (pdf.js,
// Apache-2.0), then a small server runs Tesseract (Apache-2.0) — no
// Ghostscript/Poppler. File is processed then deleted immediately.

const MAX_BYTES = 100 * 1024 * 1024;
const MAX_PAGES = 30;
const OCR_DPI = 300;
const MAX_LONG_EDGE = 3500; // clamp huge pages so uploads stay sane

function fmt(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

// Rasterize each PDF page to a crisp 300-DPI PNG (best OCR input).
async function rasterizePdf(file: File, onPage: (done: number, total: number) => void): Promise<Blob[]> {
  const handle = await openPdf(file);
  const total = Math.min(handle.numPages, MAX_PAGES);
  const out: Blob[] = [];
  try {
    for (let i = 0; i < total; i++) {
      const page = await handle.doc.getPage(i + 1);
      const base = page.getViewport({ scale: 1 });
      let scale = OCR_DPI / 72;
      const longEdge = Math.max(base.width, base.height) * scale;
      if (longEdge > MAX_LONG_EDGE) scale *= MAX_LONG_EDGE / longEdge;
      const viewport = page.getViewport({ scale });
      const canvas = document.createElement('canvas');
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      const cx = canvas.getContext('2d');
      if (!cx) throw new Error('no 2d context');
      cx.fillStyle = '#ffffff';
      cx.fillRect(0, 0, canvas.width, canvas.height);
      await page.render({ canvas, viewport, background: 'rgba(255,255,255,1)', intent: 'print' }).promise;
      const blob = await new Promise<Blob>((res, rej) =>
        canvas.toBlob((b) => (b ? res(b) : rej(new Error('render failed'))), 'image/png'),
      );
      canvas.width = 0; canvas.height = 0;
      out.push(blob);
      onPage(i + 1, total);
      await yieldToLoop();
    }
  } finally {
    await handle.destroy();
  }
  return out;
}

function b64ToBlob(b64: string, type: string): Blob {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type });
}

export function OcrTool() {
  const [file, setFile] = useState<File | null>(null);
  const [isImage, setIsImage] = useState(false);
  const [busy, setBusy] = useState(false);
  const [phase, setPhase] = useState<'rasterize' | 'upload' | 'ocr' | null>(null);
  const [prog, setProg] = useState<number | null>(null);
  const [pageMsg, setPageMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ blob: Blob; name: string; secs: number } | null>(null);
  const [text, setText] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function loadOne(f?: File) {
    if (!f) return;
    const img = /^image\//.test(f.type) || /\.(png|jpe?g|webp|tiff?|bmp)$/i.test(f.name);
    const pdf = f.type === 'application/pdf' || /\.pdf$/i.test(f.name);
    if (!img && !pdf) { setError('Please choose a PDF or an image (PNG, JPG, TIFF…).'); return; }
    if (f.size > MAX_BYTES) { setError(`This file is ${fmt(f.size)} — the limit is ${fmt(MAX_BYTES)}.`); return; }
    setError(null); setDone(null); setText(null); setIsImage(img && !pdf); setFile(f);
  }

  async function run() {
    if (!file) return;
    setBusy(true); setError(null); setDone(null); setText(null);
    const t0 = performance.now();
    try {
      let pages: Blob[];
      if (isImage) {
        pages = [file];
      } else {
        setPhase('rasterize'); setProg(0); setPageMsg('Preparing pages…');
        pages = await rasterizePdf(file, (d, tot) => { setProg(Math.round((d / tot) * 100)); setPageMsg(`Preparing page ${d} of ${tot}…`); });
      }
      setPageMsg(null);

      const form = new FormData();
      pages.forEach((b, i) => form.append('pages', b, `p${i}.png`));

      const result: { pdf: string; text: string; pages: number } = await new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', '/api/ocr');
        xhr.responseType = 'json';
        setPhase('upload'); setProg(0);
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) {
            const pct = Math.round((e.loaded / e.total) * 100);
            setProg(pct);
            if (pct >= 100) setPhase('ocr');
          }
        };
        xhr.onerror = () => reject(new Error('Could not reach the OCR server — check your connection and try again.'));
        xhr.onload = () => {
          if (xhr.status === 200 && xhr.response?.pdf) return resolve(xhr.response);
          const msg = xhr.response?.error
            || (xhr.status === 429 ? 'Too many OCR jobs — please try again in a few minutes.' : 'OCR failed — please try a clearer scan or fewer pages.');
          reject(new Error(msg));
        };
        xhr.send(form);
      });

      const blob = b64ToBlob(result.pdf, 'application/pdf');
      const name = `${file.name.replace(/\.[^.]+$/, '')}-ocr.pdf`;
      download(blob, name);
      setDone({ blob, name, secs: (performance.now() - t0) / 1000 });
      setText((result.text || '').trim() || null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'OCR failed — please try again.');
    } finally {
      setBusy(false); setPhase(null); setProg(null); setPageMsg(null);
    }
  }

  return (
    <Card>
      <CardContent className="p-5">
        <p className="mb-4 flex items-start gap-2 rounded-lg border border-amber-500/25 bg-amber-500/[0.07] px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
          <Cloud className="mt-0.5 size-4 shrink-0" />
          <span>
            Text recognition runs on our server: your pages are prepared in your browser, sent over an encrypted
            connection, read by the OCR engine, and <span className="font-semibold">deleted immediately</span> — never
            stored. <Link href="/security#where-data-goes" className="underline">How we handle data</Link>
          </span>
        </p>

        <input ref={inputRef} type="file" accept="application/pdf,image/*" className="hidden" onChange={(e) => { loadOne(e.target.files?.[0]); e.currentTarget.value = ''; }} />
        {!file ? (
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); loadOne(e.dataTransfer.files?.[0]); }}
            onClick={() => inputRef.current?.click()}
            className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-border p-8 text-center transition-colors hover:border-primary/50 hover:bg-accent/40"
          >
            <Upload className="size-7 text-muted-foreground" />
            <p className="mt-2 text-sm font-medium">Drop a scanned PDF or image here, or click to choose</p>
            <p className="text-xs text-muted-foreground">PDF or image (PNG, JPG, TIFF) — up to {fmt(MAX_BYTES)}, {MAX_PAGES} pages</p>
          </div>
        ) : (
          <div className="flex items-center gap-3 rounded-lg border bg-card p-2.5">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-emerald-100 text-emerald-600 dark:bg-emerald-950/40"><ScanText className="size-4" /></span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{file.name}</p>
              <p className="text-xs text-muted-foreground">{fmt(file.size)}</p>
            </div>
            <Button size="icon" variant="ghost" aria-label="Remove" onClick={() => { setFile(null); setDone(null); setText(null); setError(null); }}><X className="size-4" /></Button>
          </div>
        )}

        {busy && (
          <div className="mt-4">
            <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
              <div className={`h-full rounded-full bg-primary transition-all ${phase === 'ocr' ? 'animate-pulse' : ''}`} style={{ width: `${phase === 'ocr' ? 100 : prog ?? 0}%` }} />
            </div>
            <p className="mt-1.5 text-center text-xs text-muted-foreground">
              {pageMsg || (phase === 'upload' ? `Uploading securely… ${prog ?? 0}%` : 'Recognising text on the server — this can take a little while…')}
            </p>
          </div>
        )}

        {error && <p className="mt-4 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}

        {file && !done && (
          <Button className="mt-5 w-full" size="lg" onClick={run} disabled={busy}>
            {busy ? <><Loader2 className="size-4 animate-spin" /> Recognising…</> : <><ScanText className="size-4" /> Run OCR</>}
          </Button>
        )}

        {done && (
          <>
            <PdfDone blob={done.blob} name={done.name} secs={done.secs} currentHref="/ocr-pdf" fromLabel="OCR" />
            {text ? (
              <div className="mt-4 rounded-xl border bg-card">
                <div className="flex items-center justify-between border-b px-3 py-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Extracted text</p>
                  <div className="flex gap-1.5">
                    <Button size="sm" variant="ghost" onClick={() => { navigator.clipboard?.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1500); }}>
                      {copied ? <><Check className="size-3.5" /> Copied</> : <><Copy className="size-3.5" /> Copy</>}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => download(new Blob([text], { type: 'text/plain' }), `${file!.name.replace(/\.[^.]+$/, '')}.txt`)}>
                      <FileDown className="size-3.5" /> .txt
                    </Button>
                  </div>
                </div>
                <pre className="max-h-72 overflow-auto whitespace-pre-wrap px-3 py-2.5 text-sm leading-relaxed">{text}</pre>
              </div>
            ) : (
              <p className="mt-3 text-center text-xs text-muted-foreground">Your searchable PDF is ready — select or search its text in any PDF viewer.</p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
