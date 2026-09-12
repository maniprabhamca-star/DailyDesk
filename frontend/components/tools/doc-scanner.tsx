'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { X, Check, Zap, ZapOff, Loader2, RotateCw, ScanLine } from 'lucide-react';
import { detectDocument, flattenDocument, quadStability, coverCrop, uprightTurns, type Quad } from '@/lib/doc-scan';

/**
 * Full-screen document scanner.
 *
 * ── The change that matters, after five layouts the owner rejected ──────────
 * The <video> element is VISIBLE now, and it is the preview.
 *
 * Every earlier version hid it and repainted each frame into a canvas, which
 * meant this code had to decide which way up the picture went and how much of
 * it to show — and it was wrong five times running, in both directions: a band,
 * an overzoom, a sideways frame, a boxed-in frame, a band again. It could not
 * be right, because a browser either hands over the sensor's own orientation or
 * corrects it first, and the same 1280x720 means opposite things on the two.
 *
 * The browser already knows which of those it did. A <video> shown directly
 * renders upright, edge to edge, GPU-composited at the camera's own frame rate
 * — the reason a native scanner feels native. So CSS frames the preview, and
 * this file's only remaining job is to sample the SAME rectangle CSS is showing
 * (lib/doc-scan coverCrop) for detection and for capture. One formula, used by
 * both, so the highlight cannot drift off the page it is drawn around.
 *
 * uprightTurns still offers a quarter turn, but only for the case it can prove:
 * a landscape frame on an upright screen is a browser that did not rotate. A
 * portrait frame is left alone — that is the case the last auto-turn broke.
 * Whoever is holding the phone can override it, and the choice is remembered.
 */

/** Detector input width. Bigger is not better — lib/doc-scan downsamples anyway. */
const DETECT_WIDTH = 480;
/** Milliseconds between detection passes. ~12/sec is smooth to the eye and cheap. */
const DETECT_INTERVAL = 80;
/** Consecutive steady frames before an automatic capture fires. */
const STEADY_FRAMES_NEEDED = 8;
/** Below this, the page is still being moved. */
const STEADY_THRESHOLD = 0.82;
/** Longest edge of a captured page, in pixels — never upscaled past the sensor. */
const CAPTURE_LONG_EDGE = 2000;

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
  const holderRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const detectCanvas = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [auto, setAuto] = useState(true);
  const [flash, setFlash] = useState(false);
  const [hint, setHint] = useState('Point the camera at your document');

  // The viewport the preview fills. Measured, not assumed — a phone's browser
  // chrome slides away as you scroll and 100vh lies about it on iOS.
  const [box, setBox] = useState({ w: 0, h: 0 });
  const boxRef = useRef(box);
  useLayoutEffect(() => { boxRef.current = box; }, [box]);
  useLayoutEffect(() => {
    const el = holderRef.current;
    if (!el) return;
    const read = () => {
      const r = el.getBoundingClientRect();
      setBox((prev) => (Math.abs(prev.w - r.width) < 1 && Math.abs(prev.h - r.height) < 1
        ? prev
        : { w: r.width, h: r.height }));
    };
    read();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(read);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Quarter turns applied to the camera picture. Suggested once from the two
  // shapes, overridable, remembered — a device that needs it needs it always.
  const [turns, setTurns] = useState(0);
  const turnsRef = useRef(0);
  useEffect(() => { turnsRef.current = turns; }, [turns]);
  const chosenRef = useRef(false);
  const suggestedRef = useRef(false);
  // Shown in the corner. What the camera actually handed over differs by phone
  // and by browser, and every wrong layout so far came from assuming it.
  const [streamInfo, setStreamInfo] = useState('');
  useEffect(() => {
    try {
      // getItem returns null when nothing is stored, and Number(null) is 0 —
      // which read as "the person chose not to rotate" and suppressed the
      // suggestion entirely. Check for the absence first.
      const raw = localStorage.getItem('dd-scan-turns');
      if (raw !== null) {
        const saved = Number(raw);
        if (Number.isInteger(saved) && saved >= 0 && saved < 4) { chosenRef.current = true; setTurns(saved); }
      }
    } catch { /* private mode: fall back to the suggestion */ }
  }, []);
  const turn = useCallback(() => {
    chosenRef.current = true;
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
      // Ask for the back camera and plenty of pixels — this frame becomes the
      // page, so detail here is detail in the PDF. Nothing is asked about
      // orientation or aspect ratio any more: those requests were routinely
      // ignored, and acting on the answer is what produced the bands and the
      // overzoom. Whatever arrives, CSS frames it and coverCrop samples it.
      const attempts: MediaStreamConstraints[] = [
        { video: { facingMode: { ideal: 'environment' }, width: { ideal: 2560 }, height: { ideal: 1440 } }, audio: false },
        { video: { facingMode: { ideal: 'environment' } }, audio: false },
        { video: true, audio: false },
      ];
      let stream: MediaStream | null = null;
      let last: unknown = null;
      for (const constraints of attempts) {
        try { stream = await navigator.mediaDevices.getUserMedia(constraints); break; }
        catch (e) { last = e; }
      }
      if (cancelled) { stream?.getTracks().forEach((t) => t.stop()); return; }
      if (!stream) {
        const name = last instanceof Error ? last.name : '';
        setError(
          name === 'NotAllowedError' || name === 'SecurityError'
            ? 'Camera access is blocked for this site. Tap the padlock next to the address → Permissions → allow Camera.'
            : name === 'NotFoundError' || name === 'OverconstrainedError'
              ? 'No camera found on this device.'
              : name === 'NotReadableError' || name === 'AbortError'
                ? 'Another app is using the camera. Close it and try again.'
                : 'Couldn’t start the camera.',
        );
        return;
      }
      streamRef.current = stream;
      const v = videoRef.current;
      if (v) { v.srcObject = stream; await v.play().catch(() => {}); }
      setReady(true);
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
   * Paint what is ON SCREEN into a canvas of the same shape.
   *
   * The mirror image of the CSS below: same quarter turn, same cover crop. It
   * is used for detection and for capture, so both see the picture the person
   * framed rather than some other field of view.
   */
  const paintFrame = useCallback((ctx: CanvasRenderingContext2D, outW: number, outH: number) => {
    const v = videoRef.current;
    if (!v || !v.videoWidth || !v.videoHeight || outW <= 0 || outH <= 0) return false;
    const t = turnsRef.current;
    // The <video> element's own box, before CSS rotates it.
    const elW = t % 2 ? outH : outW;
    const elH = t % 2 ? outW : outH;
    const { sx, sy, sw, sh } = coverCrop(v.videoWidth, v.videoHeight, elW, elH);
    ctx.save();
    ctx.translate(outW / 2, outH / 2);
    if (t) ctx.rotate(t * (Math.PI / 2));
    ctx.drawImage(v, sx, sy, sw, sh, -elW / 2, -elH / 2, elW, elH);
    ctx.restore();
    return true;
  }, []);

  const capture = useCallback((isAuto: boolean) => {
    const v = videoRef.current;
    const { w: bw, h: bh } = boxRef.current;
    if (!v || !v.videoWidth || !bw || !bh || busyRef.current) return;
    busyRef.current = true;
    try {
      // Same shape as the preview, just larger — so the corners the detector
      // found on screen mean the same thing here. Never larger than the pixels
      // the sensor actually gave through the visible crop: upscaling a phone
      // frame to 2000px only makes a bigger blur and a bigger PDF.
      const t = turnsRef.current;
      const elW = t % 2 ? bh : bw;
      const elH = t % 2 ? bw : bh;
      const crop = coverCrop(v.videoWidth, v.videoHeight, elW, elH);
      const native = Math.max(crop.sw / elW, crop.sh / elH);
      const k = Math.max(1, Math.min(CAPTURE_LONG_EDGE / Math.max(bw, bh), native));
      const outW = Math.max(1, Math.round(bw * k));
      const outH = Math.max(1, Math.round(bh * k));

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
    if (!ready || !box.w || !box.h) return;
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

      // First frame with real dimensions: report them, and offer the turn if
      // the two shapes prove the browser did not apply one.
      if (!suggestedRef.current) {
        suggestedRef.current = true;
        setStreamInfo(`${v.videoWidth}×${v.videoHeight}`);
        if (!chosenRef.current) {
          const want = uprightTurns(v.videoWidth, v.videoHeight, box.w, box.h);
          if (want) setTurns(want);
        }
      }

      // The overlay covers the whole preview and carries ONLY the highlight —
      // the picture underneath is the live <video>, drawn by the browser.
      const cssW = box.w, cssH = box.h;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const pw = Math.round(cssW * dpr), ph = Math.round(cssH * dpr);
      if (overlay.width !== pw || overlay.height !== ph) { overlay.width = pw; overlay.height = ph; }
      octx.setTransform(dpr, 0, 0, dpr, 0, 0);
      octx.clearRect(0, 0, cssW, cssH);

      // Detect on a small copy of exactly what is on screen — same turn, same
      // crop. What you see is what is detected.
      if (!detectCanvas.current) detectCanvas.current = document.createElement('canvas');
      const dc = detectCanvas.current;
      const dw = Math.max(1, Math.min(DETECT_WIDTH, Math.round(cssW)));
      const dh = Math.max(1, Math.round((cssH / cssW) * dw));
      if (dc.width !== dw || dc.height !== dh) { dc.width = dw; dc.height = dh; }
      const dctx = dc.getContext('2d', { willReadFrequently: true });
      if (!dctx) return;
      if (!paintFrame(dctx, dw, dh)) return;

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

      // ── draw the highlight over the live video ──────────────────────────
      if (quad) {
        const locked = steadyRef.current >= STEADY_FRAMES_NEEDED / 2;
        // Detector space -> overlay space. Both are the SAME picture at
        // different scales, so this is one multiply and cannot drift out of
        // register with what is on screen.
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
  }, [ready, capture, paintFrame, box.w, box.h]);

  // The CSS side of the transform paintFrame applies. Sizing the element to the
  // SWAPPED box and then rotating it is what lets a turned picture still reach
  // every edge of the screen.
  const rotated = turns % 2 === 1;
  const videoStyle: React.CSSProperties = box.w
    ? {
        width: rotated ? box.h : box.w,
        height: rotated ? box.w : box.h,
        transform: `translate(-50%, -50%) rotate(${turns * 90}deg)`,
      }
    : { width: '100%', height: '100%', transform: 'translate(-50%, -50%)' };

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-black" role="dialog" aria-modal="true" aria-label="Document scanner">
      <div ref={holderRef} className="relative flex flex-1 items-center justify-center overflow-hidden">
        {/* The preview IS this element. The browser renders it the right way up,
            at the camera's own frame rate — do not hide it and repaint it. */}
        <video
          ref={videoRef}
          playsInline
          muted
          autoPlay
          style={videoStyle}
          className="absolute left-1/2 top-1/2 max-w-none object-cover"
        />
        {/* Highlight only, transparent, exactly over the preview. */}
        <canvas
          ref={overlayRef}
          aria-hidden
          className="pointer-events-none absolute inset-0 size-full"
        />
        {flash && <div aria-hidden className="pointer-events-none absolute inset-0 bg-white/80" />}

        {/* close */}
        <button
          onClick={onClose}
          aria-label="Close scanner"
          className="absolute left-4 top-4 flex size-11 items-center justify-center rounded-full bg-black/55 text-white backdrop-blur active:scale-95"
        >
          <X className="size-6" />
        </button>

        {streamInfo && (
          <span className="pointer-events-none absolute left-4 top-[8.25rem] rounded-full bg-black/55 px-2.5 py-1 font-mono text-[10px] text-white/80 backdrop-blur">
            {streamInfo}
          </span>
        )}

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

        {/* Mode chip and guidance, floating over the picture. The chip says
            what this screen is for at a glance — the reference app has the same
            thing and it is the first thing you read. */}
        {!error && (
          <div className="pointer-events-none absolute inset-x-0 bottom-32 flex flex-col items-center gap-2 px-4">
            <span className="flex items-center gap-2 rounded-full bg-white px-4 py-2.5 text-sm font-semibold text-neutral-900 shadow-lg">
              <ScanLine className="size-4 text-primary" />
              Scan document
            </span>
            <span className="rounded-full bg-black/60 px-3.5 py-1.5 text-[13px] font-medium text-white backdrop-blur">
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

        {/* Controls float ON the picture, like a camera app — a scrim for
            legibility rather than a black bar taking a third of the screen. */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-16">
          <div className="pointer-events-auto flex items-center justify-between gap-4 px-7">
            <div className="flex size-14 items-center justify-center">
              {lastThumb ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={lastThumb} alt="" className="size-13 rounded-lg border-2 border-white/80 object-cover" />
              ) : null}
            </div>

            <button
              onClick={() => capture(false)}
              disabled={!ready}
              aria-label="Capture page"
              className="flex size-[74px] items-center justify-center rounded-full border-[5px] border-white bg-transparent disabled:opacity-40 active:scale-95"
            >
              <span className="size-[58px] rounded-full bg-white transition-transform active:scale-90" />
            </button>

            <button
              onClick={onClose}
              className="flex size-14 flex-col items-center justify-center gap-1 text-white active:scale-95"
            >
              <span className="flex size-10 items-center justify-center rounded-full bg-emerald-600">
                <Check className="size-5" strokeWidth={3} />
              </span>
              <span className="text-[11px] font-semibold">
                Done{pageCount > 0 ? ` (${pageCount})` : ''}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
