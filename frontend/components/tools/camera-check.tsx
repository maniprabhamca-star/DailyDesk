'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Camera, Copy, Check, Loader2 } from 'lucide-react';
import { detectDocument, type Quad } from '@/lib/doc-scan';

/**
 * A measurement, not a tool — and the answer to two questions that have each
 * been guessed at and got wrong.
 *
 * 1. WHAT SHAPE OF FRAME WILL THIS PHONE ACTUALLY GIVE?
 *
 *    The scanner's preview sits in a band with black above and below, where
 *    the phone's own camera app fills the screen. That happens when the
 *    browser hands over a LANDSCAPE buffer while the phone is upright: a
 *    vertical receipt then only gets the frame's short axis, which is both the
 *    band and the reason it has to be held further away.
 *
 *    Whether asking for a portrait frame fixes it is a property of the device,
 *    not of the argument. A comment in the scanner says it was asked and
 *    ignored. So this asks — four different ways — and prints what came back.
 *
 * 2. CAN THE DETECTOR SEE THE RECEIPT AT THIS SIZE?
 *
 *    The detector downsamples to 480px wide before looking. A receipt that is
 *    a tenth of a wide frame is ~48px across by then, with a blur pass over
 *    it, and the area it covers lands within a whisker of the floor that
 *    decides whether a candidate is a document or noise. Showing MORE of the
 *    camera's view makes the subject SMALLER, so the fix for the framing may
 *    be what broke the detection.
 *
 *    So this runs the real detector, on the real camera, at several widths,
 *    and reports which of them actually find the thing you are pointing at.
 *    No inference: the same function the scanner calls, on the same pixels.
 */

type Probe = { label: string; asked: string; got: string; note: string };
type DetectRow = { width: number; found: number; tried: number };

const PROBES: { label: string; c: MediaStreamConstraints }[] = [
  {
    label: 'Native 4:3, no crop (what the scanner asks for now)',
    c: { video: { facingMode: { ideal: 'environment' }, width: { ideal: 4096 }, height: { ideal: 3072 }, resizeMode: { ideal: 'none' } } as MediaTrackConstraints, audio: false },
  },
  {
    label: 'Portrait 3:4 — the shape the camera app shows',
    c: { video: { facingMode: { ideal: 'environment' }, width: { ideal: 3072 }, height: { ideal: 4096 } }, audio: false },
  },
  {
    label: 'Portrait, asked as an aspect ratio instead',
    c: { video: { facingMode: { ideal: 'environment' }, aspectRatio: { ideal: 0.75 } }, audio: false },
  },
  {
    label: 'No shape asked for at all',
    c: { video: { facingMode: { ideal: 'environment' } }, audio: false },
  },
];

/** Detector input widths to try. 480 is what the scanner uses today. */
const WIDTHS = [480, 720, 960];

export function CameraCheck() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [probes, setProbes] = useState<Probe[]>([]);
  const [probing, setProbing] = useState(true);
  const [zoomRange, setZoomRange] = useState('not read yet');
  const [frame, setFrame] = useState('');
  const [screen, setScreen] = useState('');
  const [rows, setRows] = useState<DetectRow[]>(WIDTHS.map((w) => ({ width: w, found: 0, tried: 0 })));
  const [copied, setCopied] = useState(false);

  // ── 1. ask four ways, record four answers ─────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!navigator.mediaDevices?.getUserMedia) { setError('This browser offers no camera capture.'); return; }
      const out: Probe[] = [];
      for (const p of PROBES) {
        if (cancelled) return;
        const v = (p.c.video ?? {}) as { width?: { ideal?: number }; height?: { ideal?: number }; aspectRatio?: { ideal?: number } };
        const asked = v.aspectRatio?.ideal
          ? `aspectRatio ${v.aspectRatio.ideal}`
          : v.width?.ideal ? `${v.width.ideal} x ${v.height?.ideal}` : '(nothing)';
        try {
          const s = await navigator.mediaDevices.getUserMedia(p.c);
          const st = s.getVideoTracks()[0]?.getSettings() ?? {};
          const w = st.width ?? 0, h = st.height ?? 0;
          out.push({
            label: p.label,
            asked,
            got: `${w} x ${h}`,
            // The only line that matters: did the shape follow the request?
            note: w >= h ? 'LANDSCAPE — receipt gets the short axis' : 'PORTRAIT — receipt gets the long axis',
          });
          s.getTracks().forEach((t) => t.stop());
        } catch (e) {
          out.push({ label: p.label, asked, got: 'refused', note: e instanceof Error ? e.name : 'error' });
        }
        if (!cancelled) setProbes([...out]);
      }
      if (cancelled) return;
      setProbing(false);

      // ── 2. open the one the scanner uses, and test the detector on it ─────
      try {
        const s = await navigator.mediaDevices.getUserMedia(PROBES[0].c);
        if (cancelled) { s.getTracks().forEach((t) => t.stop()); return; }
        streamRef.current = s;
        const track = s.getVideoTracks()[0];
        type ZoomCaps = MediaTrackCapabilities & { zoom?: { min: number; max: number } };
        const caps = (track?.getCapabilities?.() ?? {}) as ZoomCaps;
        setZoomRange(caps.zoom ? `min ${caps.zoom.min}  max ${caps.zoom.max}` : 'this camera reports no zoom range');
        const v = videoRef.current;
        if (v) { v.srcObject = s; await v.play().catch(() => {}); }
        setScreen(`${window.innerWidth} x ${window.innerHeight}`);
      } catch {
        setError('Could not open the camera. Allow camera access for this site and reload.');
      }
    })();
    return () => { cancelled = true; streamRef.current?.getTracks().forEach((t) => t.stop()); };
  }, []);

  // ── the live detector trial ───────────────────────────────────────────────
  // The real detectDocument, on the real frame, at each width — so "can it see
  // it" stops being a matter of opinion. `long: true`, because this page exists
  // for the receipt scanner and that is the mode it runs in.
  useEffect(() => {
    let timer: number | undefined;
    const tick = () => {
      timer = window.setTimeout(tick, 400);
      const v = videoRef.current;
      if (!v?.videoWidth) return;
      setFrame(`${v.videoWidth} x ${v.videoHeight}  (${v.videoWidth >= v.videoHeight ? 'LANDSCAPE' : 'PORTRAIT'})`);
      if (!canvasRef.current) canvasRef.current = document.createElement('canvas');
      const c = canvasRef.current;
      setRows((prev) => prev.map((r) => {
        const w = r.width;
        const h = Math.round((v.videoHeight / v.videoWidth) * w);
        if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
        const ctx = c.getContext('2d', { willReadFrequently: true });
        if (!ctx) return r;
        ctx.drawImage(v, 0, 0, w, h);
        let q: Quad | null = null;
        try { q = detectDocument(ctx.getImageData(0, 0, w, h), undefined, { long: true }); } catch { q = null; }
        return { width: w, found: r.found + (q ? 1 : 0), tried: r.tried + 1 };
      }));
    };
    timer = window.setTimeout(tick, 600);
    return () => window.clearTimeout(timer);
  }, []);

  const reset = useCallback(() => setRows(WIDTHS.map((w) => ({ width: w, found: 0, tried: 0 }))), []);

  const report = [
    'DiemDesk camera check',
    `screen      ${screen}`,
    `frame       ${frame}`,
    `lens zoom   ${zoomRange}`,
    '',
    'What the camera returned for each request:',
    ...probes.map((p) => `  ${p.asked.padEnd(16)} -> ${p.got.padEnd(12)} ${p.note}`),
    '',
    'Detector hit rate (pointed at a receipt):',
    ...rows.map((r) => `  ${r.width}px wide: ${r.found}/${r.tried}`),
    '',
    `ua          ${typeof navigator !== 'undefined' ? navigator.userAgent : ''}`,
  ].join('\n');

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight">
        <Camera className="size-5 text-primary" /> Camera check
      </h1>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
        Hold the phone upright and point the back camera at a receipt, the way you would to
        scan it. Leave it there for about ten seconds, then press <em>Copy the report</em>.
        Nothing is saved and nothing is sent — this only reads what the browser will say
        about the camera, and runs the scanner&rsquo;s own detector on the picture.
      </p>

      {error && <p className="mt-6 rounded-lg bg-destructive/10 p-4 text-sm text-destructive">{error}</p>}

      <video ref={videoRef} playsInline muted autoPlay className="mt-6 w-full rounded-xl bg-black" />

      <h2 className="mt-8 flex items-center gap-2 text-sm font-semibold">
        1. What shape will this camera give?
        {probing && <Loader2 className="size-3.5 animate-spin text-muted-foreground" />}
      </h2>
      <p className="mt-1 text-xs text-muted-foreground">
        A landscape frame is why the preview sits in a band: a standing receipt only gets the
        short side of the picture.
      </p>
      <div className="mt-3 overflow-hidden rounded-xl border text-sm">
        {probes.map((p, i) => (
          <div key={p.label} className={`px-4 py-2.5 ${i % 2 ? 'bg-muted/40' : ''}`}>
            <p className="font-medium">{p.label}</p>
            <p className="mt-0.5 font-mono text-[12px] text-muted-foreground">
              asked {p.asked} → got <strong className="text-foreground">{p.got}</strong>
            </p>
            <p className={`text-[12px] font-medium ${p.note.startsWith('PORTRAIT') ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground'}`}>
              {p.note}
            </p>
          </div>
        ))}
      </div>

      <h2 className="mt-8 text-sm font-semibold">2. Can the detector actually see it?</h2>
      <p className="mt-1 text-xs text-muted-foreground">
        The scanner&rsquo;s own edge detector, running on this camera right now, at three
        working sizes. It uses 480 today. Point at the receipt and watch which rows climb.
      </p>
      <div className="mt-3 overflow-hidden rounded-xl border text-sm">
        {rows.map((r, i) => {
          const pct = r.tried ? Math.round((r.found / r.tried) * 100) : 0;
          return (
            <div key={r.width} className={`flex items-center gap-3 px-4 py-2.5 ${i % 2 ? 'bg-muted/40' : ''}`}>
              <span className="w-24 shrink-0 font-medium tabular-nums">{r.width}px{r.width === 480 && ' (now)'}</span>
              <span className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                <span className="block h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${pct}%` }} />
              </span>
              <span className="w-20 shrink-0 text-right font-mono text-[12px] tabular-nums text-muted-foreground">
                {r.found}/{r.tried}
              </span>
            </div>
          );
        })}
      </div>

      <dl className="mt-6 overflow-hidden rounded-xl border text-sm">
        {([['Camera frame', frame || '…'], ['Screen', screen || '…'], ['Lens zoom range', zoomRange]] as const).map(([k, v], i) => (
          <div key={k} className={`flex flex-col gap-0.5 px-4 py-2.5 sm:flex-row sm:gap-4 ${i % 2 ? 'bg-muted/40' : ''}`}>
            <dt className="shrink-0 font-medium sm:w-40">{k}</dt>
            <dd className="break-all font-mono text-[12px] text-muted-foreground">{v}</dd>
          </div>
        ))}
      </dl>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          onClick={() => { void navigator.clipboard?.writeText(report).then(() => { setCopied(true); window.setTimeout(() => setCopied(false), 1800); }); }}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground active:scale-[0.98]"
        >
          {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
          {copied ? 'Copied' : 'Copy the report'}
        </button>
        <button onClick={reset} className="rounded-lg border px-4 py-2.5 text-sm font-semibold active:scale-[0.98]">
          Reset the counts
        </button>
      </div>
    </div>
  );
}
