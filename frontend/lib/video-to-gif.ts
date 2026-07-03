// Video → GIF, fully on-device and license-clean. We let the BROWSER decode the
// video (a plain <video> element uses the OS/browser codecs — no bundled codec,
// so no ffmpeg/x264 GPL exposure), grab frames onto a canvas by seeking, and
// encode the GIF with gifenc (MIT). Nothing is uploaded. gate: browser e2e +
// dev-harness/videogif-qa.js (encoder path on synthetic frames).
import { GIFEncoder, quantize, applyPalette } from 'gifenc';

export type VideoGifOptions = {
  fps: number;       // frames per second in the output GIF
  start: number;     // clip start, seconds
  end: number;       // clip end, seconds
  width: number;     // output width in px (height keeps the aspect ratio)
  maxColors: number; // palette size, 2–256
  loop: boolean;     // loop forever vs play once
};

export type VideoMeta = { duration: number; width: number; height: number };

// A GIF with too many frames is enormous and slow — cap it and steer the user to
// a shorter clip / lower fps instead of freezing the tab.
export const MAX_FRAMES = 450;

/** Load a video File and resolve once its duration/dimensions are known. */
export function loadVideoMeta(file: File): Promise<{ video: HTMLVideoElement; meta: VideoMeta; url: string }> {
  const url = URL.createObjectURL(file);
  const video = document.createElement('video');
  video.muted = true;
  video.playsInline = true;
  video.preload = 'auto';
  video.src = url;
  return new Promise((resolve, reject) => {
    video.onloadedmetadata = () =>
      resolve({ video, meta: { duration: video.duration || 0, width: video.videoWidth, height: video.videoHeight }, url });
    video.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Could not read this video. Most MP4, WebM and MOV files work; some formats aren’t supported by your browser.'));
    };
  });
}

function seekTo(video: HTMLVideoElement, t: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const done = () => { cleanup(); resolve(); };
    const fail = () => { cleanup(); reject(new Error('Could not read a frame from this video.')); };
    const cleanup = () => { video.removeEventListener('seeked', done); video.removeEventListener('error', fail); };
    video.addEventListener('seeked', done);
    video.addEventListener('error', fail);
    // Nudge off exact duration so the last seek always fires 'seeked'.
    video.currentTime = Math.min(t, Math.max(0, (video.duration || t) - 0.001));
  });
}

/** How many frames a given clip/fps would produce — for the UI's live estimate. */
export function frameCount(start: number, end: number, fps: number): number {
  return Math.max(1, Math.ceil((Math.max(start, end) - Math.min(start, end)) * fps));
}

export async function videoToGif(
  file: File,
  opts: VideoGifOptions,
  onProgress?: (done: number, total: number) => void,
): Promise<Blob> {
  const { video, meta, url } = await loadVideoMeta(file);
  try {
    // Wait until frames are actually decodable (metadata alone isn't enough to seek).
    if (video.readyState < 2) {
      await new Promise<void>((res) => {
        const ok = () => res();
        video.addEventListener('canplay', ok, { once: true });
        setTimeout(res, 4000); // don't hang forever if canplay never fires
      });
    }

    const start = Math.max(0, Math.min(opts.start, meta.duration));
    const end = Math.max(start + 1 / opts.fps, Math.min(opts.end, meta.duration || opts.end));
    const times: number[] = [];
    for (let t = start; t < end; t += 1 / opts.fps) times.push(t);
    if (times.length === 0) times.push(start);
    if (times.length > MAX_FRAMES) {
      throw new Error(`That’s ${times.length} frames — too many for one GIF. Shorten the clip or lower the frame rate (keep it under ${MAX_FRAMES}).`);
    }

    const w = Math.max(16, Math.round(opts.width));
    const h = Math.max(16, Math.round((w / (meta.width || w)) * (meta.height || w)));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const cx = canvas.getContext('2d', { willReadFrequently: true });
    if (!cx) throw new Error('Your browser blocked the canvas needed to build the GIF.');

    const delay = Math.round(1000 / opts.fps);
    const colors = Math.min(256, Math.max(2, opts.maxColors));
    const gif = GIFEncoder();
    for (let i = 0; i < times.length; i++) {
      await seekTo(video, times[i]);
      cx.drawImage(video, 0, 0, w, h);
      const { data } = cx.getImageData(0, 0, w, h);
      const palette = quantize(data, colors);
      const index = applyPalette(data, palette);
      // `repeat` is only read from the first frame: 0 = loop forever, -1 = play once.
      gif.writeFrame(index, w, h, i === 0 ? { palette, delay, repeat: opts.loop ? 0 : -1 } : { palette, delay });
      onProgress?.(i + 1, times.length);
    }
    gif.finish();
    canvas.width = 0; canvas.height = 0;
    return new Blob([gif.bytes()], { type: 'image/gif' });
  } finally {
    URL.revokeObjectURL(url);
    video.removeAttribute('src');
    video.load();
  }
}
