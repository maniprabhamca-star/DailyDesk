'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Camera, ImagePlus, Loader2, Download, Trash2, ScanLine, RotateCw, CameraOff, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { downloadBlob } from '@/lib/download';
import { KeepGoing } from '@/components/app/keep-going';
import { processFrame, buildScanPdf, type ScanPage } from '@/lib/scan-to-pdf';
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
  const [camOn, setCamOn] = useState(false);
  const [camError, setCamError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [building, setBuilding] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // The preview box takes its shape from the CAMERA, not from a guess.
  //
  // It used to be a hard `aspect-[4/3]` with `object-contain` inside it. Hold a
  // phone upright — which is how everybody photographs a document — and the
  // camera hands back a portrait frame, so a portrait video was letterboxed into
  // a landscape box: two fat black bars and the page itself shrunk to the middle
  // third of the screen. The owner's words were "literally very small and not
  // able to capture", and that is exactly what it was.
  const [camAspect, setCamAspect] = useState<number | null>(null);

  // Capture feedback. Taking a photo used to change nothing you could see: no
  // flash, no sound, no count moving in your eyeline — the page silently joined
  // a list further down the document that you had to go and scroll to. So you
  // could not tell a successful capture from a dead button.
  const [flash, setFlash] = useState(false);
  const [justAdded, setJustAdded] = useState<ScanPage | null>(null);
  const addedTimer = useRef<number | null>(null);
  useEffect(() => () => { if (addedTimer.current) window.clearTimeout(addedTimer.current); }, []);

  const stopCam = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setCamOn(false);
  }, []);

  useEffect(() => () => stopCam(), [stopCam]);

  // The <video> is always mounted (just hidden when off), so the stream can be
  // attached here. Attaching inside startCam used to run before React had
  // rendered the element, leaving a live camera pointed at nothing.
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    if (camOn && streamRef.current) {
      v.srcObject = streamRef.current;
      void v.play().catch(() => {});
    } else {
      v.srcObject = null;
    }
  }, [camOn]);

  const startCam = useCallback(async () => {
    setCamError(null);
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setCamError(
        typeof window !== 'undefined' && window.isSecureContext === false
          ? 'Browsers only allow the camera on secure (https) pages. Use “Add photos” to pick images instead.'
          : 'This browser doesn’t offer camera capture. Use “Add photos” to pick images instead (works on any device).',
      );
      return;
    }
    try {
      // Ask for a frame shaped like the screen the person is holding.
      //
      // This asked for 2560×1440 unconditionally, which is a LANDSCAPE request.
      // Phones are held upright to photograph a document, so the browser handed
      // back a wide frame that then had to fit a narrow column — a 356px-wide
      // strip about 200px tall on a normal phone, roughly a fifth of the screen,
      // with the document a postage stamp in the middle of it. That is the
      // "camera is literally very small" report, and no amount of CSS fixes it,
      // because the pixels genuinely were not there.
      //
      // `ideal` rather than `exact` throughout: a camera that cannot do this
      // gives its closest match instead of failing, and a laptop webcam that is
      // only ever landscape keeps working exactly as before.
      const portrait = typeof window !== 'undefined' && window.innerHeight > window.innerWidth;
      const long = { ideal: 2560 };
      const short = { ideal: 1440 };
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
          width: portrait ? short : long,
          height: portrait ? long : short,
        },
        audio: false,
      });
      streamRef.current = stream;
      setCamOn(true);
    } catch (e) {
      // Say which of these actually happened — "no camera available" was wrong
      // for the common case, which is a blocked permission.
      const name = e instanceof Error ? e.name : '';
      setCamError(
        name === 'NotAllowedError' || name === 'SecurityError'
          ? 'Camera access is blocked for this site. Tap the padlock next to the address → Permissions → allow Camera, then try again — or use “Add photos”.'
          : name === 'NotFoundError' || name === 'OverconstrainedError'
            ? 'No camera found on this device — use “Add photos” to pick images instead.'
            : name === 'NotReadableError' || name === 'AbortError'
              ? 'Another app is already using the camera. Close it and try again, or use “Add photos”.'
              : 'Couldn’t start the camera — use “Add photos” to pick images instead (works on any device).',
      );
    }
  }, []);

  const capture = useCallback(() => {
    const v = videoRef.current;
    // `return` on its own was a silent no-op: press the shutter before the
    // camera has delivered its first frame and the button did nothing, said
    // nothing, and left the page count on 0. Indistinguishable from a broken
    // app, and reported as exactly that.
    if (!v || !v.videoWidth) {
      setNote('The camera hasn’t sent a picture yet — give it a second and press the button again.');
      return;
    }
    setNote(null);
    const page = processFrame(v, v.videoWidth, v.videoHeight, enhance);
    setPages((p) => [...p, page]);

    // Say something happened, three ways, because one is easy to miss:
    // a shutter flash over the viewfinder, the page count moving, and a
    // thumbnail of what was just captured parked next to the shutter — the
    // same reassurance a real camera app gives. Without these the only proof
    // was a list below the fold.
    setFlash(true);
    window.setTimeout(() => setFlash(false), 180);
    setJustAdded(page);
    if (addedTimer.current) window.clearTimeout(addedTimer.current);
    addedTimer.current = window.setTimeout(() => setJustAdded(null), 2600);

    // A phone vibrating is the confirmation you feel without looking, which
    // matters when your eyes are on the document you are photographing.
    try { navigator.vibrate?.(35); } catch { /* not supported, no matter */ }
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
        {/* capture surface */}
        <div className="overflow-hidden rounded-2xl border bg-card shadow-soft">
          {/* Black and 4:3 only while the camera is running — otherwise this was
              a huge empty black rectangle before anyone had granted anything. */}
          <div
            className={camOn ? 'relative mx-auto w-full bg-black' : 'relative'}
            style={camOn ? {
              // The camera's own aspect ratio, so there is nothing to letterbox.
              aspectRatio: camAspect ? String(camAspect) : '3 / 4',
              // Tall enough to actually read what you are pointing at, but never
              // taller than the screen — the shutter has to stay reachable
              // without scrolling, which was the third complaint.
              maxHeight: 'min(72vh, 720px)',
            } : undefined}
          >
            {/* always mounted so the stream has something to attach to */}
            <video
              ref={videoRef}
              playsInline
              muted
              autoPlay
              onLoadedMetadata={(e) => {
                const el = e.currentTarget;
                if (el.videoWidth && el.videoHeight) setCamAspect(el.videoWidth / el.videoHeight);
              }}
              className={`size-full object-contain ${camOn ? '' : 'hidden'}`}
            />
            {/* Shutter flash. Deliberately white and brief — long enough to
                register, short enough not to hide the next frame. */}
            {flash && <div aria-hidden className="pointer-events-none absolute inset-0 bg-white/80" />}
            {!camOn && (
              <div className="flex flex-col items-center justify-center gap-3 px-6 py-12 text-center">
                <ScanLine className="size-10 text-muted-foreground/70" />
                <p className="max-w-sm text-sm text-muted-foreground">Point your camera at a document, or add photos you already took.</p>
                {camError && <p className="flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400"><CameraOff className="size-3.5" /> {camError}</p>}
              </div>
            )}
            {/* What you just took, and how many you have — both ON the
                viewfinder. Previously the only evidence a capture had worked
                lived in a panel below the fold, so the honest answer to "did
                that work?" was "scroll down and find out". */}
            {/* In words, across the top, where you are already looking.
                A thumbnail and a number were not enough — "there is no message
                as page captured or scanned or nothing" is the whole review. */}
            {camOn && justAdded && (
              <div className="pointer-events-none absolute inset-x-0 top-0 flex justify-center p-3">
                <span className="flex items-center gap-2 rounded-full bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-lg">
                  <Check className="size-4" strokeWidth={3} />
                  Page {pages.length} captured
                </span>
              </div>
            )}
            {camOn && pages.length > 0 && (
              <div className="pointer-events-none absolute bottom-4 left-4 flex items-center gap-2">
                {justAdded && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={justAdded.dataUrl}
                    alt=""
                    className="size-14 rounded-lg border-2 border-white/90 object-cover shadow-lg"
                  />
                )}
                <span className="rounded-full bg-black/60 px-2.5 py-1 text-xs font-semibold text-white backdrop-blur">
                  {pages.length} {pages.length === 1 ? 'page' : 'pages'}
                </span>
              </div>
            )}
            {/* Live region: the count changing is the announcement for anyone
                who cannot see the flash or the thumbnail. */}
            <span className="sr-only" role="status" aria-live="polite">
              {pages.length === 0 ? 'No pages captured yet' : `${pages.length} ${pages.length === 1 ? 'page' : 'pages'} captured`}
            </span>
            {camOn && (
              <button onClick={capture} aria-label="Capture page"
                className="absolute bottom-4 left-1/2 flex size-16 -translate-x-1/2 items-center justify-center rounded-full border-4 border-white bg-white/20 backdrop-blur transition active:scale-95">
                <span className="size-11 rounded-full bg-white" />
              </button>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2 border-t p-3">
            {camOn ? (
              <Button size="sm" variant="outline" onClick={stopCam}><CameraOff className="mr-1 size-4" /> Stop camera</Button>
            ) : (
              <Button size="sm" onClick={() => void startCam()} className="bg-primary text-primary-foreground"><Camera className="mr-1 size-4" /> Use camera</Button>
            )}
            <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()}><ImagePlus className="mr-1 size-4" /> Add photos</Button>
            {/* no `capture` here — it forces the camera app open on Android and
                hides the gallery, which is the opposite of "Add photos". */}
            <input ref={fileRef} type="file" accept="image/*" multiple aria-label="Choose an image file" className="dd-file-input" onChange={(e) => { void addPhotos(e.target.files); e.target.value = ''; }} />
            <label className="ml-auto flex cursor-pointer items-center gap-2 text-xs font-medium">
              <input type="checkbox" checked={enhance} onChange={(e) => setEnhance(e.target.checked)} className="size-4 accent-[hsl(var(--primary))]" />
              Enhance for readability
            </label>
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
      <KeepGoing exclude="/scan-to-pdf" title="Do more, privately" />
    </div>
  );
}
