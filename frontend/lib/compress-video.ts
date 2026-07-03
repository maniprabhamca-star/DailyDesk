// Compress Video — on-device and license-clean. We re-encode using the BROWSER's
// own codecs (WebCodecs VideoEncoder, or MediaRecorder as a fallback) so there's
// no bundled encoder and no ffmpeg/x264 GPL exposure. The engine is ADAPTIVE:
// it detects what the browser can do and picks the best available path —
//   • "MP4" preference  -> H.264 in MP4 (widest compatibility), else falls to WebM
//   • "Smallest" pref   -> VP9/AV1 in WebM (best ratio), else falls to MP4
//   • no WebCodecs       -> MediaRecorder (WebM VP9/VP8)
// Frames are pulled from a <video> via requestVideoFrameCallback (real playback,
// every frame) and drawn to a down-scaled canvas, so quality/size are controlled
// by resolution + bitrate. Nothing is uploaded. Real-device verified (the
// automated test browser can't decode video); Node can't run WebCodecs.
import { Muxer as Mp4Muxer, ArrayBufferTarget as Mp4Target } from 'mp4-muxer';
import { Muxer as WebmMuxer, ArrayBufferTarget as WebmTarget } from 'webm-muxer';

export type VideoPref = 'mp4' | 'smallest';
export type Quality = 'high' | 'balanced' | 'small';

export type CompressOptions = {
  pref: VideoPref;
  quality: Quality;
  maxHeight: number; // downscale so the taller side is at most this (0 = keep)
};

export type CompressResult = { blob: Blob; ext: string; mime: string; label: string; width: number; height: number };

type Plan = { container: 'mp4' | 'webm'; codec: string; muxerCodec: string; ext: string; mime: string; label: string };

// bits-per-pixel-per-frame targets — the core compression knob. Lower = smaller.
const BPP: Record<Quality, number> = { high: 0.12, balanced: 0.07, small: 0.04 };

const MP4_CANDIDATES: Plan[] = [
  { container: 'mp4', codec: 'avc1.640029', muxerCodec: 'avc', ext: 'mp4', mime: 'video/mp4', label: 'H.264 · MP4' },
  { container: 'mp4', codec: 'avc1.42E01F', muxerCodec: 'avc', ext: 'mp4', mime: 'video/mp4', label: 'H.264 · MP4' },
];
const WEBM_CANDIDATES: Plan[] = [
  { container: 'webm', codec: 'av01.0.08M.08', muxerCodec: 'V_AV1', ext: 'webm', mime: 'video/webm', label: 'AV1 · WebM' },
  { container: 'webm', codec: 'vp09.00.40.08', muxerCodec: 'V_VP9', ext: 'webm', mime: 'video/webm', label: 'VP9 · WebM' },
];

async function supported(codec: string, width: number, height: number, bitrate: number): Promise<boolean> {
  try {
    const VE = (globalThis as unknown as { VideoEncoder?: { isConfigSupported: (c: object) => Promise<{ supported?: boolean }> } }).VideoEncoder;
    if (!VE) return false;
    const res = await VE.isConfigSupported({ codec, width, height, bitrate, framerate: 30 });
    return !!res.supported;
  } catch { return false; }
}

async function choosePlan(pref: VideoPref, w: number, h: number, bitrate: number): Promise<Plan | null> {
  const order = pref === 'mp4' ? [...MP4_CANDIDATES, ...WEBM_CANDIDATES] : [...WEBM_CANDIDATES, ...MP4_CANDIDATES];
  for (const p of order) if (await supported(p.codec, w, h, bitrate)) return p;
  return null;
}

function loadVideo(file: File): Promise<{ video: HTMLVideoElement; url: string; duration: number; w: number; h: number }> {
  const url = URL.createObjectURL(file);
  const video = document.createElement('video');
  video.muted = true; video.playsInline = true; video.preload = 'auto';
  video.style.cssText = 'position:fixed;left:-9999px;top:0;width:2px;height:2px;opacity:0;pointer-events:none';
  document.body.appendChild(video);
  return new Promise((resolve, reject) => {
    let settled = false;
    const t = setTimeout(() => { if (!settled) { settled = true; video.remove(); URL.revokeObjectURL(url); reject(new Error('Could not read this video. Most MP4, WebM and MOV files work.')); } }, 20000);
    video.onloadedmetadata = () => { if (settled) return; settled = true; clearTimeout(t); resolve({ video, url, duration: video.duration || 0, w: video.videoWidth, h: video.videoHeight }); };
    video.onerror = () => { if (settled) return; settled = true; clearTimeout(t); video.remove(); URL.revokeObjectURL(url); reject(new Error('Could not read this video. Most MP4, WebM and MOV files work.')); };
    video.src = url; video.load();
  });
}

// Even dimensions (encoders require it), scaled so the tall side ≤ maxHeight.
function outputDims(w: number, h: number, maxHeight: number): { w: number; h: number } {
  let ow = w, oh = h;
  if (maxHeight && Math.max(w, h) > maxHeight) {
    const s = maxHeight / Math.max(w, h);
    ow = Math.round(w * s); oh = Math.round(h * s);
  }
  return { w: Math.max(2, ow - (ow % 2)), h: Math.max(2, oh - (oh % 2)) };
}

// Drive a playing <video> frame-by-frame; call onFrame for each displayed frame.
function pumpFrames(video: HTMLVideoElement, onFrame: (mediaTime: number) => void, onEnd: () => void) {
  type RVFC = HTMLVideoElement & { requestVideoFrameCallback?: (cb: (now: number, md: { mediaTime: number }) => void) => number };
  const v = video as RVFC;
  video.onended = onEnd;
  if (typeof v.requestVideoFrameCallback === 'function') {
    const step = (_now: number, md: { mediaTime: number }) => { if (video.ended) return; onFrame(md.mediaTime); v.requestVideoFrameCallback!(step); };
    v.requestVideoFrameCallback!(step);
  } else {
    // Fallback: sample on a timer (no rVFC, e.g. some Firefox) while playing.
    const iv = setInterval(() => { if (video.ended || video.paused) { clearInterval(iv); if (video.ended) onEnd(); return; } onFrame(video.currentTime); }, 1000 / 30);
  }
  void video.play().catch(() => onEnd());
}

export async function compressVideo(
  file: File,
  opts: CompressOptions,
  onProgress?: (fraction: number) => void,
): Promise<CompressResult> {
  const { video, url, duration, w, h } = await loadVideo(file);
  const { w: outW, h: outH } = outputDims(w, h, opts.maxHeight);
  const fps = 30;
  const bitrate = Math.max(120_000, Math.round(outW * outH * fps * BPP[opts.quality]));

  const cleanup = () => { try { video.pause(); } catch {} URL.revokeObjectURL(url); video.removeAttribute('src'); video.load(); video.remove(); };

  const canvas = document.createElement('canvas');
  canvas.width = outW; canvas.height = outH;
  const cx = canvas.getContext('2d', { willReadFrequently: false });
  if (!cx) { cleanup(); throw new Error('Your browser blocked the canvas needed to compress the video.'); }

  try {
    const plan = await choosePlan(opts.pref, outW, outH, bitrate);
    if (plan) return await encodeWebCodecs(video, cx, plan, outW, outH, fps, bitrate, duration, onProgress, cleanup);
    return await encodeMediaRecorder(video, canvas, cx, outW, outH, fps, bitrate, duration, onProgress, cleanup);
  } catch (e) {
    cleanup();
    throw e;
  }
}

async function encodeWebCodecs(
  video: HTMLVideoElement, cx: CanvasRenderingContext2D, plan: Plan,
  outW: number, outH: number, fps: number, bitrate: number, duration: number,
  onProgress: ((f: number) => void) | undefined, cleanup: () => void,
): Promise<CompressResult> {
  const target = plan.container === 'mp4' ? new Mp4Target() : new WebmTarget();
  const muxer: { addVideoChunk: (c: never, m?: never) => void; finalize: () => void; target: { buffer: ArrayBuffer } } =
    plan.container === 'mp4'
      ? new Mp4Muxer({ target: target as Mp4Target, video: { codec: plan.muxerCodec as 'avc', width: outW, height: outH }, fastStart: 'in-memory' }) as never
      : new WebmMuxer({ target: target as WebmTarget, video: { codec: plan.muxerCodec as 'V_VP9', width: outW, height: outH, frameRate: fps } }) as never;

  const VE = (globalThis as unknown as { VideoEncoder: new (i: { output: (c: never, m: never) => void; error: (e: unknown) => void }) => VideoEncoderLike }).VideoEncoder;
  let failed: unknown = null;
  const encoder = new VE({ output: (chunk, meta) => muxer.addVideoChunk(chunk, meta), error: (e) => { failed = e; } });
  encoder.configure({ codec: plan.codec, width: outW, height: outH, bitrate, framerate: fps, latencyMode: 'quality' });

  await new Promise<void>((resolve) => {
    let lastKey = -1;
    const VF = (globalThis as unknown as { VideoFrame: new (s: CanvasImageSource, i: { timestamp: number }) => VideoFrameLike }).VideoFrame;
    pumpFrames(video,
      (mediaTime) => {
        if (failed) return;
        cx.drawImage(video, 0, 0, outW, outH);           // draw the frame FIRST…
        const frame = new VF(cx.canvas, { timestamp: Math.max(0, Math.round(mediaTime * 1e6)) }); // …then capture the canvas
        const key = lastKey < 0 || mediaTime - lastKey >= 2;
        encoder.encode(frame as never, { keyFrame: key });
        if (key) lastKey = mediaTime;
        frame.close();
        if (duration) onProgress?.(Math.min(0.99, mediaTime / duration));
      },
      () => resolve(),
    );
  });

  if (failed) throw new Error('This browser couldn’t encode the video. Try the “Smallest (WebM)” option or a different browser.');
  await encoder.flush();
  encoder.close();
  muxer.finalize();
  const blob = new Blob([muxer.target.buffer], { type: plan.mime });
  cleanup();
  onProgress?.(1);
  return { blob, ext: plan.ext, mime: plan.mime, label: plan.label, width: outW, height: outH };
}

async function encodeMediaRecorder(
  video: HTMLVideoElement, canvas: HTMLCanvasElement, cx: CanvasRenderingContext2D,
  outW: number, outH: number, fps: number, bitrate: number, duration: number,
  onProgress: ((f: number) => void) | undefined, cleanup: () => void,
): Promise<CompressResult> {
  const mime = MediaRecorder.isTypeSupported('video/webm;codecs=vp9') ? 'video/webm;codecs=vp9'
    : MediaRecorder.isTypeSupported('video/webm;codecs=vp8') ? 'video/webm;codecs=vp8' : 'video/webm';
  const stream = canvas.captureStream(fps);
  const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: bitrate });
  const chunks: BlobPart[] = [];
  rec.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };
  const stopped = new Promise<void>((r) => { rec.onstop = () => r(); });
  rec.start(250);
  await new Promise<void>((resolve) => {
    pumpFrames(video,
      (mt) => { cx.drawImage(video, 0, 0, outW, outH); if (duration) onProgress?.(Math.min(0.99, mt / duration)); },
      () => resolve(),
    );
  });
  rec.stop();
  await stopped;
  cleanup();
  onProgress?.(1);
  return { blob: new Blob(chunks, { type: 'video/webm' }), ext: 'webm', mime: 'video/webm', label: mime.includes('vp9') ? 'VP9 · WebM' : 'WebM', width: outW, height: outH };
}

// Minimal structural types for the WebCodecs classes (not in older TS lib.dom).
interface VideoEncoderLike { configure: (c: object) => void; encode: (f: VideoFrameLike, o?: { keyFrame?: boolean }) => void; flush: () => Promise<void>; close: () => void; }
interface VideoFrameLike { close: () => void; }
