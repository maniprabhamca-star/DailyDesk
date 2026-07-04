'use client';

import { useRef, useState } from 'react';
import { Upload, ScanText, X, Loader2, Cloud, Copy, Check, FileDown, Languages } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { downloadBlob as download } from '@/lib/download';
import { PdfDone } from '@/components/app/pdf-done';
import { openPdf, yieldToLoop, type PdfHandle } from '@/lib/pdf-render';

// OCR — scanned PDF/image → searchable PDF + text. Handles ANY size: pages are
// rasterized to PNG in the browser (pdf.js) and STREAMED to the server in small
// batches (Tesseract), then the per-batch searchable PDFs are merged client-side
// with pdf-lib. So a 116-page / 27MB doc works, memory stays low, progress is
// smooth, and no single request is huge. License-clean: no Ghostscript/Poppler.

const MAX_INPUT_BYTES = 500 * 1024 * 1024; // generous — pdf.js streams large PDFs
const MAX_TOTAL_PAGES = 500;
const BATCH_PAGES = 12;                      // pages per server request
const MAX_LONG_EDGE = 3500;

const LANGUAGES = [
  { id: 'eng', name: 'English' }, { id: 'spa', name: 'Spanish' }, { id: 'fra', name: 'French' },
  { id: 'deu', name: 'German' }, { id: 'por', name: 'Portuguese' }, { id: 'ita', name: 'Italian' },
  { id: 'nld', name: 'Dutch' }, { id: 'rus', name: 'Russian' }, { id: 'chi_sim', name: 'Chinese (Simplified)' },
  { id: 'jpn', name: 'Japanese' }, { id: 'ara', name: 'Arabic' }, { id: 'hin', name: 'Hindi' },
];

function fmt(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

// 0-based page indices from a "1-10, 20" style range (blank = all). ES5-safe
// (no Set spread / destructuring — the repo targets ES5).
function parseRange(str: string, total: number): number[] {
  const s = str.trim();
  if (!s) return Array.from({ length: total }, (_, i) => i);
  const seen: Record<number, boolean> = {};
  const out: number[] = [];
  s.split(',').forEach((part) => {
    const m = part.trim().match(/^(\d+)\s*(?:-\s*(\d+))?$/);
    if (!m) return;
    let a = parseInt(m[1], 10);
    let b = m[2] ? parseInt(m[2], 10) : a;
    if (a > b) { const t = a; a = b; b = t; }
    for (let p = a; p <= b; p++) {
      if (p >= 1 && p <= total && !seen[p]) { seen[p] = true; out.push(p - 1); }
    }
  });
  return out.sort((x, y) => x - y);
}

function b64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

async function renderPagePng(handle: PdfHandle, index: number, dpi: number): Promise<Blob> {
  const page = await handle.doc.getPage(index + 1);
  const base = page.getViewport({ scale: 1 });
  let scale = dpi / 72;
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
  const blob = await new Promise<Blob>((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error('render failed'))), 'image/png'));
  canvas.width = 0; canvas.height = 0;
  return blob;
}

async function ocrBatch(blobs: Blob[], lang: string): Promise<{ pdf: Uint8Array; text: string }> {
  const form = new FormData();
  blobs.forEach((b, i) => form.append('pages', b, `p${i}.png`));
  form.append('lang', lang);
  const res = await fetch('/api/ocr', { method: 'POST', body: form });
  if (!res.ok) {
    let msg = res.status === 429 ? 'Too many OCR requests — please wait a moment.' : 'OCR failed — please try a clearer scan.';
    try { const j = await res.json(); if (j.error) msg = j.error; } catch { /* ignore */ }
    throw new Error(msg);
  }
  const j = await res.json();
  return { pdf: b64ToBytes(j.pdf), text: j.text || '' };
}

export function OcrTool() {
  const [file, setFile] = useState<File | null>(null);
  const [isImage, setIsImage] = useState(false);
  const [lang, setLang] = useState('eng');
  const [quality, setQuality] = useState<'best' | 'fast'>('best');
  const [range, setRange] = useState('');
  const [busy, setBusy] = useState(false);
  const [prog, setProg] = useState(0);
  const [msg, setMsg] = useState<string | null>(null);
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
    if (f.size > MAX_INPUT_BYTES) { setError(`This file is ${fmt(f.size)} — the limit is ${fmt(MAX_INPUT_BYTES)}.`); return; }
    setError(null); setDone(null); setText(null); setIsImage(img && !pdf); setFile(f);
  }

  async function run() {
    if (!file) return;
    setBusy(true); setError(null); setDone(null); setText(null); setProg(0);
    const t0 = performance.now();
    const dpi = quality === 'best' ? 300 : 200;
    let handle: PdfHandle | null = null;
    try {
      const chunks: Uint8Array[] = [];
      const texts: string[] = [];

      if (isImage) {
        setMsg('Recognising…');
        const { pdf, text: tx } = await ocrBatch([file], lang);
        chunks.push(pdf); texts.push(tx);
      } else {
        handle = await openPdf(file);
        let indices = parseRange(range, handle.numPages);
        if (!indices.length) throw new Error('No pages selected — check the page range.');
        let truncated = false;
        if (indices.length > MAX_TOTAL_PAGES) { indices = indices.slice(0, MAX_TOTAL_PAGES); truncated = true; }
        const total = indices.length;
        let doneCount = 0;
        for (let i = 0; i < indices.length; i += BATCH_PAGES) {
          const batch = indices.slice(i, i + BATCH_PAGES);
          const blobs: Blob[] = [];
          for (const idx of batch) { blobs.push(await renderPagePng(handle, idx, dpi)); await yieldToLoop(); }
          const { pdf, text: tx } = await ocrBatch(blobs, lang);
          chunks.push(pdf); texts.push(tx);
          doneCount += batch.length;
          setProg(Math.round((doneCount / total) * 100));
          setMsg(`Recognising page ${doneCount} of ${total}…`);
          await yieldToLoop();
        }
        if (truncated) setError(`Note: OCR ran on the first ${MAX_TOTAL_PAGES} pages (the current limit).`);
      }

      setMsg('Assembling searchable PDF…');
      const { PDFDocument } = await import('pdf-lib');
      let outBytes: Uint8Array;
      if (chunks.length === 1) {
        outBytes = chunks[0];
      } else {
        const merged = await PDFDocument.create();
        for (const chunk of chunks) {
          const src = await PDFDocument.load(chunk);
          const copied = await merged.copyPages(src, src.getPageIndices());
          copied.forEach((p) => merged.addPage(p));
        }
        outBytes = await merged.save();
      }
      const blob = new Blob([outBytes as unknown as BlobPart], { type: 'application/pdf' });

      const name = `${file.name.replace(/\.[^.]+$/, '')}-ocr.pdf`;
      download(blob, name);
      setDone({ blob, name, secs: (performance.now() - t0) / 1000 });
      setText((texts.join('\n\n') || '').trim() || null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'OCR failed — please try again.');
    } finally {
      if (handle) await handle.destroy();
      setBusy(false); setMsg(null);
    }
  }

  return (
    <Card>
      <CardContent className="p-5">
        <p className="mb-4 flex items-start gap-2 rounded-lg border border-amber-500/25 bg-amber-500/[0.07] px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
          <Cloud className="mt-0.5 size-4 shrink-0" />
          <span>
            Text recognition runs on our server: pages are prepared in your browser, streamed over an encrypted
            connection, read, and <span className="font-semibold">deleted immediately</span> — never stored.{' '}
            <Link href="/security#where-data-goes" className="underline">How we handle data</Link>
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
            <p className="text-xs text-muted-foreground">PDF or image (PNG, JPG, TIFF) — large files welcome</p>
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

        {/* Options */}
        {file && !done && (
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <div>
              <label className="mb-1 flex items-center gap-1.5 text-xs font-medium text-muted-foreground"><Languages className="size-3.5" /> Language</label>
              <select value={lang} onChange={(e) => setLang(e.target.value)} className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm">
                {LANGUAGES.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Quality</label>
              <div className="flex h-9 rounded-md border border-input p-0.5">
                {(['best', 'fast'] as const).map((q) => (
                  <button key={q} type="button" onClick={() => setQuality(q)}
                    className={`flex-1 rounded text-xs font-medium capitalize transition-colors ${quality === q ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent'}`}>
                    {q === 'best' ? 'Best (300dpi)' : 'Fast (200dpi)'}
                  </button>
                ))}
              </div>
            </div>
            {!isImage && (
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">Pages (blank = all)</label>
                <input value={range} onChange={(e) => setRange(e.target.value)} placeholder="e.g. 1-10, 20"
                  className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm" />
              </div>
            )}
          </div>
        )}

        {busy && (
          <div className="mt-4">
            <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${prog}%` }} />
            </div>
            <p className="mt-1.5 text-center text-xs text-muted-foreground">{msg || 'Working…'}</p>
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
              <p className="mt-3 text-center text-xs text-muted-foreground">Your searchable PDF is ready — select or search its text in any viewer.</p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
