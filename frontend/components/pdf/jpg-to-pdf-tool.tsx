'use client';

import { useEffect, useRef, useState } from 'react';
import { Upload, X, ArrowUp, ArrowDown, Download, Loader2, ImageIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

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
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // revoke all preview URLs on unmount
  useEffect(() => () => { items.forEach((it) => URL.revokeObjectURL(it.url)); }, [items]);

  function isImage(f: File) {
    return f.type === 'image/jpeg' || f.type === 'image/png' || /\.(jpe?g|png)$/i.test(f.name);
  }

  function addFiles(files: FileList | null) {
    if (!files) return;
    const imgs = Array.from(files).filter(isImage);
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
    try {
      const { PDFDocument } = await import('pdf-lib'); // load engine only when needed
      const pdf = await PDFDocument.create();

      for (const { file } of items) {
        const bytes = await file.arrayBuffer();
        const isPng = file.type === 'image/png' || /\.png$/i.test(file.name);
        const img = isPng ? await pdf.embedPng(bytes) : await pdf.embedJpg(bytes);

        if (pageSize === 'fit') {
          const page = pdf.addPage([img.width, img.height]);
          page.drawImage(img, { x: 0, y: 0, width: img.width, height: img.height });
          continue;
        }

        let [pw, ph] = SIZES[pageSize];
        const landscape =
          orientation === 'landscape' || (orientation === 'auto' && img.width > img.height);
        if (landscape) [pw, ph] = [ph, pw];

        const m = MARGINS[margin];
        const maxW = pw - 2 * m;
        const maxH = ph - 2 * m;
        const scale = Math.min(maxW / img.width, maxH / img.height);
        const w = img.width * scale;
        const h = img.height * scale;
        const page = pdf.addPage([pw, ph]);
        page.drawImage(img, { x: (pw - w) / 2, y: (ph - h) / 2, width: w, height: h });
      }

      const out = await pdf.save();
      const blob = new Blob([new Uint8Array(out)], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'converted.pdf';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e instanceof Error ? `Could not convert: ${e.message}` : 'Could not convert the images.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardContent className="p-5">
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => { e.preventDefault(); addFiles(e.dataTransfer.files); }}
          onClick={() => inputRef.current?.click()}
          className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-border p-8 text-center transition-colors hover:border-primary/50 hover:bg-accent/40"
        >
          <Upload className="size-7 text-muted-foreground" />
          <p className="mt-2 text-sm font-medium">Drop JPG or PNG images here, or click to choose</p>
          <p className="text-xs text-muted-foreground">Add one or more — drag to set the order</p>
          <input ref={inputRef} type="file" accept="image/jpeg,image/png,.jpg,.jpeg,.png" multiple className="hidden" onChange={(e) => addFiles(e.target.files)} />
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

        <Button className="mt-5 w-full" size="lg" onClick={convert} disabled={busy || items.length === 0}>
          {busy ? <><Loader2 className="size-4 animate-spin" /> Converting…</> : <><Download className="size-4" /> Convert {items.length > 0 ? `${items.length} image${items.length > 1 ? 's' : ''} ` : ''}to PDF</>}
        </Button>
      </CardContent>
    </Card>
  );
}
