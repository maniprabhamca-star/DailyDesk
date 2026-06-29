'use client';

import { useRef, useState } from 'react';
import { Upload, FileText, X, Download, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { parseRanges } from '@/components/pdf/split-tool';

type Format = 'jpg' | 'png';
type Quality = 'high' | 'medium' | 'low';
type Resolution = 'standard' | 'high';

const QUALITY: Record<Quality, number> = { high: 0.92, medium: 0.8, low: 0.6 };
const SCALE: Record<Resolution, number> = { standard: 2, high: 3 };
const MAX_DIM = 5000; // clamp very large pages to keep canvas/memory safe

function fmt(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

const selectCls =
  'h-9 rounded-lg border bg-card px-2 text-sm font-medium text-foreground outline-none focus:border-primary';
const inputCls =
  'h-9 w-full rounded-lg border bg-card px-3 text-sm text-foreground outline-none focus:border-primary';

function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function PdfToJpgTool() {
  const [file, setFile] = useState<File | null>(null);
  const [pageCount, setPageCount] = useState(0);
  const [format, setFormat] = useState<Format>('jpg');
  const [quality, setQuality] = useState<Quality>('high');
  const [resolution, setResolution] = useState<Resolution>('standard');
  const [ranges, setRanges] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function pick(files: FileList | null) {
    const f = files?.[0];
    if (!f) return;
    if (f.type !== 'application/pdf' && !f.name.toLowerCase().endsWith('.pdf')) {
      setError('Please choose a PDF file.');
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const { PDFDocument } = await import('pdf-lib'); // light: page count only
      const doc = await PDFDocument.load(await f.arrayBuffer(), { ignoreEncryption: true });
      const count = doc.getPageCount();
      setFile(f);
      setPageCount(count);
      setRanges(`1-${count}`);
    } catch {
      setError('Could not read that PDF. It may be corrupted or password-protected.');
    } finally {
      setBusy(false);
    }
  }

  function clear() {
    setFile(null);
    setPageCount(0);
    setRanges('');
    setError(null);
  }

  async function run() {
    if (!file) {
      setError('Add a PDF first.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const pdfjs = await import('pdfjs-dist'); // heavy engine — load only on convert
      const data = await file.arrayBuffer();
      // pdf.js v3 ships a classic worker (no module-worker handshake) served from /public.
      pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js';
      const loadingTask = pdfjs.getDocument({ data });
      const doc = await loadingTask.promise;
      try {
        const total = doc.numPages;
        const pages = parseRanges(ranges, total); // 1-based, may throw
        const mime = format === 'png' ? 'image/png' : 'image/jpeg';
        const q = format === 'png' ? undefined : QUALITY[quality];
        const base = file.name.replace(/\.pdf$/i, '');
        const pad = String(total).length;
        const results: { name: string; blob: Blob }[] = [];

        for (const n of pages) {
          const page = await doc.getPage(n);
          let s = SCALE[resolution];
          let viewport = page.getViewport({ scale: s });
          const longEdge = Math.max(viewport.width, viewport.height);
          if (longEdge > MAX_DIM) {
            s = (s * MAX_DIM) / longEdge; // clamp huge pages
            viewport = page.getViewport({ scale: s });
          }
          const canvas = document.createElement('canvas');
          canvas.width = Math.ceil(viewport.width);
          canvas.height = Math.ceil(viewport.height);
          const ctx = canvas.getContext('2d');
          if (!ctx) throw new Error('Could not get a canvas to render onto.');
          // Paint a white background first. Without this, transparent areas of the page become
          // BLACK in JPEG output (JPEG has no alpha), making documents unreadable.
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          await page.render({ canvasContext: ctx, viewport, background: 'rgba(255,255,255,1)' }).promise;
          const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, mime, q));
          canvas.width = 0;
          canvas.height = 0; // free memory between pages
          if (!blob) throw new Error('Could not render a page to an image.');
          results.push({ name: `${base}-page-${String(n).padStart(pad, '0')}.${format}`, blob });
        }

        if (results.length === 1) {
          download(results[0].blob, results[0].name);
        } else {
          const JSZip = (await import('jszip')).default;
          const zip = new JSZip();
          results.forEach((r) => zip.file(r.name, r.blob));
          const zipBlob = await zip.generateAsync({ type: 'blob' });
          download(zipBlob, `${base}-images.zip`);
        }
      } finally {
        try { await loadingTask.destroy(); } catch { /* ignore */ }
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : '';
      if (/password/i.test(msg)) setError('This PDF is password-protected. Remove the password first, then convert.');
      else setError(msg ? `Could not convert: ${msg}` : 'Could not convert the PDF.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardContent className="p-5">
        {!file ? (
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); pick(e.dataTransfer.files); }}
            onClick={() => inputRef.current?.click()}
            className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-border p-8 text-center transition-colors hover:border-primary/50 hover:bg-accent/40"
          >
            <Upload className="size-7 text-muted-foreground" />
            <p className="mt-2 text-sm font-medium">Drop a PDF here, or click to choose</p>
            <p className="text-xs text-muted-foreground">Each page becomes a JPG or PNG image</p>
            <input ref={inputRef} type="file" accept="application/pdf,.pdf" className="hidden" onChange={(e) => pick(e.target.files)} />
          </div>
        ) : (
          <div className="flex items-center gap-3 rounded-lg border bg-card p-2.5">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-red-100 text-red-600 dark:bg-red-950/40"><FileText className="size-4" /></span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{file.name}</p>
              <p className="text-xs text-muted-foreground">{fmt(file.size)} · {pageCount} page{pageCount === 1 ? '' : 's'}</p>
            </div>
            <Button size="icon" variant="ghost" aria-label="Remove" onClick={clear}><X className="size-4" /></Button>
          </div>
        )}

        {file && (
          <div className="mt-4 space-y-4">
            <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
              <label className="flex items-center gap-2 text-sm">
                <span className="text-muted-foreground">Format</span>
                <select className={selectCls} value={format} onChange={(e) => setFormat(e.target.value as Format)}>
                  <option value="jpg">JPG</option>
                  <option value="png">PNG</option>
                </select>
              </label>
              {format === 'jpg' && (
                <label className="flex items-center gap-2 text-sm">
                  <span className="text-muted-foreground">Quality</span>
                  <select className={selectCls} value={quality} onChange={(e) => setQuality(e.target.value as Quality)}>
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                  </select>
                </label>
              )}
              <label className="flex items-center gap-2 text-sm">
                <span className="text-muted-foreground">Resolution</span>
                <select className={selectCls} value={resolution} onChange={(e) => setResolution(e.target.value as Resolution)}>
                  <option value="standard">Standard</option>
                  <option value="high">High</option>
                </select>
              </label>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium">Pages to convert</label>
              <input className={inputCls} value={ranges} onChange={(e) => setRanges(e.target.value)} placeholder="e.g. 1-3, 5, 8-10" inputMode="numeric" />
              <p className="mt-1 text-xs text-muted-foreground">This PDF has {pageCount} page{pageCount === 1 ? '' : 's'}. One image per page; multiple pages download as a ZIP.</p>
            </div>
          </div>
        )}

        {error && <p className="mt-4 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}

        {file && (
          <Button className="mt-5 w-full" size="lg" onClick={run} disabled={busy}>
            {busy ? <><Loader2 className="size-4 animate-spin" /> Converting…</> : <><Download className="size-4" /> Convert to {format.toUpperCase()}</>}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
