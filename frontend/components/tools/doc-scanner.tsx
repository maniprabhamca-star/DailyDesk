'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { X, Check, Zap, ZapOff, Loader2, ScanLine } from 'lucide-react';
import { detectDocument, flattenDocument, quadStability, viewRect, fillZoom, openingZoom, smoothQuad, type Quad, type DetectNotes } from '@/lib/doc-scan';

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

/**
 * Detector input, capped on the LONG edge rather than the width.
 *
 * It used to cap `width`, which was the long edge only because the preview was
 * a letterboxed band. A receipt now opens filling an upright screen, so the
 * long edge is the HEIGHT: the same 480 cap on width would have fed the
 * detector 390x844 and quietly tripled the work per pass, at ~12 passes a
 * second, on a phone.
 *
 * 720 rather than 480 because the two numbers answer different questions. The
 * area floor is a FRACTION, so downsampling never moves it — but the blur and
 * gradient radii are in pixels, and a 1:8 receipt filling the view is only an
 * eighth as wide as it is tall. At 480 that is ~48px across before blurring;
 * at 720 it is ~72px, which leaves an edge to find. Cost is ~1.4x the band's
 * pixel count, not 3x.
 */
const DETECT_LONG_EDGE = 720;
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

/**
 * `detected` says whether the edges were actually found. A capture without it
 * is the whole camera frame, desk and all — useful, but it needs cropping, and
 * the person needs telling that rather than being left to wonder what the crop
 * button is for.
 */
export type ScannerCapture = { data: ImageData; auto: boolean; detected: boolean };

export function DocScanner({
  onCapture,
  onClose,
  pageCount,
  lastThumb,
  subject = 'Document',
  single = false,
  long = false,
}: {
  onCapture: (c: ScannerCapture) => void;
  onClose: () => void;
  pageCount: number;
  lastThumb: string | null;
  /**
   * What this scanner is pointed at, for the wording. "Receipt found — hold
   * still" on the receipt scanner; "Document found" on scan-to-PDF. Naming the
   * thing is the difference between the screen talking to you and the screen
   * describing itself.
   */
  subject?: string;
  /**
   * One shot and done — the receipt scanner reads a single receipt, so there
   * is no page count, no Done button and no reason to stay open. Scan-to-PDF
   * keeps the multi-page behaviour it has always had.
   */
  single?: boolean;
  /**
   * Expect something long and thin. A till receipt is commonly 1:8, which the
   * detector's sliver rule was written to reject — it is the shape a pen makes.
   * Only the receipt scanner turns this on; scanning A4 keeps the stricter
   * rules, which are what stop a cable being outlined as a document.
   */
  long?: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const detectCanvas = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [auto, setAuto] = useState(true);
  const [flash, setFlash] = useState(false);
  const [hint, setHint] = useState(`Point the camera at your ${subject.toLowerCase()}`);
  // Drives the chip: the owner asked for it only once a page is actually on
  // screen — a permanent label is decoration, the same label appearing the
  // moment the outline locks on is feedback.
  const [found, setFound] = useState(false);
  // Last announced detection state, so the middle banner fires on the EDGE.
  const foundRef = useRef(false);

  /* The banner across the MIDDLE of the screen.
   *
   * The running instruction lives in a small pill at the bottom, next to the
   * shutter, and it is genuinely easy to miss — you are looking at the page you
   * are photographing, which is in the middle of the screen, not at a caption
   * under your thumb. Asked for directly: say it in the middle.
   *
   * Only the two moments that change what you should do next get to appear
   * here, each for about a second: the document being found, and the shot being
   * taken. A permanent banner in the middle would cover the thing you are
   * trying to frame, which is the one place a viewfinder must stay clear.
   */
  const [banner, setBanner] = useState<{ text: string; tone: 'found' | 'shot' | 'warn'; key: number } | null>(null);
  const bannerTimer = useRef<number | undefined>(undefined);
  const say = useCallback((text: string, tone: 'found' | 'shot' | 'warn', ms = 1100) => {
    setBanner({ text, tone, key: Date.now() });
    window.clearTimeout(bannerTimer.current);
    bannerTimer.current = window.setTimeout(() => setBanner(null), ms);
  }, []);
  useEffect(() => () => window.clearTimeout(bannerTimer.current), []);

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
  /**
   * The LENS, which is a different thing from the zoom above and the one that
   * actually decides whether a long receipt fits.
   *
   * `zoom` is a CSS magnification of the frame we were given — it can only ever
   * show LESS of the world. `lens` is `MediaStreamTrack`'s own zoom constraint,
   * which drives the hardware: on a phone with an ultra-wide, its reported
   * minimum is below 1, and asking for that minimum is how a browser reaches
   * the 0.5x camera. That is roughly twice the coverage along every axis, so
   * the same receipt fits at about half the distance.
   *
   * `lensStops` is empty on a device whose track reports no zoom range, which
   * is most iPhones and plenty of Androids. Nothing below depends on it being
   * there; the digital stops remain the fallback, as they were.
   */
  const [lensStops, setLensStops] = useState<number[]>([]);
  const [lens, setLens] = useState(1);
  const lensRef = useRef(1);
  const pickLens = useCallback((z: number) => {
    setLens(z);
    lensRef.current = z;
    const track = streamRef.current?.getVideoTracks?.()[0];
    // Bare value, not {exact}: the spec reads it as `ideal`, so a device that
    // cannot reach this stop gives its nearest instead of rejecting. The frame
    // size can change with the lens, which the stop-rebuilding below notices on
    // its own — it watches the frame's shape, not just the screen's.
    void track?.applyConstraints?.({ zoom: z } as MediaTrackConstraints).catch(() => {});
  }, []);

  // Refs, not state: the detection loop reads these every frame and re-running
  // it on every React render would defeat the throttle entirely.
  // quadRef is the SMOOTHED outline — what is drawn, and what is captured.
  // Capturing the raw per-frame corners meant the page inherited whatever
  // jitter happened to land on the shutter frame.
  const quadRef = useRef<Quad | null>(null);
  const prevQuadRef = useRef<Quad | null>(null);
  const missesRef = useRef(0);
  const hitsRef = useRef(0);
  // When the detector last found nothing, and whether it looked clipped — the
  // two facts the guidance under the shutter is built from.
  const missSinceRef = useRef(0);
  const clippedRef = useRef(false);
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
      // Ask for the back camera and for THE WIDEST VIEW IT HAS. Not a shape.
      //
      // Every previous version of this list asked for a particular aspect
      // ratio — 2560x1440, then 1440x2560 when that filled an upright screen
      // badly — on the theory that a frame shaped like the screen is the one
      // that displays well. It does display well, and it is the wrong thing to
      // ask a camera for.
      //
      // A phone sensor is natively about 4:3, and that is the only shape at
      // which its whole field of view is available. Any other ratio is
      // delivered by cropping the sensor and throwing the rest away: a 16:9
      // frame is a 4:3 one with the top and bottom removed. So asking for a
      // shape to suit the screen spends FIELD OF VIEW on LAYOUT, and field of
      // view is the entire reason a bill does or does not fit in the picture.
      // Layout is free; it is CSS, a few lines further down.
      //
      // So: native shape, highest resolution the device will give, and
      // `resizeMode: 'none'`, which exists precisely to say "do not crop or
      // rescale to satisfy me". Safari does not implement resizeMode, so it is
      // `ideal` — a mandatory form would fail the whole request on iOS.
      //
      // Devices vary in which constraint they honour, so this still walks from
      // most specific to plain `video: true`. Whatever arrives, CSS frames it
      // and viewRect samples it — nothing downstream depends on the answer.
      type WideVideo = MediaTrackConstraints & { resizeMode?: { ideal: string } };
      const wide = (width: number, height: number): MediaStreamConstraints => ({
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: width },
          height: { ideal: height },
          resizeMode: { ideal: 'none' },
        } as WideVideo,
        audio: false,
      });
      const attempts: MediaStreamConstraints[] = [
        // 4:3, the sensor's own shape, at more than any screen can show — the
        // extra pixels are for the crop that flattenDocument does later.
        wide(4096, 3072),
        wide(2048, 1536),
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

      /* Now ask the TRACK what lenses it has, and take the widest.
       *
       * This is the one lever that adds field of view rather than
       * redistributing it. `getCapabilities().zoom` is the hardware's own
       * range; on a phone whose back camera is a logical multi-camera the
       * minimum sits below 1 and selecting it is how a browser reaches the
       * ultra-wide. 0.5x is twice the linear coverage, which is the difference
       * between holding a long bill at arm's length and standing up to
       * photograph it.
       *
       * Nothing here is assumed. The range is read from the device, the stops
       * are built from what it reported, and a device that reports nothing gets
       * no lens row and behaves exactly as it did before. The constraint is
       * sent in its bare form, which the spec treats as `ideal`, so a camera
       * that changes its mind mid-session cannot throw.
       */
      const track0 = stream.getVideoTracks()[0];
      type ZoomCaps = MediaTrackCapabilities & { zoom?: { min: number; max: number; step?: number } };
      const caps = (track0?.getCapabilities?.() ?? {}) as ZoomCaps;
      const zr = caps.zoom;
      if (zr && typeof zr.min === 'number' && typeof zr.max === 'number' && zr.max > zr.min) {
        // Offer the lenses a camera app would: the widest the device has, 1x,
        // and one step in. Anything the range does not actually contain is
        // dropped rather than clamped, so a chip never lies about the view it
        // will give.
        const candidates = [zr.min, 1, 2, 3].filter((z) => z >= zr.min && z <= zr.max);
        const uniq = candidates.filter((z, i, a) => a.findIndex((o) => Math.abs(o - z) < 0.04) === i);
        if (uniq.length > 1) setLensStops(uniq);
        // Open on the widest. For a receipt that is the whole point; for a
        // page it is the same rule this scanner already follows for digital
        // zoom, and for the same reason — every complaint has been that it was
        // too far in.
        const start = uniq.length ? uniq[0] : zr.min;
        setLens(start);
        lensRef.current = start;
        try { await track0.applyConstraints({ zoom: start } as MediaTrackConstraints); } catch { /* kept its lens */ }
      }

      // Check again: the lens probe above awaits, and a scanner that is opened
      // and closed quickly — which is every other test in the e2e suite, and a
      // person changing their mind — can unmount during it. Without this the
      // stream is handed to a video element belonging to a closed dialog and
      // the camera is left running.
      if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return; }

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

  /* ── There is no reshapeStream any more, and there must not be one. ────────
   *
   * It used to re-ask the camera for a tall frame when the phone was turned
   * upright and a wide one when it was turned on its side, so that the frame
   * would match the screen. It did work, and it was the same mistake as the
   * constraint list above in a different place: a camera asked for a shape it
   * does not natively have answers by cropping its sensor, so every turn of
   * the phone threw away part of the view to improve the layout.
   *
   * The frame's shape is now fixed for the session — whatever the sensor's
   * own is — and the LAYOUT follows the frame rather than the other way round
   * (see the aspect-ratio'd preview box in the markup). That holds in both
   * orientations with nothing to re-negotiate, which also removes the window
   * where the stops had been rebuilt from a frame size that was about to
   * change.
   */

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
      onCapture({ data: out ?? frame, auto: isAuto, detected: !!out });
      // Said where you are looking. "Captured" rather than "capture success" —
      // the second is a status code with a space in it, and nobody says it.
      say(out ? 'Captured' : 'Captured — no edges found', out ? 'shot' : 'warn', out ? 1000 : 2200);

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
  }, [onCapture, paintFrame, say]);

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
        // The camera is NOT asked to follow the turn any more; see the note
        // where reshapeStream used to be. The frame keeps its native shape and
        // the preview box keeps the frame's, so a turn only changes how large
        // that box can be — which is what is recomputed here.
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
        // WHICH STOP TO OPEN ON, AND THE DISTINCTION THAT DECIDES IT.
        //
        // This zoom is a crop: 1 shows the whole frame letterboxed, `max`
        // (`fillZoom`) reaches every edge by throwing the rest away. Twice
        // now the opening stop has been moved because of an argument about
        // how much that crop costs, and both arguments measured the wrong
        // thing — AREA, when what a receipt needs is one AXIS.
        //
        // Read `viewRect` and it is exact. When the frame is wider than the
        // screen, which is every phone held upright, filling the screen
        // gives `sh === frameH`:
        //
        //     sh = boxH / cover = boxH / (boxH / frameH) = frameH
        //
        // Every row of the picture is still on screen. The ~90% discarded
        // is discarded SIDEWAYS. So filling the screen costs a vertical
        // receipt no field of view at all, and cannot be what made it need
        // more distance. It only removes the black and makes the receipt
        // about 2.9x bigger on screen.
        //
        // What DID cost field of view was asking the camera for 16:9. That
        // is a real crop of a 4:3 sensor, taken before the browser hands
        // the frame over, and it is where "I have to keep very long
        // distance to cover the entire bill" came from. The two were
        // shipped together, so removing 16:9 and opening wide at the same
        // time credited the fix to the wrong half — and opening wide then
        // caused the other half of that same report, "really too bad in
        // scanning the dimension": contained in a band, the receipt covers
        // ~6% of the detector's input against a 5% floor, so it is found
        // or lost on a coin toss. Filling the screen puts it near 17%.
        //
        // Hence: a receipt opens filled, a page opens wide.
        //
        // The split is not a preference, it is the same axis argument. A
        // till receipt is a vertical strip and what the crop removes is
        // empty table either side of it. An A4 page is not: fitting the
        // height of a filled 4:3 frame leaves room for something 0.46 wide
        // and a page is 0.71, so filling the screen would cut its sides
        // off. Pages keep the whole frame and the band with it.
        //
        // The rule itself is `openingZoom` in lib/doc-scan.ts, pure and
        // under test — it was rewritten twice while it lived in here, and
        // nothing failed either time.
        const start = openingZoom(v.videoWidth, v.videoHeight, cssW, cssH, next, long);
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
      const shrink = Math.min(1, DETECT_LONG_EDGE / Math.max(rect.dw, rect.dh));
      const dw = Math.max(1, Math.round(rect.dw * shrink));
      const dh = Math.max(1, Math.round(rect.dh * shrink));
      if (dc.width !== dw || dc.height !== dh) { dc.width = dw; dc.height = dh; }
      const dctx = dc.getContext('2d', { willReadFrequently: true });
      if (!dctx) return;
      if (!paintFrame(dctx, dw, dh)) return;

      const notes: DetectNotes = { clipped: false };
      const raw = detectDocument(dctx.getImageData(0, 0, dw, dh), notes, { long });
      const diagonal = Math.hypot(dw, dh);
      if (raw) missSinceRef.current = 0;
      else if (!missSinceRef.current) missSinceRef.current = now;
      clippedRef.current = notes.clipped;

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
      // The moment it locks on, said once, in the middle. Driven off the edge
      // of the signal and not its level, or it would re-announce on every
      // frame for as long as the page sits in view.
      if (!!quad !== foundRef.current) {
        foundRef.current = !!quad;
        if (quad) say(`${subject} found — hold still`, 'found');
      }
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

      // Nothing found is the state that needed the most work. It used to say
      // "Point the camera at your document" for ever, including while pointed
      // squarely at one — the detector needs all four corners, and a page held
      // close enough to run off the sides gives it two. Say the thing that
      // fixes it, and after a few seconds of nothing say the next most likely
      // thing, rather than repeating an instruction already being followed.
      const stuckFor = missSinceRef.current ? now - missSinceRef.current : 0;
      // "Move back" is the right instruction and, on its own, the wrong advice
      // for the thing people actually scan. A DL envelope is about 2.3:1. A
      // phone held upright shows a 16:9 camera frame letterboxed, so the widest
      // view available is 1.78:1 — narrower than the envelope. Backing off far
      // enough to fit it leaves the page a smear across a band a quarter of the
      // screen tall. Turning the phone is the move, and it is not obvious from
      // inside a portrait viewfinder, so say it.
      const portraitView = cssH > cssW;
      setHint(!quad
        ? clippedRef.current
          ? portraitView
            ? 'Turn the phone sideways, or move back — the page runs off the edge'
            : 'Move back — the page runs off the edge'
          // Never a dead end: the shutter has always taken the whole frame when
          // nothing is detected, and nothing on screen said so. Someone who has
          // been staring at "point the camera at your document" for four
          // seconds needs to know there is a way through.
          : stuckFor > 4000
            ? 'No edges found — press the shutter to keep the picture as it is'
            : `Point the camera at your ${subject.toLowerCase()}`
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
        // Green AS SOON AS IT IS FOUND, not only once it has been held still.
        //
        // It used to draw white on detection and turn green only after four
        // steady frames, on the reasoning that green should mean "about to
        // shoot". But the question someone is actually asking while they wave a
        // phone over a receipt is the earlier one — has it seen it at all? A
        // white outline is the scanner's answer to that, and white reads as
        // chrome rather than as an answer. Asked for directly: show the green
        // border once it judges the receipt.
        //
        // So green carries ONE meaning, "this is your receipt", and the
        // difference between found and held is weight rather than hue: a
        // thinner line while you are still moving, thicker with a glow and a
        // wash through it when it is about to fire.
        octx.strokeStyle = '#22c55e';
        octx.lineWidth = locked ? 4 : 3;
        octx.shadowColor = 'rgba(34,197,94,0.65)';
        octx.shadowBlur = locked ? 14 : 6;
        octx.stroke();
        octx.shadowBlur = 0;

        // The wash — "covered", asked for in those words. Faint on purpose: it
        // has to read as a tint over the receipt, not as a colour cast you then
        // have to look through to check the shot is framed.
        if (locked) {
          octx.save();
          octx.beginPath();
          octx.moveTo(pts[0].x, pts[0].y);
          for (let n = 1; n < 4; n++) octx.lineTo(pts[n].x, pts[n].y);
          octx.closePath();
          octx.fillStyle = 'rgba(34,197,94,0.16)';
          octx.fill();
          octx.restore();
        }

        // Corner ticks — the visual grammar every scanner app uses for "locked".
        octx.fillStyle = '#22c55e';
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
  // say and subject are stable (a useCallback with no deps, and a literal
  // prop), so listing them cannot restart the detection loop mid-scan.
  }, [ready, capture, paintFrame, say, subject, long]);

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-black" role="dialog" aria-modal="true" aria-label={`${subject} scanner`}>
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

        {/* The middle banner. `key` restarts the animation when one message
            replaces another, so "found" turning into "captured" reads as a new
            thing being said rather than a word swap in a box that never moved.
            aria-live carries the same news to a screen reader, which otherwise
            gets nothing from a camera at all. */}
        <div className="pointer-events-none absolute inset-x-0 top-1/2 flex -translate-y-1/2 justify-center px-6" role="status" aria-live="polite">
          {banner && (
            <span
              key={banner.key}
              className={`dd-scan-banner flex items-center gap-2 rounded-full px-5 py-3 text-base font-semibold shadow-2xl backdrop-blur ${
                banner.tone === 'found'
                  ? 'bg-emerald-500/95 text-white'
                  : banner.tone === 'shot'
                    ? 'bg-white/95 text-neutral-900'
                    : 'bg-amber-500/95 text-neutral-900'
              }`}
            >
              {banner.tone === 'found' ? <ScanLine className="size-5" /> : banner.tone === 'shot' ? <Check className="size-5" /> : <ScanLine className="size-5" />}
              {banner.text}
            </span>
          )}
        </div>

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
            {/* THE LENS ROW — the control that decides whether a long bill
                fits, and the reason the digital row below it matters less than
                it used to. These stops are the hardware's own zoom range, read
                off the track; 0.5x appears only on a phone that really has an
                ultra-wide, and on one that reports no range at all this row is
                simply absent. Shown above the digital stops because it is the
                one to reach for first: it adds view, where the other can only
                ever take view away. */}
            {lensStops.length > 1 && (
              <div className="pointer-events-auto mb-1 flex items-center gap-1 rounded-full bg-black/55 p-1 backdrop-blur">
                {lensStops.map((z) => {
                  const on = Math.abs(z - lens) < 0.04;
                  return (
                    <button
                      key={z}
                      onClick={() => pickLens(z)}
                      aria-pressed={on}
                      aria-label={z < 1 ? 'Ultra-wide lens, fits more in' : `Zoom ${z} times`}
                      className={`min-w-11 rounded-full px-3 py-1.5 text-xs font-semibold tabular-nums transition ${
                        on ? 'bg-white text-neutral-900' : 'text-white/85 active:scale-95'
                      }`}
                    >
                      {z < 1 ? `${z.toFixed(1)}×` : `${z}×`}
                    </button>
                  );
                })}
              </div>
            )}
            {/* ⚠ ONE ROW ONLY — never both.
                Shipping the lens row alongside the digital one put two rows of
                near-identical pills across the viewfinder: "its show 2 sizes in
                2 row and its colading the screen". They are different
                mechanisms, and that is our problem rather than the viewer's —
                nobody holding a phone over a receipt wants to be told which of
                two zooms they are adjusting. A camera app shows one row.
                The lens wins where it exists, because it is strictly the better
                control: it ADDS field of view, where the digital one can only
                ever take it away. The digital stops remain for cameras that
                report no zoom range of their own. */}
            {lensStops.length <= 1 && stops.length > 1 && (
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
                Scan {subject.toLowerCase()}
              </span>
            )}
            {/* The running hint steps aside while the found chip is up. Both
                at once is three stacked pills under a viewfinder that is
                already carrying a shutter and a zoom row, and the second one
                never says anything the first has not. */}
            {!found && (
              <span className="rounded-full bg-black/60 px-3.5 py-1.5 text-[13px] font-medium text-white backdrop-blur">
                {ready ? hint : 'Starting camera…'}
              </span>
            )}
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
          {single ? '' : pageCount === 0 ? 'No pages captured yet' : `${pageCount} ${pageCount === 1 ? 'page' : 'pages'} captured`}
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
              aria-label={single ? `Capture ${subject.toLowerCase()}` : 'Capture page'}
              className="flex size-[74px] items-center justify-center rounded-full border-[5px] border-white bg-transparent disabled:opacity-40 active:scale-95 [@media(max-height:480px)]:size-[58px]"
            >
              <span className="size-[58px] rounded-full bg-white transition-transform active:scale-90 [@media(max-height:480px)]:size-[44px]" />
            </button>

            {/* One shot and the scanner closes by itself, so there is nothing
                to be Done with — a tick that ends a session you have already
                left would only invite a second tap on a screen that has gone.
                The spacer keeps the shutter centred. */}
            {single ? (
              <div className="size-14" aria-hidden />
            ) : (
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
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
