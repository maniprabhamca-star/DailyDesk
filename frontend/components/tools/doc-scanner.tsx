'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { X, Check, Zap, ZapOff, Loader2, RotateCw } from 'lucide-react';
import { detectDocument, flattenDocument, quadStability, coverTransform, type Quad } from '@/lib/doc-scan';

/**
 * Full-screen document scanner.
 *
 * The previous version was a small camera preview embedded in the page with a
 * shutter button, and the owner's verdict on it was fair: "the view of the
 * camera is not good... I need the native camera full screen to scan the
 * document and during the scanning it should automatically detect the document
 * and highlight". So this takes over the whole viewport, draws the detected
 * page edge live while you frame it, and captures the DOCUMENT rather than the
 * photograph — perspective removed, desk removed.
 *
 * ── How it hangs together ───────────────────────────────────────────────────
 *   • A detection loop samples the video into a small offscreen canvas and asks
 *     lib/doc-scan for the page's four corners. Throttled, because 60fps of
 *     edge detection would heat a phone for no benefit — the page is not moving
 *     that fast.
 *   • An overlay canvas draws those corners over the video.
 *   • Capture takes the FULL resolution frame and flattens it through the same
 *     corners, so the preview is a guide and the output is the real thing.
 *
 * ── One coordinate space, on purpose ────────────────────────────────────────
 * The <video> is hidden. Every frame is painted into a canvas through
 * coverTransform(), and the preview, the detector and the capture all read that
 * same upright, screen-shaped picture. Earlier versions kept three spaces —
 * detector pixels, sensor pixels, and CSS pixels — and converting between them
 * is where this kind of code goes wrong: a highlight drawn in one space and
 * captured in another floats next to the document instead of round it.
 *
 * It also fixes the orientation outright. Phone cameras hand back a LANDSCAPE
 * frame however the phone is held and whatever the constraints ask for, so
 * fitting it to a portrait screen letterboxed it into a band ("the scanner is
 * opening in horizontal mode"), and cropping it to fill cut the page's own
 * edges off. coverTransform rotates it upright first, which is what a native
 * scanner does, and then covering costs nothing.
 */

/** Detector input width. Bigger is not better — lib/doc-scan downsamples anyway. */
const DETECT_WIDTH = 480;
/** Milliseconds between detection passes. ~12/sec is smooth to the eye and cheap. */
const DETECT_INTERVAL = 80;
/** Consecutive steady frames before an automatic capture fires. */
const STEADY_FRAMES_NEEDED = 8;
/** Below this, the page is still being moved. */
const STEADY_THRESHOLD = 0.82;

export type ScannerCapture = { data: ImageData; auto: boolean };

export function DocScanner({
  onCapture,
  onClose,
  pageCount,
  lastThumb,
}: {
  onCapture: (c: ScannerCapture) => void;
  onClose: () => void;
  pageCount: number;
  lastThumb: string | null;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const detectCanvas = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [auto, setAuto] = useState(true);
  const [flash, setFlash] = useState(false);
  const [hint, setHint] = useState('Point the camera at your document');
  // Which way up the camera's picture needs turning, in quarter turns.
  //
  // Not detected, because it cannot be: some browsers hand over the sensor's
  // own orientation and some correct it first, and the same landscape frame
  // means opposite things on the two. Whoever is holding the phone can see
  // which way up it is, so they get the control — and it is remembered, because
  // a device that needs it will need it every time.
  const [turns, setTurns] = useState(0);
  const turnsRef = useRef(0);
  useEffect(() => { turnsRef.current = turns; }, [turns]);
  useEffect(() => {
    try {
      const saved = Number(localStorage.getItem('dd-scan-turns'));
      if (Number.isFinite(saved) && saved >= 0 && saved < 4) setTurns(saved);
    } catch { /* private mode: default to none */ }
  }, []);
  const turn = useCallback(() => {
    setTurns((n) => {
      const next = (n + 1) % 4;
      try { localStorage.setItem('dd-scan-turns', String(next)); } catch { /* ignore */ }
      return next;
    });
  }, []);

  // Refs, not state: the detection loop reads these every frame and re-running
  // it on every React render would defeat the throttle entirely.
  const quadRef = useRef<Quad | null>(null);
  const prevQuadRef = useRef<Quad | null>(null);
  const steadyRef = useRef(0);
  const autoRef = useRef(auto);
  const busyRef = useRef(false);
  useEffect(() => { autoRef.current = auto; }, [auto]);

  /**
   * Auto-capture fires ONCE per document, then disarms until the scene changes.
   *
   * Without this it re-fires for as long as a page sits in frame: measured at
   * four captures in three seconds against a stationary document, which is four
   * near-identical pages to delete. A page held still is the success condition,
   * so "still steady" must not keep counting as "capture again".
   *
   * Re-arming needs evidence that a NEW page is being presented: either the
   * document leaves the frame for a moment (the natural motion of putting one
   * sheet down and picking up the next), or the detected quad jumps far enough
   * that it cannot be the same sheet.
   */
  const armedRef = useRef(true);
  const lostFramesRef = useRef(0);
  const capturedQuadRef = useRef<Quad | null>(null);

  // ── camera ────────────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
        setError('This browser doesn’t offer camera capture. Close this and use “Add photos” instead.');
        return;
      }
      try {
        // Ask for a frame shaped like the screen being held — a landscape
        // request on an upright phone is what made the old preview a letterboxed
        // strip. And ask for plenty of pixels: this is the image that becomes
        // the page, so detail here is detail in the PDF.
        // aspectRatio as well as width/height, because width/height alone get
        // ignored. Asking for 1440x2560 on an Android phone reliably returns a
        // landscape frame anyway; aspectRatio is the constraint browsers tend to
        // honour, and a stream already shaped like the screen needs no cropping
        // and no turning. When it is ignored too, coverTransform still fills the
        // screen and the rotate control is there for the rest.
        const portrait = window.innerHeight > window.innerWidth;
        const ratio = portrait
          ? window.innerWidth / window.innerHeight
          : window.innerWidth / window.innerHeight;
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: 'environment' },
            aspectRatio: { ideal: ratio },
            width: portrait ? { ideal: 1440 } : { ideal: 2560 },
            height: portrait ? { ideal: 2560 } : { ideal: 1440 },
          },
          audio: false,
        });
        if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return; }
        streamRef.current = stream;
        const v = videoRef.current;
        if (v) { v.srcObject = stream; await v.play().catch(() => {}); }
        setReady(true);
      } catch (e) {
        const name = e instanceof Error ? e.name : '';
        setError(
          name === 'NotAllowedError' || name === 'SecurityError'
            ? 'Camera access is blocked for this site. Tap the padlock next to the address → Permissions → allow Camera.'
            : name === 'NotFoundError' || name === 'OverconstrainedError'
              ? 'No camera found on this device.'
              : name === 'NotReadableError' || name === 'AbortError'
                ? 'Another app is using the camera. Close it and try again.'
                : 'Couldn’t start the camera.',
        );
      }
    })();
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, []);

  // Escape closes, and the page behind must not scroll while this is over it.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  /**
   * Paint one camera frame, upright and covering, into a canvas.
   *
   * The single place the sensor's orientation is dealt with. Everything
   * downstream — what is shown, what is detected, what is captured — reads the
   * result of this, so they cannot disagree.
   */
  const paintFrame = useCallback((ctx: CanvasRenderingContext2D, outW: number, outH: number) => {
    const v = videoRef.current;
    if (!v || !v.videoWidth) return false;
    const { rotate, drawW, drawH } = coverTransform(v.videoWidth, v.videoHeight, outW, outH, turnsRef.current);
    ctx.save();
    ctx.translate(outW / 2, outH / 2);
    if (rotate) ctx.rotate(rotate);
    ctx.drawImage(v, -drawW / 2, -drawH / 2, drawW, drawH);
    ctx.restore();
    return true;
  }, []);

  const capture = useCallback((isAuto: boolean) => {
    const v = videoRef.current;
    if (!v || !v.videoWidth || busyRef.current) return;
    busyRef.current = true;
    try {
      // Capture the SAME picture that is on screen — upright, covered, cropped
      // identically — just at far higher resolution. Sampling the raw sensor
      // frame instead would capture a different field of view from the one that
      // was framed, and the corners would be in the wrong space.
      const overlay = overlayRef.current;
      const box = overlay?.getBoundingClientRect();
      if (!box || !box.width || !box.height) return;
      const LONG_EDGE = 2000;
      const k = LONG_EDGE / Math.max(box.width, box.height);
      const outW = Math.max(1, Math.round(box.width * k));
      const outH = Math.max(1, Math.round(box.height * k));

      const full = document.createElement('canvas');
      full.width = outW; full.height = outH;
      const fctx = full.getContext('2d', { willReadFrequently: true });
      if (!fctx) return;
      if (!paintFrame(fctx, outW, outH)) return;
      const frame = fctx.getImageData(0, 0, outW, outH);

      const q = quadRef.current;
      let out: ImageData | null = null;
      if (q) {
        // Detector space -> capture space. Same picture, different scale.
        const dc = detectCanvas.current;
        const sx = dc ? outW / dc.width : 1;
        const sy = dc ? outH / dc.height : 1;
        const scaled = q.map((pt) => ({ x: pt.x * sx, y: pt.y * sy })) as Quad;
        out = flattenDocument(frame, scaled);
      }
      // No document found is not a reason to refuse the shot — someone pressing
      // the shutter wants the picture. They get the whole frame instead, which
      // is what the tool did before this existed.
      onCapture({ data: out ?? frame, auto: isAuto });

      full.width = full.height = 0;
      setFlash(true);
      window.setTimeout(() => setFlash(false), 160);
      try { navigator.vibrate?.(isAuto ? [20, 40, 20] : 35); } catch { /* not supported */ }
      steadyRef.current = 0;
      capturedQuadRef.current = quadRef.current;
      if (isAuto) armedRef.current = false;
    } finally {
      // A short bar on re-firing, or auto-capture would take a burst of near
      // identical pages while the page is still sitting steady in frame.
      window.setTimeout(() => { busyRef.current = false; }, 1200);
    }
  }, [onCapture, paintFrame]);

  // ── detection loop ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!ready) return;
    let raf = 0;
    let last = 0;

    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      if (now - last < DETECT_INTERVAL) return;
      last = now;

      const v = videoRef.current;
      const overlay = overlayRef.current;
      if (!v || !v.videoWidth || !overlay) return;

      const octx = overlay.getContext('2d');
      if (!octx) return;

      // The visible surface, in CSS pixels and at device resolution.
      const box = overlay.getBoundingClientRect();
      const cssW = box.width, cssH = box.height;
      if (!cssW || !cssH) return;
      const dpr = window.devicePixelRatio || 1;
      const bw = Math.round(cssW * dpr), bh = Math.round(cssH * dpr);
      if (overlay.width !== bw || overlay.height !== bh) { overlay.width = bw; overlay.height = bh; }
      octx.setTransform(dpr, 0, 0, dpr, 0, 0);
      octx.clearRect(0, 0, cssW, cssH);
      if (!paintFrame(octx, cssW, cssH)) return;

      // Detect on a small copy of exactly what is on screen — upright, covered,
      // cropped the same way. What you see is what is detected.
      if (!detectCanvas.current) detectCanvas.current = document.createElement('canvas');
      const dc = detectCanvas.current;
      const dw = Math.min(DETECT_WIDTH, Math.round(cssW));
      const dh = Math.max(1, Math.round((cssH / cssW) * dw));
      if (dc.width !== dw || dc.height !== dh) { dc.width = dw; dc.height = dh; }
      const dctx = dc.getContext('2d', { willReadFrequently: true });
      if (!dctx) return;
      dctx.drawImage(overlay, 0, 0, dw, dh);

      const quad = detectDocument(dctx.getImageData(0, 0, dw, dh));
      const diagonal = Math.hypot(dw, dh);
      const stability = quadStability(quad, prevQuadRef.current, diagonal);
      prevQuadRef.current = quad;
      quadRef.current = quad;

      if (quad && stability >= STEADY_THRESHOLD) steadyRef.current += 1;
      else steadyRef.current = 0;

      // Re-arm auto-capture once there is evidence of a different sheet.
      if (!quad) {
        lostFramesRef.current += 1;
        if (lostFramesRef.current >= 4) { armedRef.current = true; capturedQuadRef.current = null; }
      } else {
        lostFramesRef.current = 0;
        const shot = capturedQuadRef.current;
        if (shot) {
          // Centre-to-centre movement of more than a fifth of the frame is a
          // new sheet, not a hand wobbling.
          const centre = (q: Quad) => ({
            x: (q[0].x + q[1].x + q[2].x + q[3].x) / 4,
            y: (q[0].y + q[1].y + q[2].y + q[3].y) / 4,
          });
          const a = centre(shot), b = centre(quad);
          if (Math.hypot(a.x - b.x, a.y - b.y) > diagonal * 0.2) {
            armedRef.current = true;
            capturedQuadRef.current = null;
          }
        }
      }

      setHint(!quad
        ? 'Point the camera at your document'
        : autoRef.current && !armedRef.current
          ? 'Captured — show the next page'
          : steadyRef.current >= STEADY_FRAMES_NEEDED / 2
            ? 'Hold still…'
            : 'Document found — hold steady');

      // ── draw: video first, then the highlight, same canvas ──────────────
      if (quad) {
        const locked = steadyRef.current >= STEADY_FRAMES_NEEDED / 2;
        // Detector space -> canvas space. Both are the SAME upright, screen-
        // shaped picture at different scales, so this is one multiply and
        // cannot drift out of register with what is on screen.
        const kx = cssW / dw, ky = cssH / dh;
        const pts = quad.map((pt) => ({ x: pt.x * kx, y: pt.y * ky }));

        // Dim everything that is NOT the document, so the page lifts off the
        // desk the way it does in a bank's cheque scanner. Even-odd fill: the
        // whole screen, minus the quad.
        octx.save();
        octx.beginPath();
        octx.rect(0, 0, cssW, cssH);
        octx.moveTo(pts[0].x, pts[0].y);
        for (let n = 1; n < 4; n++) octx.lineTo(pts[n].x, pts[n].y);
        octx.closePath();
        octx.fillStyle = 'rgba(0,0,0,0.55)';
        octx.fill('evenodd');
        octx.restore();

        octx.beginPath();
        octx.moveTo(pts[0].x, pts[0].y);
        for (let n = 1; n < 4; n++) octx.lineTo(pts[n].x, pts[n].y);
        octx.closePath();
        octx.strokeStyle = locked ? '#22c55e' : 'rgba(255,255,255,0.9)';
        octx.lineWidth = locked ? 4 : 2.5;
        octx.shadowColor = locked ? 'rgba(34,197,94,0.65)' : 'transparent';
        octx.shadowBlur = locked ? 14 : 0;
        octx.stroke();
        octx.shadowBlur = 0;

        // Corner ticks — the visual grammar every scanner app uses for "locked".
        octx.fillStyle = locked ? '#22c55e' : '#fff';
        for (const pt of pts) {
          octx.beginPath();
          octx.arc(pt.x, pt.y, locked ? 7 : 5, 0, Math.PI * 2);
          octx.fill();
        }
      }

      if (autoRef.current && armedRef.current && quad && steadyRef.current >= STEADY_FRAMES_NEEDED && !busyRef.current) {
        capture(true);
      }
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [ready, capture, paintFrame]);

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-black" role="dialog" aria-modal="true" aria-label="Document scanner">
      <div className="relative flex-1 overflow-hidden">
        <video
          ref={videoRef}
          playsInline
          muted
          autoPlay
          className="pointer-events-none absolute size-px opacity-0"
          aria-hidden
        />
        {/* The one visible surface: the camera frame is painted here upright,
            then the highlight on top of it. */}
        <canvas ref={overlayRef} className="absolute inset-0 size-full" />
        {flash && <div aria-hidden className="pointer-events-none absolute inset-0 bg-white/80" />}

        {/* close */}
        <button
          onClick={onClose}
          aria-label="Close scanner"
          className="absolute left-4 top-4 flex size-11 items-center justify-center rounded-full bg-black/55 text-white backdrop-blur active:scale-95"
        >
          <X className="size-6" />
        </button>

        {/* turn the picture upright */}
        <button
          onClick={turn}
          aria-label="Rotate the camera picture"
          className="absolute left-4 top-[4.75rem] flex size-11 items-center justify-center rounded-full bg-black/55 text-white backdrop-blur active:scale-95"
        >
          <RotateCw className="size-5" />
        </button>

        {/* auto-capture toggle */}
        <button
          onClick={() => setAuto((a) => !a)}
          aria-pressed={auto}
          className="absolute right-4 top-4 flex items-center gap-1.5 rounded-full bg-black/55 px-3.5 py-2.5 text-xs font-semibold text-white backdrop-blur active:scale-95"
        >
          {auto ? <Zap className="size-4 text-amber-400" /> : <ZapOff className="size-4" />}
          {auto ? 'Auto' : 'Manual'}
        </button>

        {/* guidance */}
        {!error && (
          <div className="pointer-events-none absolute inset-x-0 top-20 flex justify-center px-4">
            <span className="rounded-full bg-black/55 px-4 py-2 text-sm font-medium text-white backdrop-blur">
              {ready ? hint : 'Starting camera…'}
            </span>
          </div>
        )}

        {error && (
          <div className="absolute inset-0 flex items-center justify-center p-8">
            <p className="max-w-sm text-center text-sm leading-relaxed text-white/90">{error}</p>
          </div>
        )}

        {!ready && !error && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <Loader2 className="size-8 animate-spin text-white/70" />
          </div>
        )}

        <span className="sr-only" role="status" aria-live="polite">
          {pageCount === 0 ? 'No pages captured yet' : `${pageCount} ${pageCount === 1 ? 'page' : 'pages'} captured`}
        </span>
      </div>

      {/* controls */}
      <div className="flex shrink-0 items-center justify-between gap-4 bg-black px-6 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-5">
        <div className="flex size-16 items-center justify-center">
          {lastThumb ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={lastThumb} alt="" className="size-14 rounded-lg border-2 border-white/80 object-cover" />
          ) : null}
        </div>

        <button
          onClick={() => capture(false)}
          disabled={!ready}
          aria-label="Capture page"
          className="flex size-[72px] items-center justify-center rounded-full border-4 border-white bg-white/20 disabled:opacity-40 active:scale-95"
        >
          <span className="size-14 rounded-full bg-white" />
        </button>

        <button
          onClick={onClose}
          className="flex size-16 flex-col items-center justify-center gap-1 rounded-xl text-white active:scale-95"
        >
          <span className="flex size-9 items-center justify-center rounded-full bg-emerald-600">
            <Check className="size-5" strokeWidth={3} />
          </span>
          <span className="text-[11px] font-semibold">
            Done{pageCount > 0 ? ` (${pageCount})` : ''}
          </span>
        </button>
      </div>
    </div>
  );
}
