'use client';

import { useCallback, useRef, useState } from 'react';
import { Camera, Loader2, Download, Trash2, ScanLine, RotateCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { downloadBlob } from '@/lib/download';
import { KeepGoing } from '@/components/app/keep-going';
import { processFrame, pageFromImageData, buildScanPdf, type ScanPage } from '@/lib/scan-to-pdf';
import { DocScanner, type ScannerCapture } from '@/components/tools/doc-scanner';
import { rasterize, describeImageFailure, isHeic, readPickedFile, toSource } from '@/lib/image-for-pdf';

// Decode a picked file to something canvas can draw. Goes through the shared
// image decoder so a HEIC straight off an iPhone works here too, then hands the
// result to processFrame as a plain <img>.
async function decodeImage(file: File): Promise<{ src: CanvasImageSource; w: number; h: number; release: () => void }> {
  // Read the bytes first, while the picker's handle is certainly still alive.
  const source = toSource(file, await readPickedFile(file));
  const asBlob = new Blob([source.bytes], { type: source.type || 'image/jpeg' });

  if (!isHeic(source) && typeof createImageBitmap === 'function') {
    try {
      const bmp = await createImageBitmap(asBlob);
      return { src: bmp, w: bmp.width, h: bmp.height, release: () => bmp.close() };
    } catch { /* fall through */ }
  }
  // A HEIC goes through libheif and comes back as JPEG bytes. Anything else the
  // <img> tag gets a fair try at directly — re-encoding it would not help,
  // since both paths use the same browser codecs.
  let blob: Blob = asBlob;
  if (isHeic(source)) {
    const { bytes } = await rasterize(source);
    blob = new Blob([bytes], { type: 'image/jpeg' });
  }
  const url = URL.createObjectURL(blob);
  try {
    const el = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error('This browser cannot open that image format.'));
      i.src = url;
    });
    return { src: el, w: el.naturalWidth || el.width, h: el.naturalHeight || el.height, release: () => URL.revokeObjectURL(url) };
  } catch (e) {
    URL.revokeObjectURL(url);
    throw e;
  }
}

export function ScanToPdfTool() {
  const [pages, setPages] = useState<ScanPage[]>([]);
  const [enhance, setEnhance] = useState(true);
  const [note, setNote] = useState<string | null>(null);
  const [building, setBuilding] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // The camera is no longer a small pane in this page — it is a full-screen
  // scanner (components/tools/doc-scanner.tsx) that detects the document, draws
  // its edge live, and hands back a page that has already been flattened. This
  // component keeps what it always did: the list of pages, reordering, and the
  // PDF at the end.
  const [scanning, setScanning] = useState(false);

  const onScannerCapture = useCallback(({ data }: ScannerCapture) => {
    // Already flattened by the scanner. pageFromImageData applies the same
    // readability pass and nothing else — running it back through processFrame
    // would resample finished pixels for no reason.
    setPages((prev) => [...prev, pageFromImageData(data, enhance)]);
    setNote(null);
  }, [enhance]);

  const addPhotos = useCallback(async (files: FileList | null) => {
    if (!files?.length) return;
    setNote(null);
    const rejected: string[] = [];
    for (const f of Array.from(files)) {
      let decoded: Awaited<ReturnType<typeof decodeImage>> | null = null;
      try {
        decoded = await decodeImage(f);
        // Build the page BEFORE queueing the state update. React can run an
        // updater function later (or twice), by which point the decoded source
        // has been released — that threw during render and took the whole page
        // down with "a client-side exception has occurred".
        const page = processFrame(decoded.src, decoded.w, decoded.h, enhance);
        setPages((p) => [...p, page]);
      } catch (err) {
        rejected.push(describeImageFailure(f, err));
      } finally {
        decoded?.release();
      }
    }
    // Never drop a file in silence.
    if (rejected.length) setNote(`Couldn’t add ${rejected.join('; ')}`);
  }, [enhance]);

  const remove = (id: string) => setPages((p) => p.filter((x) => x.id !== id));
  const move = (id: string, dir: -1 | 1) => setPages((p) => {
    const i = p.findIndex((x) => x.id === id); const j = i + dir;
    if (i < 0 || j < 0 || j >= p.length) return p;
    const n = [...p]; [n[i], n[j]] = [n[j], n[i]]; return n;
  });

  const build = useCallback(async () => {
    if (!pages.length || building) return;
    setBuilding(true);
    try {
      const blob = await buildScanPdf(pages);
      const stamp = new Date().toISOString().slice(0, 10);
      downloadBlob(blob, `scan-${stamp}.pdf`);
    } finally { setBuilding(false); }
  }, [pages, building]);

  return (
    <div>
      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        {/* how pages get in */}
        <div className="overflow-hidden rounded-2xl border bg-card shadow-soft">
          <div className="flex flex-col items-center gap-4 px-6 py-10 text-center">
            <span className="flex size-14 items-center justify-center rounded-2xl bg-primary/10">
              <ScanLine className="size-7 text-primary" />
            </span>
            <div>
              <p className="text-base font-semibold">Scan a document</p>
              <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
                Full-screen camera that finds the edges of the page, straightens it, and cuts away whatever it is lying on.
              </p>
            </div>
            <Button size="lg" onClick={() => setScanning(true)} className="bg-primary text-primary-foreground">
              <Camera className="mr-1.5 size-4" /> Open scanner
            </Button>
            <button
              onClick={() => fileRef.current?.click()}
              className="text-sm font-medium text-primary underline underline-offset-4"
            >
              or add photos you already took
            </button>
            {/* no `capture` attribute — it forces the camera app open on Android
                and hides the gallery, which is the opposite of "Add photos". */}
            <input ref={fileRef} type="file" accept="image/*" multiple aria-label="Choose an image file" className="dd-file-input" onChange={(e) => { void addPhotos(e.target.files); e.currentTarget.value = ''; }} />
          </div>
          <div className="flex items-center justify-between gap-2 border-t p-3">
            <label className="flex cursor-pointer items-center gap-2 text-xs font-medium">
              <input type="checkbox" checked={enhance} onChange={(e) => setEnhance(e.target.checked)} className="size-4 accent-[hsl(var(--primary))]" />
              Enhance for readability
            </label>
            <span className="text-[11px] text-muted-foreground">{pages.length} captured</span>
          </div>
          {note && (
            <p className="border-t bg-amber-500/10 px-3 py-2.5 text-xs leading-relaxed text-amber-700 dark:text-amber-400">{note}</p>
          )}
        </div>

        {/* pages + build */}
        <div className="flex flex-col rounded-2xl border bg-card p-4 shadow-soft">
          <div className="flex items-center justify-between">
            <b className="text-sm">Pages</b>
            <span className="rounded-full border bg-muted/40 px-2 py-0.5 text-[11px] text-muted-foreground">{pages.length}</span>
          </div>
          <div className="mt-3 flex-1 space-y-2 overflow-auto" style={{ maxHeight: 340 }}>
            {pages.length === 0 && <p className="py-8 text-center text-xs text-muted-foreground">Captured pages show here — reorder or delete before you save.</p>}
            {pages.map((p, i) => (
              <div key={p.id} className="group flex items-center gap-2 rounded-lg border bg-muted/20 p-1.5">
                <span className="w-5 text-center text-[11px] font-semibold text-muted-foreground">{i + 1}</span>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.dataUrl} alt={`Page ${i + 1}`} className="h-14 w-11 rounded border bg-white object-cover" />
                <div className="ml-auto flex items-center gap-0.5">
                  <button onClick={() => move(p.id, -1)} disabled={i === 0} className="rounded p-1 text-muted-foreground hover:text-foreground disabled:opacity-30" aria-label="Move up"><RotateCw className="size-3.5 -rotate-90" /></button>
                  <button onClick={() => move(p.id, 1)} disabled={i === pages.length - 1} className="rounded p-1 text-muted-foreground hover:text-foreground disabled:opacity-30" aria-label="Move down"><RotateCw className="size-3.5 rotate-90" /></button>
                  <button onClick={() => remove(p.id)} className="rounded p-1 text-muted-foreground hover:text-red-600" aria-label="Delete page"><Trash2 className="size-3.5" /></button>
                </div>
              </div>
            ))}
          </div>
          <Button onClick={() => void build()} disabled={!pages.length || building} className="mt-3 w-full bg-primary text-primary-foreground">
            {building ? <Loader2 className="mr-1.5 size-4 animate-spin" /> : <Download className="mr-1.5 size-4" />}
            {building ? 'Building…' : `Save PDF${pages.length ? ` · ${pages.length} page${pages.length === 1 ? '' : 's'}` : ''}`}
          </Button>
        </div>
      </div>

      <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-3.5 text-[13px] leading-relaxed text-foreground">
        <ScanLine className="mt-0.5 size-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
        <p><b>Scanned entirely on your device.</b> The camera stream and every page stay in your browser — nothing is uploaded. Your ID, your signature, your receipts never touch a server.</p>
      </div>
      {scanning && (
        <DocScanner
          onCapture={onScannerCapture}
          onClose={() => setScanning(false)}
          pageCount={pages.length}
          lastThumb={pages.length ? pages[pages.length - 1].dataUrl : null}
        />
      )}
      <KeepGoing exclude="/scan-to-pdf" title="Do more, privately" />
    </div>
  );
}
