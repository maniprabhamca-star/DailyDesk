'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { X, Check, Zap, ZapOff, Loader2, ScanLine } from 'lucide-react';
import { detectDocument, flattenDocument, quadStability, viewRect, fillZoom, smoothQuad, type Quad } from '@/lib/doc-scan';

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
 * ── THERE IS NO ROTATION HERE. Do not add one. ─────────────────────────────
 * Three rounds were spent on it. Two automatic rules were disproved on the
 * owner's phone in opposite directions, and the manual control that replaced
 * them was worse than both: its choice persisted, so the scanner opened turned
 * on every later visit and the verdict was "the camera is really inverted".
 *
 * The requirement, stated plainly: "the position should not change unless I
 * tilt the phone. only when I turn the phone the camera should also react."
 * That is precisely what a browser does with a <video> it is rendering itself,
 * and it is what any rotation of ours breaks. So there is none: no turns, no
 * transform, no stored key. The stale key is actively cleared on open, because
 * anyone who pressed the old button is still living with its answer.
 *
 * Nor is the element SIZED from JavaScript. It was given pixel dimensions
 * measured from the container, and on a phone that container changes height
 * whenever the address bar slides — so the picture shifted and rescaled while
 * the phone had not moved at all. It is `inset-0 size-full` with a fit and a
 * single scale factor: CSS only, nothing for a measurement to get wrong.
 *
 * ── Zoom, because filling the screen is not always affordable ───────────────
 * A phone that hands over a 2560x1440 frame while held upright cannot fill a
 * 375x812 screen without discarding three quarters of its width. That is the
 * "over zooming by default" report, and no default setting fixes it for
 * everyone — it depends entirely on the shape of the frame the camera gives.
 *
 * So the preview is `object-fit: contain` plus `transform: scale(zoom)`, where
 * zoom 1 shows the whole frame and `fillZoom()` reaches every edge, and the
 * stops in between are offered as chips the way a camera app offers 0.5x/1x/2x.
 * It opens on the LOWEST stop: every complaint about this screen has been that
 * it was too far in, never too far out, and zoomed out you can at least SEE
 * that there is a zoom control to reach for. Detection and capture read the
 * same `viewRect()` the CSS mirrors, so the highlight stays on the page at
 * every stop.
 *
 * ── Turning the phone: the CAMERA has to be told, not just the layout ──────
 * "i am doing in the landscape or tilting the phone horizontal, but the
 * scanner is still in vertical."
 *
 * The scanner had turned — its controls were at the sides of a landscape
 * screen. What had not turned was the camera. It was still shooting the tall
 * frame it was asked for when the scanner opened, and a 9:16 picture fitted
 * into a 16:9 screen is a narrow strip down the middle with black either side,
 * which is indistinguishable from "still in portrait" and is worse than it.
 *
 * No amount of rotating our own layout reaches that. `reshapeStream()` calls
 * applyConstraints on the live track so the camera itself re-shoots wide, and
 * the stops are rebuilt when EITHER shape changes — the screen's on the turn,
 * the frame's a moment later when the track has re-negotiated.
 */

/** Detector input width. Bigger is not better — lib/doc-scan downsamples anyway. */
const DETECT_WIDTH = 480;
/** Milliseconds between detection passes. ~12/sec is smooth to the eye and cheap. */
const DETECT_INTERVAL = 80;
/** Consecutive steady frames before an automatic capture fires. */
const STEADY_FRAMES_NEEDED = 8;
/** Below this, the page is still being moved. */
const STEADY_THRESHOLD = 0.82;
/**
 * Frames the last outline survives a detection miss before it is dropped.
 *
 * Detection misses the odd frame on a real desk — a hand shadow, a reflection,
 * one bad exposure — and hiding the outline each time is half of what reads as
 * "dancing". ~0.4s of memory covers the gaps without leaving a stale rectangle
 * on screen after the page has actually gone.
 */
const HOLD_FRAMES = 5;
/**
 * Consecutive detections before an outline is shown at all.
 *
 * The other half of the hysteresis. Without it a single lucky frame of grain
 * lights up a green rectangle, which is the flicker the owner saw from the
 * other direction: appearing when there was nothing there.
 */
const HITS_TO_SHOW = 2;
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
  const videoRef = useRef<HTMLVideoElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const detectCanvas = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [auto, setAuto] = useState(true);
  const [flash, setFlash] = useState(false);
  const [hint, setHint] = useState('Point the camera at your document');
  // Drives the chip: the owner asked for it only once a page is actually on
  // screen — a permanent label is decoration, the same label appearing the
  // moment the outline locks on is feedback.
  const [found, setFound] = useState(false);

  // Anyone who used the old rotate button still has its answer stored, and it
  // would go on turning their preview for ever. Clear it on the way in.
  useEffect(() => {
    try { localStorage.removeItem('dd-scan-turns'); } catch { /* private mode */ }
  }, []);

  // How much of the camera's view is on screen. 1 is the whole frame; the last
  // stop fills the screen. Set from the frame's shape the first time the camera
  // reports one, then owned by whoever is holding the phone.
  const [zoom, setZoom] = useState(1);
  const zoomRef = useRef(1);
  useEffect(() => { zoomRef.current = zoom; }, [zoom]);
  const [stops, setStops] = useState<number[]>([]);
  // The two shapes the stops were worked out for: the screen's, and the camera
  // frame's. Either one changing invalidates the range — a 16:9 camera needs a
  // 3.8x zoom to fill an upright screen and 1.2x to fill the same screen on its
  // side — so it is rebuilt rather than carried over.
  const shapeRef = useRef<{ box: number; frame: number } | null>(null);
  // Which way up the camera was last ASKED to shoot. Re-asking costs a moment
  // of the track re-negotiating, so it must happen on a turn and not per frame.
  const askedShapeRef = useRef<'tall' | 'wide' | null>(null);

  // Refs, not state: the detection loop reads these every frame and re-running
  // it on every React render would defeat the throttle entirely.
  // quadRef is the SMOOTHED outline — what is drawn, and what is captured.
  // Capturing the raw per-frame corners meant the page inherited whatever
  // jitter happened to land on the shutter frame.
  const quadRef = useRef<Quad | null>(null);
  const prevQuadRef = useRef<Quad | null>(null);
  const missesRef = useRef(0);
  const hitsRef = useRef(0);
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
      // Ask for the back camera, and for a frame shaped like the screen it is
      // going to fill.
      //
      // The previous list asked for 2560x1440 — explicitly LANDSCAPE — and a
      // screenshot from the owner's phone showed exactly that coming back, a
      // wide frame whose content was already the right way up. Covering an
      // upright screen with it keeps about a quarter of its width, which is the
      // "overzoomed" complaint, and no amount of layout work fixes a frame that
      // is the wrong shape to begin with. Asking for a tall one is the only
      // honest lever there is.
      //
      // Devices vary in which constraint they honour and several ignore all of
      // them, so this walks from most specific to plain `video: true` and takes
      // the first that opens. Whatever arrives, CSS frames it and coverCrop
      // samples it — nothing downstream depends on the answer.
      const tall = window.innerHeight >= window.innerWidth;
      askedShapeRef.current = tall ? 'tall' : 'wide';
      const attempts: MediaStreamConstraints[] = [
        // Shaped like the screen, at a resolution worth putting in a PDF.
        { video: { facingMode: { ideal: 'environment' }, width: { ideal: tall ? 1440 : 2560 }, height: { ideal: tall ? 2560 : 1440 } }, audio: false },
        // Same shape, asked the other way, since some devices honour only this.
        { video: { facingMode: { ideal: 'environment' }, aspectRatio: { ideal: window.innerWidth / window.innerHeight } }, audio: false },
        // 4:3 is squarer than 16:9, so it crops less on a tall screen.
        { video: { facingMode: { ideal: 'environment' }, width: { ideal: tall ? 1080 : 1440 }, height: { ideal: tall ? 1440 : 1080 } }, audio: false },
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
   * Ask the camera to shoot the way the phone is now being held.
   *
   * This is what "the scanner is still in vertical" actually was. The scanner
   * DID turn — the controls moved to the sides of a landscape screen — but the
   * camera was still handing over the tall frame it was asked for when the
   * scanner opened, and a 9:16 picture fitted into a 16:9 screen is a narrow
   * strip down the middle with black either side. Rotating our own layout can
   * never fix that; only the camera can, and nobody had told it.
   *
   * applyConstraints re-negotiates the live track in place. Re-calling
   * getUserMedia would work too but tears the stream down and builds another,
   * which flickers and on some devices re-runs the permission plumbing for no
   * reason. A device that refuses is not an error: the picture stays the shape
   * it was and the zoom control still covers it, which is the state this
   * already shipped in.
   */
  const reshapeStream = useCallback((tall: boolean) => {
    const want = tall ? 'tall' : 'wide';
    if (askedShapeRef.current === want) return;
    askedShapeRef.current = want;
    const track = streamRef.current?.getVideoTracks?.()[0];
    if (!track?.applyConstraints) return;
    void track.applyConstraints({
      width: { ideal: tall ? 1440 : 2560 },
      height: { ideal: tall ? 2560 : 1440 },
    }).catch(() => { /* the camera kept its shape; the zoom stops absorb it */ });
  }, []);

  /**
   * Paint what is ON SCREEN into a canvas of the same shape.
   *
   * The mirror image of the CSS: object-fit cover, nothing else. It is used for
   * detection and for capture, so both see the picture the person framed rather
   * than some other field of view.
   */
  const paintFrame = useCallback((ctx: CanvasRenderingContext2D, outW: number, outH: number) => {
    const v = videoRef.current;
    const overlay = overlayRef.current;
    const bw = overlay?.clientWidth ?? 0, bh = overlay?.clientHeight ?? 0;
    if (!v || !v.videoWidth || !v.videoHeight || !bw || !bh || outW <= 0 || outH <= 0) return false;
    // outW x outH is the PICTURE, not the screen — the caller sizes it to
    // viewRect's dw:dh, so the black bars either side of a zoomed-out preview
    // are never sampled. Feeding those to the detector would hand it a
    // perfect high-contrast rectangle to find, which is a bug already fixed
    // once (see MIN_EDGE_CONTRAST in lib/doc-scan).
    const { sx, sy, sw, sh } = viewRect(v.videoWidth, v.videoHeight, bw, bh, zoomRef.current);
    ctx.drawImage(v, sx, sy, sw, sh, 0, 0, outW, outH);
    return true;
  }, []);

  const capture = useCallback((isAuto: boolean) => {
    const v = videoRef.current;
    const overlay = overlayRef.current;
    // The element's own box, read now — never a remembered measurement.
    const bw = overlay?.clientWidth ?? 0, bh = overlay?.clientHeight ?? 0;
    if (!v || !v.videoWidth || !bw || !bh || busyRef.current) return;
    busyRef.current = true;
    try {
      // Same shape as the preview, just larger — so the corners the detector
      // found on screen mean the same thing here. Never larger than the pixels
      // the sensor actually gave through the visible crop: upscaling a phone
      // frame to 2000px only makes a bigger blur and a bigger PDF.
      const r = viewRect(v.videoWidth, v.videoHeight, bw, bh, zoomRef.current);
      const native = Math.max(r.sw / r.dw, r.sh / r.dh);
      const k = Math.max(1, Math.min(CAPTURE_LONG_EDGE / Math.max(r.dw, r.dh), native));
      const outW = Math.max(1, Math.round(r.dw * k));
      const outH = Math.max(1, Math.round(r.dh * k));

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

      // The overlay covers the whole preview and carries ONLY the highlight —
      // the picture underneath is the live <video>, drawn by the browser. Its
      // box is read every pass rather than remembered, so an address bar
      // sliding away costs a frame's accuracy instead of a re-render that
      // resizes the picture under the person's hands.
      const cssW = overlay.clientWidth, cssH = overlay.clientHeight;
      if (!cssW || !cssH) return;

      // Work out how far this camera CAN be zoomed on this screen, and where to
      // start — on the first real frame, and again whenever the screen changes
      // SHAPE, which means the phone was turned.
      //
      // Freezing it outright was the first attempt and it left the scanner
      // stuck in portrait: the range and the chosen stop both belonged to the
      // old shape, so turning the phone did nothing useful. Recomputing on
      // every frame is the other extreme and re-frames the picture under the
      // person's hands as the address bar slides.
      //
      // So: compare shapes, on a log ratio so it reads the same in either
      // direction. An address bar sliding away moves it by ~0.15; turning the
      // phone moves it by ~1.55. 0.35 sits clear of one and well under the
      // other.
      //
      // BOTH shapes matter. The screen's changes when the phone is turned; the
      // camera frame's changes a moment later, once applyConstraints has
      // re-negotiated the track. Watching only the screen meant the stops were
      // rebuilt from the OLD frame size and were wrong again immediately.
      const boxShape = cssW / cssH;
      const frameShape = v.videoWidth / v.videoHeight;
      const was = shapeRef.current;
      const turned = !was || Math.abs(Math.log(boxShape / was.box)) > 0.35;
      if (turned || Math.abs(Math.log(frameShape / was!.frame)) > 0.15) {
        // The phone was turned: ask the camera to follow. Everything below then
        // reruns when its new frame size arrives.
        if (turned) reshapeStream(cssH >= cssW);
        shapeRef.current = { box: boxShape, frame: frameShape };
        const max = fillZoom(v.videoWidth, v.videoHeight, cssW, cssH);
        // How many stops is worth offering depends on how wide the range is.
        // Four geometric stops across a 1.2x range gave "1x 1.1x 1.1x 1.2x" on
        // a phone turned sideways — two chips with the same label, showing
        // views nobody could tell apart. Deduplicating on the LABEL rather than
        // the number is the part that matters: what the eye compares is what is
        // printed on the chip.
        const ladder = max <= 1.08 ? []
          : max < 1.3 ? [1, max]
            : max < 2 ? [1, Math.sqrt(max), max]
              : [1, Math.cbrt(max), Math.cbrt(max) ** 2, max];
        const label = (z: number) => (z < 1.05 ? '1' : z.toFixed(1));
        const next = ladder
          .map((z) => Math.min(max, Math.max(1, z)))
          .filter((z, i, a) => a.findIndex((o) => label(o) === label(z)) === i);
        setStops(next);
        // Open on the LOWEST stop — asked for directly, and it is the right
        // default anyway. Zoomed all the way out you can see the whole page and
        // zoom in if you want to; opened too tight, the page is off the edges
        // of the screen and there is nothing on screen to tell you that zoom is
        // why. Every complaint about this scanner has been that it was too far
        // in, never that it was too far out.
        //
        // When there are no stops the camera already matches the screen, so
        // filling it and showing everything are the same picture.
        const start = next.length ? next[0] : max;
        setZoom(start);
        zoomRef.current = start;
      }

      // The picture's own rectangle inside the screen. At full zoom it IS the
      // screen; zoomed out there are black bars, and everything below works in
      // the picture's space so nothing ever samples or highlights a bar.
      const rect = viewRect(v.videoWidth, v.videoHeight, cssW, cssH, zoomRef.current);
      if (rect.dw < 2 || rect.dh < 2) return;

      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const pw = Math.round(cssW * dpr), ph = Math.round(cssH * dpr);
      if (overlay.width !== pw || overlay.height !== ph) { overlay.width = pw; overlay.height = ph; }
      octx.setTransform(dpr, 0, 0, dpr, 0, 0);
      octx.clearRect(0, 0, cssW, cssH);

      // Detect on a small copy of exactly what is on screen — same crop, same
      // zoom. What you see is what is detected.
      if (!detectCanvas.current) detectCanvas.current = document.createElement('canvas');
      const dc = detectCanvas.current;
      const dw = Math.max(1, Math.min(DETECT_WIDTH, Math.round(rect.dw)));
      const dh = Math.max(1, Math.round((rect.dh / rect.dw) * dw));
      if (dc.width !== dw || dc.height !== dh) { dc.width = dw; dc.height = dh; }
      const dctx = dc.getContext('2d', { willReadFrequently: true });
      if (!dctx) return;
      if (!paintFrame(dctx, dw, dh)) return;

      const raw = detectDocument(dctx.getImageData(0, 0, dw, dh));
      const diagonal = Math.hypot(dw, dh);

      // Hysteresis both ways, then damping. Between them these are the whole of
      // "fluctuating and dancing": an outline that needs corroborating before it
      // appears, survives a dropped frame or two, and moves smoothly in between.
      if (raw) {
        missesRef.current = 0;
        hitsRef.current += 1;
        if (hitsRef.current >= HITS_TO_SHOW) quadRef.current = smoothQuad(quadRef.current, raw, diagonal);
      } else if (quadRef.current && missesRef.current < HOLD_FRAMES) {
        missesRef.current += 1;
      } else {
        hitsRef.current = 0;
        quadRef.current = null;
      }
      const quad = quadRef.current;

      // Steadiness is measured on the smoothed outline, so noise alone can no
      // longer keep resetting the count and blocking automatic capture.
      const stability = quadStability(quad, prevQuadRef.current, diagonal);
      prevQuadRef.current = quad;

      if (quad && raw && stability >= STEADY_THRESHOLD) steadyRef.current += 1;
      else if (!quad) steadyRef.current = 0;
      setFound(!!quad);

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
        // Detector space -> overlay space: the same picture at a different
        // scale, shifted by wherever the picture sits on screen. One multiply
        // and one add, so it cannot drift out of register with what is shown.
        const kx = rect.dw / dw, ky = rect.dh / dh;
        const pts = quad.map((pt) => ({ x: rect.dx + pt.x * kx, y: rect.dy + pt.y * ky }));

        // Dim everything that is NOT the document, so the page lifts off the
        // desk the way it does in a bank's cheque scanner. Even-odd fill: the
        // picture, minus the quad — the black bars are already black and
        // dimming them would only make the edge of the picture look grubby.
        octx.save();
        octx.beginPath();
        octx.rect(rect.dx, rect.dy, rect.dw, rect.dh);
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
  }, [ready, capture, paintFrame, reshapeStream]);

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-black" role="dialog" aria-modal="true" aria-label="Document scanner">
      <div className="relative flex flex-1 items-center justify-center overflow-hidden">
        {/* The preview IS this element, framed entirely by CSS: fit the whole
            frame, then scale it up by the chosen zoom. No rotation and no
            measured pixel size — it reacts to the phone being turned because
            the browser turns it, and to the zoom chips, and to nothing else.
            `viewRect()` is the same arithmetic, for detection and capture. */}
        <video
          ref={videoRef}
          playsInline
          muted
          autoPlay
          style={{ transform: `scale(${zoom})` }}
          className="absolute inset-0 size-full object-contain"
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

        {/* No rotate control, and no stream-size readout. Both existed to work
            around a problem this component was causing itself; see the note at
            the top of the file. Pages that come out the wrong way round are
            turned in the page list afterwards, where the picture is still and
            the result of a tap is obvious. */}

        {/* auto-capture toggle */}
        <button
          onClick={() => setAuto((a) => !a)}
          aria-pressed={auto}
          className="absolute right-4 top-4 flex items-center gap-1.5 rounded-full bg-black/55 px-3.5 py-2.5 text-xs font-semibold text-white backdrop-blur active:scale-95"
        >
          {auto ? <Zap className="size-4 text-amber-400" /> : <ZapOff className="size-4" />}
          {auto ? 'Auto' : 'Manual'}
        </button>

        {/* Guidance, floating over the picture. The white chip appears only
            once a page is actually detected — asked for directly: "don't show
            the scan document chip always, it should show only when the document
            has been detected". Sitting there permanently it was a label; timed
            to the outline it tells you the scanner has found something. */}
        {!error && (
          <div className="pointer-events-none absolute inset-x-0 bottom-32 flex flex-col items-center gap-2 px-4 [@media(max-height:480px)]:bottom-[5.5rem] [@media(max-height:480px)]:gap-1">
            {/* Zoom, the way a camera app does it: a row of stops, the current
                one filled in. It exists because a camera that hands over a 16:9
                frame cannot fill an upright screen without throwing three
                quarters of the picture away — "the scanner is over zooming by
                default". 1× is the whole of what the camera can see; the last
                stop reaches every edge. Hidden when the frame already matches
                the screen, because then every stop shows the same thing.
                It lives INSIDE this column rather than at its own offset: two
                absolutely-positioned rows guessing at each other's height is
                how the first version ended up drawn behind the chip. */}
            {stops.length > 1 && (
              <div className="pointer-events-auto mb-1 flex items-center gap-1 rounded-full bg-black/55 p-1 backdrop-blur">
                {stops.map((z) => {
                  const on = Math.abs(z - zoom) < 0.06;
                  return (
                    <button
                      key={z}
                      onClick={() => setZoom(z)}
                      aria-pressed={on}
                      aria-label={`Zoom ${z.toFixed(1)} times`}
                      className={`min-w-11 rounded-full px-3 py-1.5 text-xs font-semibold tabular-nums transition ${
                        on ? 'bg-white text-neutral-900' : 'text-white/85 active:scale-95'
                      }`}
                    >
                      {z < 1.05 ? '1×' : `${z.toFixed(1)}×`}
                    </button>
                  );
                })}
              </div>
            )}
            {found && (
              <span className="flex items-center gap-2 rounded-full bg-white px-4 py-2.5 text-sm font-semibold text-neutral-900 shadow-lg">
                <ScanLine className="size-4 text-primary" />
                Scan document
              </span>
            )}
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
        <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-16 [@media(max-height:480px)]:pb-[max(0.5rem,env(safe-area-inset-bottom))] [@media(max-height:480px)]:pt-6">
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
              className="flex size-[74px] items-center justify-center rounded-full border-[5px] border-white bg-transparent disabled:opacity-40 active:scale-95 [@media(max-height:480px)]:size-[58px]"
            >
              <span className="size-[58px] rounded-full bg-white transition-transform active:scale-90 [@media(max-height:480px)]:size-[44px]" />
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
