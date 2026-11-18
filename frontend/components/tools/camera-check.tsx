'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Camera, Copy, Check } from 'lucide-react';

/**
 * A measurement, not a tool.
 *
 * The receipt scanner has one unanswered question behind several rounds of
 * failed fixes, and it is not a question of taste: when a phone is held
 * upright, does the browser hand over a picture whose CONTENT is already
 * upright inside a landscape frame, or the sensor's raw sideways picture?
 *
 * Nothing in the platform reports it. `videoWidth`/`videoHeight` give the
 * frame's shape and say nothing about which way up what is inside it is, and
 * the two possibilities call for opposite fixes:
 *
 *   · content already upright → rotating the preview would lay it on its side,
 *     and the only honest levers are a wider lens and turning the phone;
 *   · content sideways        → rotating the preview by 90 degrees is exactly
 *     what the phone's own camera app does, and is the fix.
 *
 * Two automatic rules have been guessed at and both were wrong on the owner's
 * phone, in opposite directions. So this page stops guessing: it renders the
 * same live stream twice, as-is and rotated, and asks which one looks like the
 * camera app. One tap from a real phone settles it.
 */

type Report = {
  frame: string;
  viewport: string;
  dpr: number;
  angle: string;
  orientation: string;
  settings: string;
  zoom: string;
  resizeMode: string;
  ua: string;
};

export function CameraCheck() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const asIsRef = useRef<HTMLCanvasElement>(null);
  const turnedRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<Report | null>(null);
  const [copied, setCopied] = useState(false);
  const [verdict, setVerdict] = useState<'as-is' | 'turned' | null>(null);

  // Read everything the platform will tell us, now, off the live track.
  const measure = useCallback(() => {
    const v = videoRef.current;
    const track = streamRef.current?.getVideoTracks?.()[0];
    if (!v || !track) return;
    const st = track.getSettings() as MediaTrackSettings & { resizeMode?: string };
    type ZoomCaps = MediaTrackCapabilities & { zoom?: { min: number; max: number; step?: number } };
    const caps = (track.getCapabilities?.() ?? {}) as ZoomCaps;
    const shape = v.videoWidth >= v.videoHeight ? 'LANDSCAPE' : 'PORTRAIT';
    setReport({
      frame: `${v.videoWidth} x ${v.videoHeight} (${(v.videoWidth / v.videoHeight).toFixed(3)} - ${shape})`,
      viewport: `${window.innerWidth} x ${window.innerHeight} (${window.innerWidth >= window.innerHeight ? 'landscape' : 'portrait'})`,
      dpr: window.devicePixelRatio || 1,
      angle: String(window.screen?.orientation?.angle ?? '(not reported)'),
      orientation: String(window.screen?.orientation?.type ?? '(not reported)'),
      settings: `${st.width} x ${st.height} aspectRatio=${st.aspectRatio?.toFixed?.(3) ?? '?'} facing=${st.facingMode ?? '?'}`,
      zoom: caps.zoom ? `min ${caps.zoom.min} max ${caps.zoom.max} step ${caps.zoom.step ?? '?'}` : 'not reported by this camera',
      resizeMode: st.resizeMode ?? 'not reported',
      ua: navigator.userAgent,
    });
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!navigator.mediaDevices?.getUserMedia) { setError('This browser offers no camera capture.'); return; }
      // The same request the scanner now makes: the sensor's native shape at
      // the highest resolution it will give, and no crop to suit a layout.
      type WideVideo = MediaTrackConstraints & { resizeMode?: { ideal: string } };
      const attempts: MediaStreamConstraints[] = [
        { video: { facingMode: { ideal: 'environment' }, width: { ideal: 4096 }, height: { ideal: 3072 }, resizeMode: { ideal: 'none' } } as WideVideo, audio: false },
        { video: { facingMode: { ideal: 'environment' } }, audio: false },
        { video: true, audio: false },
      ];
      let stream: MediaStream | null = null;
      for (const c of attempts) {
        try { stream = await navigator.mediaDevices.getUserMedia(c); break; } catch { /* try the next */ }
      }
      if (cancelled) { stream?.getTracks().forEach((t) => t.stop()); return; }
      if (!stream) { setError('Could not open the camera. Allow camera access for this site and reload.'); return; }
      streamRef.current = stream;
      const v = videoRef.current;
      if (v) { v.srcObject = stream; await v.play().catch(() => {}); }
      measure();
    })();
    return () => { cancelled = true; streamRef.current?.getTracks().forEach((t) => t.stop()); };
  }, [measure]);

  // Re-measure when the phone is turned, because every number above changes.
  useEffect(() => {
    const onResize = () => measure();
    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('orientationchange', onResize);
    };
  }, [measure]);

  /* Both previews are painted from the SAME video into canvases, rather than
   * styled with CSS transforms. A rotated element fitted inside a box needs its
   * width and height swapped and a measured scale, and getting that wrong would
   * produce a misleading picture — which is the one thing a measurement must
   * not do. A canvas states the geometry outright. */
  useEffect(() => {
    let raf = 0;
    const paint = () => {
      raf = requestAnimationFrame(paint);
      const v = videoRef.current;
      if (!v?.videoWidth) return;
      const fw = v.videoWidth, fh = v.videoHeight;

      // As-is: the whole frame, contained — what the scanner shows today.
      const a = asIsRef.current;
      const actx = a?.getContext('2d');
      if (a && actx) {
        if (a.width !== 480 || a.height !== 640) { a.width = 480; a.height = 640; }
        actx.fillStyle = '#000';
        actx.fillRect(0, 0, a.width, a.height);
        const k = Math.min(a.width / fw, a.height / fh);
        const w = fw * k, h = fh * k;
        actx.drawImage(v, (a.width - w) / 2, (a.height - h) / 2, w, h);
      }

      // Turned: the same frame rotated a quarter turn clockwise, contained —
      // what the phone's own camera app appears to do.
      const b = turnedRef.current;
      const bctx = b?.getContext('2d');
      if (b && bctx) {
        if (b.width !== 480 || b.height !== 640) { b.width = 480; b.height = 640; }
        bctx.save();
        bctx.fillStyle = '#000';
        bctx.fillRect(0, 0, b.width, b.height);
        // Rotating swaps which frame axis each box axis has to hold, so the
        // fit is worked out against the SWAPPED pair.
        const k = Math.min(b.width / fh, b.height / fw);
        bctx.translate(b.width / 2, b.height / 2);
        bctx.rotate(Math.PI / 2);
        bctx.drawImage(v, (-fw * k) / 2, (-fh * k) / 2, fw * k, fh * k);
        bctx.restore();
      }
    };
    raf = requestAnimationFrame(paint);
    return () => cancelAnimationFrame(raf);
  }, []);

  const lines = report
    ? [
      'DiemDesk camera check',
      `frame        ${report.frame}`,
      `viewport     ${report.viewport} dpr ${report.dpr}`,
      `orientation  ${report.orientation} angle ${report.angle}`,
      `settings     ${report.settings}`,
      `lens zoom    ${report.zoom}`,
      `resizeMode   ${report.resizeMode}`,
      `looks right  ${verdict ?? '(not answered)'}`,
      `ua           ${report.ua}`,
    ].join('\n')
    : '';

  const copy = () => {
    void navigator.clipboard?.writeText(lines).then(() => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    });
  };

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight">
        <Camera className="size-5 text-primary" /> Camera check
      </h1>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
        Hold the phone upright and point the back camera at a receipt, standing the receipt
        up the way you would photograph it. Then answer the one question below. This page
        saves nothing and sends nothing — it only reads what the browser will say about the
        camera.
      </p>

      {error && <p className="mt-6 rounded-lg bg-destructive/10 p-4 text-sm text-destructive">{error}</p>}

      <video ref={videoRef} playsInline muted autoPlay className="hidden" />

      <h2 className="mt-8 text-sm font-semibold">Which one looks like your phone&rsquo;s camera app?</h2>
      <div className="mt-3 grid grid-cols-2 gap-3">
        <button
          onClick={() => setVerdict('as-is')}
          aria-pressed={verdict === 'as-is'}
          className={`rounded-xl border-2 p-2 text-left transition ${verdict === 'as-is' ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'}`}
        >
          <canvas ref={asIsRef} className="w-full rounded-lg bg-black" />
          <span className="mt-2 block text-xs font-semibold">A &mdash; as the browser gives it</span>
        </button>
        <button
          onClick={() => setVerdict('turned')}
          aria-pressed={verdict === 'turned'}
          className={`rounded-xl border-2 p-2 text-left transition ${verdict === 'turned' ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'}`}
        >
          <canvas ref={turnedRef} className="w-full rounded-lg bg-black" />
          <span className="mt-2 block text-xs font-semibold">B &mdash; turned a quarter</span>
        </button>
      </div>

      {report && (
        <>
          <h2 className="mt-8 text-sm font-semibold">What the browser reports</h2>
          <dl className="mt-3 overflow-hidden rounded-xl border text-sm">
            {([
              ['Camera frame', report.frame],
              ['Screen', `${report.viewport} · dpr ${report.dpr}`],
              ['Orientation', `${report.orientation} · angle ${report.angle}`],
              ['Track settings', report.settings],
              ['Lens zoom range', report.zoom],
              ['resizeMode', report.resizeMode],
            ] as const).map(([k, v], i) => (
              <div key={k} className={`flex flex-col gap-0.5 px-4 py-2.5 sm:flex-row sm:gap-4 ${i % 2 ? 'bg-muted/40' : ''}`}>
                <dt className="shrink-0 font-medium sm:w-40">{k}</dt>
                <dd className="break-all font-mono text-[12px] text-muted-foreground">{v}</dd>
              </div>
            ))}
          </dl>

          <button
            onClick={copy}
            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground active:scale-[0.98]"
          >
            {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
            {copied ? 'Copied' : 'Copy the report'}
          </button>
        </>
      )}
    </div>
  );
}
