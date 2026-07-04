'use client';

import { useRef, useState } from 'react';
import { Upload, ScanText, X, Loader2, Cloud, Copy, Check, FileDown, Languages } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { downloadBlob as download } from '@/lib/download';
import { formatDuration } from '@/lib/format';
import { PdfDone } from '@/components/app/pdf-done';
import { openPdf, yieldToLoop, type PdfHandle } from '@/lib/pdf-render';

// OCR — scanned PDF/image → SEARCHABLE PDF + text, at ~the original file size.
// Pipeline (license-clean, no Ghostscript/Poppler): pages are rasterized in the
// browser (pdf.js) and streamed to the server in batches; Tesseract returns WORD
// BOUNDING BOXES (TSV); we then overlay an INVISIBLE text layer onto the ORIGINAL
// pages with pdf-lib. So the original images/compression are kept — the file
// barely grows — and the text becomes selectable/searchable.

const MAX_INPUT_BYTES = 500 * 1024 * 1024;
const MAX_TOTAL_PAGES = 500;
const BATCH_PAGES = 12;
const MAX_LONG_EDGE = 3500;

const LANGUAGES = [
  { id: 'eng', name: 'English' }, { id: 'spa', name: 'Spanish' }, { id: 'fra', name: 'French' },
  { id: 'deu', name: 'German' }, { id: 'por', name: 'Portuguese' }, { id: 'ita', name: 'Italian' },
  { id: 'nld', name: 'Dutch' }, { id: 'rus', name: 'Russian' }, { id: 'chi_sim', name: 'Chinese (Simplified)' },
  { id: 'jpn', name: 'Japanese' }, { id: 'ara', name: 'Arabic' }, { id: 'hin', name: 'Hindi' },
];

type Word = { t: string; x: number; y: number; w: number; h: number };
type ProcPage = { origIndex: number; imgW: number; imgH: number; words: Word[] };

function fmt(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

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
    for (let p = a; p <= b; p++) if (p >= 1 && p <= total && !seen[p]) { seen[p] = true; out.push(p - 1); }
  });
  return out.sort((x, y) => x - y);
}

// Rasterize a PDF page to a JPEG (q88) at the chosen DPI. JPEG (not PNG) keeps
// the UPLOAD small; the output PDF reuses the ORIGINAL pages, not these.
async function rasterizePage(handle: PdfHandle, index: number, dpi: number): Promise<{ blob: Blob; w: number; h: number }> {
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
  const w = canvas.width, h = canvas.height;
  const blob = await new Promise<Blob>((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error('render failed'))), 'image/jpeg', 0.88));
  canvas.width = 0; canvas.height = 0;
  return { blob, w, h };
}

async function ocrBatch(blobs: Blob[], lang: string): Promise<{ pages: { words: Word[] }[]; text: string }> {
  const form = new FormData();
  blobs.forEach((b, i) => form.append('pages', b, `p${i}.jpg`));
  form.append('lang', lang);
  const res = await fetch('/api/ocr', { method: 'POST', body: form });
  if (!res.ok) {
    let msg = res.status === 429 ? 'Too many OCR requests — please wait a moment.' : 'OCR failed — please try a clearer scan.';
    try { const j = await res.json(); if (j.error) msg = j.error; } catch { /* ignore */ }
    throw new Error(msg);
  }
  return res.json();
}

async function imageSize(file: File): Promise<{ w: number; h: number }> {
  try {
    const b = await createImageBitmap(file);
    const s = { w: b.width, h: b.height };
    if (b.close) b.close();
    return s;
  } catch {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
      img.onerror = () => reject(new Error('Could not read the image.'));
      img.src = URL.createObjectURL(file);
    });
  }
}

// Overlay an invisible (opacity 0), selectable text layer onto the ORIGINAL PDF.
async function buildSearchablePdf(fileBytes: Uint8Array, processed: ProcPage[]): Promise<Blob> {
  const { PDFDocument, StandardFonts } = await import('pdf-lib');
  const doc = await PDFDocument.load(fileBytes, { ignoreEncryption: true });
  const helv = await doc.embedFont(StandardFonts.Helvetica);
  const count = doc.getPageCount();
  processed.forEach((pg) => {
    if (pg.origIndex >= count) return;
    const page = doc.getPage(pg.origIndex);
    const pw = page.getWidth();
    const ph = page.getHeight();
    const sx = pw / pg.imgW;
    const sy = ph / pg.imgH;
    pg.words.forEach((wd) => {
      const size = Math.max(wd.h * sy, 1);
      try { page.drawText(wd.t, { x: wd.x * sx, y: ph - (wd.y + wd.h) * sy, size, font: helv, opacity: 0 }); } catch { /* skip non-encodable */ }
    });
  });
  const bytes = await doc.save();
  return new Blob([bytes as unknown as BlobPart], { type: 'application/pdf' });
}

// Image input → a PDF that embeds the ORIGINAL image (kept small) + invisible text.
async function buildImagePdf(file: File, imgW: number, imgH: number, words: Word[]): Promise<Blob> {
  const { PDFDocument, StandardFonts } = await import('pdf-lib');
  const doc = await PDFDocument.create();
  const helv = await doc.embedFont(StandardFonts.Helvetica);
  const isPng = /png$/i.test(file.type) || /\.png$/i.test(file.name);
  const isJpg = /jpe?g$/i.test(file.type) || /\.jpe?g$/i.test(file.name);
  let img;
  if (isPng) img = await doc.embedPng(new Uint8Array(await file.arrayBuffer()));
  else if (isJpg) img = await doc.embedJpg(new Uint8Array(await file.arrayBuffer()));
  else {
    // webp/tiff/bmp → re-encode to JPEG via canvas so pdf-lib can embed it.
    const bmp = await createImageBitmap(file);
    const c = document.createElement('canvas'); c.width = bmp.width; c.height = bmp.height;
    c.getContext('2d')!.drawImage(bmp, 0, 0); if (bmp.close) bmp.close();
    const jpg = await new Promise<Blob>((res) => c.toBlob((b) => res(b!), 'image/jpeg', 0.9));
    img = await doc.embedJpg(new Uint8Array(await jpg.arrayBuffer()));
    c.width = 0; c.height = 0;
  }
  const page = doc.addPage([imgW, imgH]);
  page.drawImage(img, { x: 0, y: 0, width: imgW, height: imgH });
  words.forEach((wd) => {
    const size = Math.max(wd.h, 1);
    try { page.drawText(wd.t, { x: wd.x, y: imgH - (wd.y + wd.h), size, font: helv, opacity: 0 }); } catch { /* skip */ }
  });
  const bytes = await doc.save();
  return new Blob([bytes as unknown as BlobPart], { type: 'application/pdf' });
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
  const jobRef = useRef(0);

  function cancelJob() { jobRef.current++; setBusy(false); setMsg(null); setProg(0); }

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
    const myJob = ++jobRef.current;
    const alive = () => jobRef.current === myJob;
    setBusy(true); setError(null); setDone(null); setText(null); setProg(0); setMsg('Opening document…');
    const t0 = performance.now();
    const dpi = quality === 'best' ? 300 : 200;
    let handle: PdfHandle | null = null;
    try {
      const processed: ProcPage[] = [];
      const texts: string[] = [];

      if (isImage) {
        setMsg('Recognising…');
        const size = await imageSize(file);
        const { pages, text: tx } = await ocrBatch([file], lang);
        if (!alive()) return;
        processed.push({ origIndex: 0, imgW: size.w, imgH: size.h, words: (pages[0] && pages[0].words) || [] });
        texts.push(tx);
      } else {
        handle = await openPdf(file);
        if (!alive()) return;
        let indices = parseRange(range, handle.numPages);
        if (!indices.length) throw new Error('No pages selected — check the page range.');
        let truncated = false;
        if (indices.length > MAX_TOTAL_PAGES) { indices = indices.slice(0, MAX_TOTAL_PAGES); truncated = true; }
        const total = indices.length;
        const batches: number[][] = [];
        for (let i = 0; i < indices.length; i += BATCH_PAGES) batches.push(indices.slice(i, i + BATCH_PAGES));

        let prepared = 0;
        const renderBatch = async (batch: number[]) => {
          const out: { blob: Blob; w: number; h: number; origIndex: number }[] = [];
          for (const idx of batch) {
            if (!alive()) throw new Error('__cancelled');
            prepared++;
            setMsg(`Preparing page ${prepared} of ${total}…`);
            const r = await rasterizePage(handle!, idx, dpi);
            out.push({ blob: r.blob, w: r.w, h: r.h, origIndex: idx });
            await yieldToLoop();
          }
          return out;
        };

        let doneCount = 0;
        let pending = renderBatch(batches[0]);
        for (let b = 0; b < batches.length; b++) {
          const rendered = await pending;
          if (!alive()) return;
          const ocrP = ocrBatch(rendered.map((r) => r.blob), lang);
          pending = b + 1 < batches.length ? renderBatch(batches[b + 1]) : Promise.resolve([]);
          pending.catch(() => {});
          const { pages, text: tx } = await ocrP;
          if (!alive()) return;
          rendered.forEach((r, i) => processed.push({ origIndex: r.origIndex, imgW: r.w, imgH: r.h, words: (pages[i] && pages[i].words) || [] }));
          texts.push(tx);
          doneCount += rendered.length;
          setProg(Math.round((doneCount / total) * 100));
          setMsg(`Recognised ${doneCount} of ${total} pages…`);
          await yieldToLoop();
        }
        if (truncated) setError(`Note: OCR ran on the first ${MAX_TOTAL_PAGES} pages (the current limit).`);
      }

      if (!alive()) return;
      setMsg('Adding the searchable text layer…');
      const blob = isImage
        ? await buildImagePdf(file, processed[0].imgW, processed[0].imgH, processed[0].words)
        : await buildSearchablePdf(new Uint8Array(await file.arrayBuffer()), processed);

      const name = `${file.name.replace(/\.[^.]+$/, '')}-ocr.pdf`;
      if (!alive()) return;
      download(blob, name);
      setDone({ blob, name, secs: (performance.now() - t0) / 1000 });
      setText((texts.join('\n\n') || '').trim() || null);
    } catch (e) {
      const m = e instanceof Error ? e.message : 'OCR failed — please try again.';
      if (m !== '__cancelled' && jobRef.current === myJob) setError(m);
    } finally {
      if (handle) await handle.destroy();
      if (jobRef.current === myJob) { setBusy(false); setMsg(null); }
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
            <Button size="icon" variant="ghost" aria-label="Remove" onClick={() => { cancelJob(); setFile(null); setDone(null); setText(null); setError(null); }}><X className="size-4" /></Button>
          </div>
        )}

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
            <p className="text-xs text-muted-foreground sm:col-span-3">
              Tip: OCR reads every page individually, so long documents take a few minutes. For 100+ pages, <span className="font-medium">Fast</span> is ~2× quicker — or try a page range first. Your original pages are kept, so the file barely grows.
            </p>
          </div>
        )}

        {busy && (
          <div className="mt-4">
            <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${prog}%` }} />
            </div>
            <div className="mt-1.5 flex items-center justify-center gap-3">
              <p className="text-center text-xs text-muted-foreground">{msg || 'Working…'}</p>
              <button onClick={cancelJob} className="text-xs font-medium text-destructive hover:underline">Cancel</button>
            </div>
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
