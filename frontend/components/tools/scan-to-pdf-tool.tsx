'use client';

import { useCallback, useRef, useState } from 'react';
import { Camera, Loader2, Download, Trash2, ScanLine, RotateCw, ChevronUp, ChevronDown, Eye, Crop } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { downloadBlob } from '@/lib/download';
import { KeepGoing } from '@/components/app/keep-going';
import { processFrame, pageFromImageData, buildScanPdf, rotatePage, recolourPage, cropPage, uncropPage, type ScanPage, type ScanMode } from '@/lib/scan-to-pdf';
import type { Quad } from '@/lib/doc-scan';
import { DocScanner, type ScannerCapture } from '@/components/tools/doc-scanner';
import { ScanPreview } from '@/components/tools/scan-preview';
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
  // Colour by default, asked for directly. It is also the safe default: colour
  // still flattens the lighting, so a page comes out on white paper either
  // way, and nothing is thrown away that the other two modes would have kept.
  const [mode, setMode] = useState<ScanMode>('colour');
  const [note, setNote] = useState<string | null>(null);
  const [building, setBuilding] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // The camera is no longer a small pane in this page — it is a full-screen
  // scanner (components/tools/doc-scanner.tsx) that detects the document, draws
  // its edge live, and hands back a page that has already been flattened. This
  // component keeps what it always did: the list of pages, reordering, and the
  // PDF at the end.
  const [scanning, setScanning] = useState(false);
  // Which page the full-size preview is showing, or null when it is closed, and
  // whether it should open with the corner handles already live.
  const [previewAt, setPreviewAt] = useState<number | null>(null);
  const [previewCropping, setPreviewCropping] = useState(false);
  const openPreview = useCallback((i: number, crop = false) => {
    setPreviewCropping(crop);
    setPreviewAt(i);
  }, []);

  /**
   * A page whose edges were never found and which has not been cropped by hand
   * is still the whole camera frame — the document plus the desk it was lying
   * on. Saving that to a PDF is almost never what anyone meant.
   *
   * Cropping used to live only inside Preview, so this went unnoticed by anyone
   * who went straight from the shutter to Save PDF, which is the obvious path
   * and the one most people take. The page list now says which pages are in
   * this state and offers the fix on the row itself.
   */
  const needsCrop = (p: ScanPage) => !p.detected && !p.preCrop;
  const uncropped = pages.filter(needsCrop);

  const onScannerCapture = useCallback(({ data, detected }: ScannerCapture) => {
    // Already flattened by the scanner. pageFromImageData applies the same
    // readability pass and nothing else — running it back through processFrame
    // would resample finished pixels for no reason.
    setPages((prev) => [...prev, pageFromImageData(data, mode, detected)]);
    setNote(null);
  }, [mode]);

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
        const page = processFrame(decoded.src, decoded.w, decoded.h, mode);
        setPages((p) => [...p, page]);
      } catch (err) {
        rejected.push(describeImageFailure(f, err));
      } finally {
        decoded?.release();
      }
    }
    // Never drop a file in silence.
    if (rejected.length) setNote(`Couldn’t add ${rejected.join('; ')}`);
  }, [mode]);

  const remove = (id: string) => setPages((p) => p.filter((x) => x.id !== id));
  // Turning a page happens HERE, not in the camera. The scanner has no rotate
  // control any more — turning a live preview was got wrong three times, and
  // the reason is that a moving picture gives you nothing to judge "right"
  // against. A captured page does: tap, look at the thumbnail, done.
  const rotate = useCallback(async (id: string) => {
    const page = pages.find((x) => x.id === id);
    if (!page) return;
    try {
      const turned = await rotatePage(page);
      setPages((p) => p.map((x) => (x.id === id ? turned : x)));
    } catch (err) {
      setNote(err instanceof Error ? err.message : 'Could not turn that page.');
    }
  }, [pages]);
  // Changing the mode re-renders every page you have already taken. A control
  // that only affected the NEXT capture would look broken: you tap it, nothing
  // on screen changes, and the setting has quietly applied to nothing you can
  // see. lib/scan-to-pdf keeps the unprocessed pixels so this can be real.
  const changeMode = useCallback(async (next: ScanMode) => {
    setMode(next);
    setPages((current) => {
      if (!current.length) return current;
      void (async () => {
        try {
          const redone = await Promise.all(current.map((p) => recolourPage(p, next)));
          setPages((live) => live.map((p) => redone.find((r) => r.id === p.id) ?? p));
        } catch {
          setNote('Could not change the mode of the pages already taken.');
        }
      })();
      return current;
    });
  }, []);

  // Hand-placed corners from the preview. Automatic detection cannot find an
  // edge that is not in the photograph, and on white paper against a white
  // surface it genuinely is not there — so this is the way through.
  const crop = useCallback(async (id: string, corners: Quad) => {
    const page = pages.find((x) => x.id === id);
    if (!page) return;
    try {
      const cropped = await cropPage(page, corners, mode);
      setPages((p) => p.map((x) => (x.id === id ? cropped : x)));
    } catch (err) {
      setNote(err instanceof Error ? err.message : 'Could not crop that page.');
    }
  }, [pages, mode]);

  // Put a cropped page back so the corners can be placed again.
  const uncrop = useCallback(async (id: string) => {
    const page = pages.find((x) => x.id === id);
    if (!page) return;
    try {
      const back = await uncropPage(page, mode);
      setPages((p) => p.map((x) => (x.id === id ? back : x)));
    } catch (err) {
      setNote(err instanceof Error ? err.message : 'Could not undo that crop.');
    }
  }, [pages, mode]);

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
          {/* Three modes, the way every scanner has them. It replaced a single
              "Enhance for readability" tickbox, which gave no way to say what
              you wanted and left the owner asking why the scanner was "in
              colour mode" — a fair question to ask of a result that looks like
              a photograph. All three flatten the lighting; they differ only in
              what they do with colour. */}
          <div className="flex flex-wrap items-center justify-between gap-2 border-t p-3">
            <div className="flex items-center gap-1" role="group" aria-label="Scan mode">
              {([
                ['grey', 'Greyscale', 'Like a scanner: white paper, dark text'],
                ['bw', 'Black & white', 'Two tones — crispest text, smallest file'],
                ['colour', 'Colour', 'Keeps stamps, highlighter and coloured forms'],
              ] as const).map(([value, label, why]) => (
                <button
                  key={value}
                  onClick={() => void changeMode(value)}
                  aria-pressed={mode === value}
                  title={why}
                  className={`rounded-lg px-2.5 py-1.5 text-xs font-medium transition ${
                    mode === value
                      ? 'bg-primary text-primary-foreground'
                      : 'border text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
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
            {pages.length === 0 && <p className="py-8 text-center text-xs text-muted-foreground">Captured pages show here — reorder, turn or delete them before you save.</p>}
            {pages.map((p, i) => (
              <div key={p.id} className="group flex items-center gap-2 rounded-lg border bg-muted/20 p-1.5">
                <span className="w-5 text-center text-[11px] font-semibold text-muted-foreground">{i + 1}</span>
                {/* The thumbnail is the obvious thing to tap when you want a
                    better look at it, so make it do that. 44px of page tells
                    you it exists and nothing else. */}
                <button
                  onClick={() => openPreview(i)}
                  aria-label={`Preview page ${i + 1} full size`}
                  className="rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.dataUrl} alt={`Page ${i + 1}`} className={`h-14 w-11 rounded border bg-white object-cover transition hover:brightness-95 ${needsCrop(p) ? 'border-amber-500' : ''}`} />
                </button>
                {/* Said on the row, where the page is, rather than only behind
                    a button someone may never press. */}
                {needsCrop(p) && (
                  <button
                    onClick={() => openPreview(i, true)}
                    className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold leading-tight text-amber-700 hover:bg-amber-500/25 dark:text-amber-400"
                  >
                    Not cropped
                  </button>
                )}
                <div className="ml-auto flex items-center gap-0.5">
                  {/* Crop is on every page, not just the ones we flagged: the
                      detector can find AN edge and still find the wrong one,
                      and there was no way to fix that without opening Preview
                      and hunting for the control. */}
                  <button onClick={() => openPreview(i, true)} className={`rounded p-1 hover:text-foreground ${needsCrop(p) ? 'text-amber-600 dark:text-amber-400' : 'text-muted-foreground'}`} aria-label={`Crop page ${i + 1}`}><Crop className="size-3.5" /></button>
                  {/* Chevrons for reorder, a rotate glyph for rotate. These
                      were all the same RotateCw icon before, which made "move
                      up" and "turn the page" look like the same control. */}
                  <button onClick={() => move(p.id, -1)} disabled={i === 0} className="rounded p-1 text-muted-foreground hover:text-foreground disabled:opacity-30" aria-label={`Move page ${i + 1} up`}><ChevronUp className="size-4" /></button>
                  <button onClick={() => move(p.id, 1)} disabled={i === pages.length - 1} className="rounded p-1 text-muted-foreground hover:text-foreground disabled:opacity-30" aria-label={`Move page ${i + 1} down`}><ChevronDown className="size-4" /></button>
                  <button onClick={() => void rotate(p.id)} className="rounded p-1 text-muted-foreground hover:text-foreground" aria-label={`Turn page ${i + 1} a quarter turn`}><RotateCw className="size-3.5" /></button>
                  <button onClick={() => remove(p.id)} className="rounded p-1 text-muted-foreground hover:text-red-600" aria-label={`Delete page ${i + 1}`}><Trash2 className="size-3.5" /></button>
                </div>
              </div>
            ))}
          </div>
          {/* Preview sits ABOVE Save and is not a filled button: checking the
              scan is the step before saving it, and there is one filled button
              on this screen. */}
          {/* The one thing on this screen worth interrupting for. Everything
              else here is a preference; this is a page that will go into the
              PDF with a desk around it. It names the count, and the button
              lands on the first offender with the handles already up. */}
          {uncropped.length > 0 && (
            <div className="mt-3 rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-[13px] leading-relaxed">
              <p className="text-amber-700 dark:text-amber-400">
                <b>{uncropped.length === 1 ? 'One page has no edges found' : `${uncropped.length} pages have no edges found`}</b>
                {' — '}
                {uncropped.length === 1 ? 'it is' : 'they are'} still the whole picture, desk and all.
              </p>
              <button
                onClick={() => openPreview(pages.indexOf(uncropped[0]), true)}
                className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg bg-amber-500/20 py-2 text-sm font-semibold text-amber-800 hover:bg-amber-500/30 active:scale-[0.99] dark:text-amber-300"
              >
                <Crop className="size-4" /> Crop {uncropped.length === 1 ? 'it' : 'them'} now
              </button>
            </div>
          )}
          {pages.length > 0 && (
            <button
              onClick={() => openPreview(0)}
              className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-xl border py-2.5 text-sm font-medium hover:bg-muted/50 active:scale-[0.99]"
            >
              <Eye className="size-4" />
              Preview {pages.length === 1 ? 'the page' : `all ${pages.length} pages`}
            </button>
          )}
          <Button onClick={() => void build()} disabled={!pages.length || building} className="mt-2 w-full bg-primary text-primary-foreground">
            {building ? <Loader2 className="mr-1.5 size-4 animate-spin" /> : <Download className="mr-1.5 size-4" />}
            {building ? 'Building…' : `Save PDF${pages.length ? ` · ${pages.length} page${pages.length === 1 ? '' : 's'}` : ''}`}
          </Button>
        </div>
      </div>

      <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-3.5 text-[13px] leading-relaxed text-foreground">
        <ScanLine className="mt-0.5 size-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
        <p><b>Scanned entirely on your device.</b> The camera stream and every page stay in your browser — nothing is uploaded. Your ID, your signature, your receipts never touch a server.</p>
      </div>
      {previewAt !== null && (
        <ScanPreview
          pages={pages}
          index={Math.min(previewAt, Math.max(0, pages.length - 1))}
          onIndex={setPreviewAt}
          onRotate={(id) => void rotate(id)}
          onDelete={(id) => remove(id)}
          onCrop={crop}
          onUncrop={uncrop}
          startCropping={previewCropping}
          onClose={() => setPreviewAt(null)}
        />
      )}
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
