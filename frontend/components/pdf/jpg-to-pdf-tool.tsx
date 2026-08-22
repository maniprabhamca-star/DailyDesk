'use client';

import { useEffect, useRef, useState } from 'react';
import { Upload, X, ArrowUp, ArrowDown, Download, Loader2, ImageIcon, Zap, ClipboardPaste, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { takeHandoff } from '@/lib/handoff';
import { downloadBlob as download } from '@/lib/download';
import { PdfDone } from '@/components/app/pdf-done';
import { imageBytesForPdf, describeImageFailure, looksLikeImage } from '@/lib/image-for-pdf';

type Item = { id: string; file: File; url: string };
type PageSize = 'fit' | 'a4' | 'letter';
type Orientation = 'auto' | 'portrait' | 'landscape';
type Margin = 'none' | 'small' | 'large';

const SIZES: Record<Exclude<PageSize, 'fit'>, [number, number]> = {
  a4: [595.28, 841.89], // points, portrait
  letter: [612, 792],
};
const MARGINS: Record<Margin, number> = { none: 0, small: 18, large: 36 };

function fmt(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

const selectCls =
  'h-9 rounded-lg border bg-card px-2 text-sm font-medium text-foreground outline-none focus:border-primary';

export function JpgToPdfTool() {
  const [items, setItems] = useState<Item[]>([]);
  const [pageSize, setPageSize] = useState<PageSize>('fit');
  const [orientation, setOrientation] = useState<Orientation>('auto');
  const [margin, setMargin] = useState<Margin>('none');
  const [storyMode, setStoryMode] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [handoffNote, setHandoffNote] = useState<string | null>(null);
  const [done, setDone] = useState<{ blob: Blob; name: string; secs: number } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // revoke all preview URLs on unmount
  useEffect(() => () => { items.forEach((it) => URL.revokeObjectURL(it.url)); }, [items]);

  // Accept anything the browser calls an image. pdf-lib only embeds JPEG/PNG
  // natively; lib/image-for-pdf decodes the rest (HEIC, WebP, AVIF, BMP, GIF,
  // and phone photos with odd MIME types), so narrowing here only served to
  // drop files on the floor.
  const isImage = looksLikeImage;

  // "Keep moving": pick up images handed over from another tool (e.g. PDF→JPG),
  // already in the browser — no re-upload. Runs once on mount.
  useEffect(() => {
    const h = takeHandoff();
    if (!h) return;
    const imgs = h.files.filter(isImage);
    if (imgs.length === 0) return;
    setItems(imgs.map((f) => ({
      id: `${f.name}-${f.size}-${Math.random().toString(36).slice(2, 7)}`,
      file: f,
      url: URL.createObjectURL(f),
    })));
    setHandoffNote(`${imgs.length} image${imgs.length === 1 ? '' : 's'} brought straight over from ${h.from} — no re-upload needed.`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function addImages(imgs: File[]) {
    if (imgs.length === 0) {
      setError('Please choose JPG or PNG images.');
      return;
    }
    setError(null);
    setItems((cur) => [
      ...cur,
      ...imgs.map((f) => ({
        id: `${f.name}-${f.size}-${Math.random().toString(36).slice(2, 7)}`,
        file: f,
        url: URL.createObjectURL(f),
      })),
    ]);
  }

  // Anything the picker hands us that we won't take gets named. Dropping some
  // of a selection and saying nothing looked exactly like a broken converter.
  function addFiles(files: FileList | null) {
    if (!files) return;
    const all = Array.from(files);
    const imgs = all.filter(isImage);
    const rejected = all.filter((f) => !isImage(f));
    addImages(imgs);
    setWarning(
      rejected.length && imgs.length
        ? `Added ${imgs.length} image${imgs.length > 1 ? 's' : ''}. Not added (not an image file): ${rejected.map((f) => f.name).join(', ')}`
        : null,
    );
    if (rejected.length && !imgs.length) {
      setError(`Not an image file: ${rejected.map((f) => f.name).join(', ')}`);
    }
  }

  useEffect(() => {
    function onPaste(e: ClipboardEvent) {
      const files = Array.from(e.clipboardData?.files || []).filter(isImage);
      if (!files.length) return;
      e.preventDefault();
      addImages(files);
      setStoryMode(true);
    }
    document.addEventListener('paste', onPaste);
    return () => document.removeEventListener('paste', onPaste);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function move(i: number, dir: -1 | 1) {
    setItems((cur) => {
      const next = [...cur];
      const j = i + dir;
      if (j < 0 || j >= next.length) return cur;
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  }

  function remove(id: string) {
    setItems((cur) => {
      const it = cur.find((x) => x.id === id);
      if (it) URL.revokeObjectURL(it.url);
      return cur.filter((x) => x.id !== id);
    });
  }

  async function convert() {
    if (items.length === 0) {
      setError('Add at least one image.');
      return;
    }
    setBusy(true);
    setError(null);
    setWarning(null);
    setDone(null);
    const t0 = performance.now();
    try {
      const { PDFDocument, StandardFonts, rgb } = await import('pdf-lib'); // load engine only when needed
      const pdf = await PDFDocument.create();
      const captionFont = storyMode ? await pdf.embedFont(StandardFonts.Helvetica) : null;
      const captionBold = storyMode ? await pdf.embedFont(StandardFonts.HelveticaBold) : null;
      const skipped: string[] = [];

      for (const { file } of items) {
        try {
          // Original bytes when pdf-lib accepts them (lossless), decoded and
          // re-encoded when it doesn't — HEIC included.
          const src = await imageBytesForPdf(file, {
            jpg: (b) => pdf.embedJpg(b),
            png: (b) => pdf.embedPng(b),
          });
          const img = src.kind === 'png' ? await pdf.embedPng(src.bytes) : await pdf.embedJpg(src.bytes);

          const index = items.findIndex((x) => x.file === file);
          const effectiveSize: PageSize = storyMode && pageSize === 'fit' ? 'letter' : pageSize;
          if (effectiveSize === 'fit') {
            const page = pdf.addPage([img.width, img.height]);
            page.drawImage(img, { x: 0, y: 0, width: img.width, height: img.height });
          } else {
            let [pw, ph] = SIZES[effectiveSize];
            const landscape =
              orientation === 'landscape' || (orientation === 'auto' && img.width > img.height);
            if (landscape) [pw, ph] = [ph, pw];
            const m = storyMode ? 28 : MARGINS[margin];
            const footerH = storyMode ? 42 : 0;
            const scale = Math.min((pw - 2 * m) / img.width, (ph - 2 * m - footerH) / img.height);
            const w = img.width * scale;
            const h = img.height * scale;
            const page = pdf.addPage([pw, ph]);
            page.drawImage(img, { x: (pw - w) / 2, y: m + footerH + (ph - 2 * m - footerH - h) / 2, width: w, height: h });
            if (storyMode && captionFont && captionBold) {
              const caption = file.name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ').trim() || `Screenshot ${index + 1}`;
              page.drawRectangle({ x: m, y: m, width: pw - 2 * m, height: 30, color: rgb(0.96, 0.96, 0.98) });
              page.drawText(`Screenshot ${index + 1}`, { x: m + 12, y: m + 17, size: 9, font: captionBold, color: rgb(0.08, 0.08, 0.14) });
              page.drawText(caption.slice(0, 72), { x: m + 12, y: m + 6, size: 8, font: captionFont, color: rgb(0.39, 0.39, 0.46) });
              page.drawText(`${index + 1} / ${items.length}`, { x: pw - m - 42, y: m + 10, size: 9, font: captionFont, color: rgb(0.39, 0.39, 0.46) });
            }
          }
        } catch (err) {
          skipped.push(describeImageFailure(file, err));
        }
      }

      if (pdf.getPageCount() === 0) {
        // Say which file failed and why. "Please try different files" told the
        // person nothing and was wrong as often as not.
        setError(`Could not convert ${items.length === 1 ? 'that image' : 'any of these images'}: ${skipped.join('; ')}`);
        return;
      }

      const out = await pdf.save();
      const name = 'converted.pdf';
      const blob = new Blob([new Uint8Array(out)], { type: 'application/pdf' });
      download(blob, name);
      setDone({ blob, name, secs: (performance.now() - t0) / 1000 });

      if (skipped.length) {
        setWarning(`Converted ${pdf.getPageCount()} image${pdf.getPageCount() > 1 ? 's' : ''}. Skipped: ${skipped.join('; ')}`);
      }
    } catch (e) {
      setError(e instanceof Error ? `Could not convert: ${e.message}` : 'Could not convert the images.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardContent className="p-5">
        {handoffNote && (
          <p className="mb-3 flex items-center gap-2 rounded-lg border border-primary/25 bg-primary/[0.06] px-3 py-2 text-sm text-foreground">
            <Zap className="size-4 shrink-0 text-primary" /> {handoffNote}
          </p>
        )}
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => { e.preventDefault(); addFiles(e.dataTransfer.files); }}
          onClick={() => inputRef.current?.click()}
          className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-border p-8 text-center transition-colors hover:border-primary/50 hover:bg-accent/40"
        >
          <Upload className="size-7 text-muted-foreground" />
          <p className="mt-2 text-sm font-medium">Drop JPG or PNG images here, or click to choose</p>
          <p className="text-xs text-muted-foreground">Add one or more — drag to set the order</p>
          <span className="mt-4 inline-flex h-9 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground shadow-sm">Choose images</span>
          {/* image/* rather than a JPG/PNG allowlist: Android's picker hides or
              mislabels gallery photos that don't match a narrow accept list. */}
          <input ref={inputRef} type="file" accept="image/*" multiple aria-label="Choose an image file" className="dd-file-input" onChange={(e) => { addFiles(e.target.files); e.currentTarget.value = ''; }} />
        </div>

        <div className="mt-4 rounded-xl border bg-muted/30 p-3">
          <button
            type="button"
            onClick={() => setStoryMode((v) => !v)}
            aria-pressed={storyMode}
            className={`flex w-full flex-wrap items-center justify-between gap-3 rounded-lg border px-3 py-2 text-left transition-colors ${storyMode ? 'border-primary bg-primary/10 text-primary' : 'bg-card hover:bg-accent'}`}
          >
            <span className="flex items-center gap-2 text-sm font-medium">
              {storyMode ? <Sparkles className="size-4" /> : <ClipboardPaste className="size-4" />} Screenshot Story mode
            </span>
            <span className="text-xs text-muted-foreground">{storyMode ? 'Captions and page numbers on' : 'Paste screenshots into a clean story PDF'}</span>
          </button>
        </div>

        {items.length > 0 && (
          <ul className="mt-4 space-y-2">
            {items.map((it, i) => (
              <li key={it.id} className="flex items-center gap-3 rounded-lg border bg-card p-2.5">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={it.url} alt="" className="size-11 shrink-0 rounded-md border object-cover" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{it.file.name}</p>
                  <p className="text-xs text-muted-foreground">{fmt(it.file.size)}</p>
                </div>
                <div className="flex items-center gap-0.5">
                  <Button size="icon" variant="ghost" aria-label="Move up" disabled={i === 0} onClick={() => move(i, -1)}><ArrowUp className="size-4" /></Button>
                  <Button size="icon" variant="ghost" aria-label="Move down" disabled={i === items.length - 1} onClick={() => move(i, 1)}><ArrowDown className="size-4" /></Button>
                  <Button size="icon" variant="ghost" aria-label="Remove" onClick={() => remove(it.id)}><X className="size-4" /></Button>
                </div>
              </li>
            ))}
          </ul>
        )}

        {/* Options */}
        <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-3">
          <label className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">Page size</span>
            <select className={selectCls} value={pageSize} onChange={(e) => setPageSize(e.target.value as PageSize)}>
              <option value="fit">Fit to image</option>
              <option value="a4">A4</option>
              <option value="letter">US Letter</option>
            </select>
          </label>
          {pageSize !== 'fit' && (
            <>
              <label className="flex items-center gap-2 text-sm">
                <span className="text-muted-foreground">Orientation</span>
                <select className={selectCls} value={orientation} onChange={(e) => setOrientation(e.target.value as Orientation)}>
                  <option value="auto">Auto</option>
                  <option value="portrait">Portrait</option>
                  <option value="landscape">Landscape</option>
                </select>
              </label>
              <label className="flex items-center gap-2 text-sm">
                <span className="text-muted-foreground">Margin</span>
                <select className={selectCls} value={margin} onChange={(e) => setMargin(e.target.value as Margin)}>
                  <option value="none">None</option>
                  <option value="small">Small</option>
                  <option value="large">Large</option>
                </select>
              </label>
            </>
          )}
        </div>

        {error && <p className="mt-4 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
        {warning && <p className="mt-4 rounded-md bg-amber-500/10 px-3 py-2 text-sm text-amber-700 dark:text-amber-400">{warning}</p>}

        <Button className="mt-5 w-full" size="lg" onClick={convert} disabled={busy || items.length === 0}>
          {busy ? <><Loader2 className="size-4 animate-spin" /> Converting…</> : <><Download className="size-4" /> Convert {items.length > 0 ? `${items.length} image${items.length > 1 ? 's' : ''} ` : ''}to PDF</>}
        </Button>

        {done && <PdfDone blob={done.blob} name={done.name} secs={done.secs} currentHref="/jpg-to-pdf" fromLabel="JPG to PDF" />}
      </CardContent>
    </Card>
  );
}
