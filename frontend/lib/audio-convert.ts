'use client';

// On-device audio extraction and conversion.
//
// Decoding uses the BROWSER's own decoders (Web Audio `decodeAudioData`), so
// anything the browser can play — MP4, MOV, WebM, MP3, M4A, AAC, OGG, FLAC,
// WAV — comes in without us shipping a demuxer. If a file won't decode that way
// we fall back to playing it and recording the output, which works for anything
// that plays at all. Nothing is uploaded.
//
// Encoding:
//   WAV — written here, plain PCM, no dependency.
//   MP3 — LAME (lamejs, LGPL-3.0), served from /lame/lame.min.js as a
//         standalone, replaceable file with its licence text beside it, exactly
//         as we do for libheif. It is NOT bundled into the app.

export type AudioFormat = 'mp3' | 'wav';

export type AudioOptions = {
  format: AudioFormat;
  kbps: number;       // MP3 only
  mono: boolean;
  trimStart: number;  // seconds
  trimEnd: number;    // seconds; 0 = to the end
};

export type AudioResult = {
  blob: Blob;
  name: string;
  ext: string;
  mime: string;
  seconds: number;
  channels: number;
  sampleRate: number;
};

export const DEFAULT_AUDIO_OPTIONS: AudioOptions = { format: 'mp3', kbps: 192, mono: false, trimStart: 0, trimEnd: 0 };

export const MP3_BITRATES = [96, 128, 192, 256, 320];

/** Anything longer is a memory risk: decoding holds the whole thing as float
 *  PCM (about 11 MB per stereo minute at 48 kHz). */
export const MAX_MINUTES = 90;

const abortError = () => new DOMException('Cancelled', 'AbortError');

type Ctx = AudioContext & { decodeAudioData: (b: ArrayBuffer) => Promise<AudioBuffer> };

function newContext(): Ctx {
  const AC = (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext);
  return new AC() as Ctx;
}

/** Decode by playing the file and recording the output. Slower than real
 *  decoding (it runs at playback speed) but it works for anything the browser
 *  can play, so a codec we can't decode directly is never a dead end. */
async function decodeViaPlayback(file: File, onMsg?: (m: string) => void, signal?: AbortSignal): Promise<AudioBuffer> {
  onMsg?.('Reading it the slow way — this one plays through once');
  const url = URL.createObjectURL(file);
  const el = document.createElement('video');
  el.src = url;
  el.muted = false;
  el.volume = 1;
  el.playsInline = true;
  el.style.cssText = 'position:fixed;left:-9999px;width:2px;height:2px;opacity:0';
  document.body.appendChild(el);
  const ctx = newContext();
  try {
    await new Promise<void>((res, rej) => {
      el.onloadedmetadata = () => res();
      el.onerror = () => rej(new Error('unplayable'));
    });
    const source = ctx.createMediaElementSource(el);
    const dest = ctx.createMediaStreamDestination();
    source.connect(dest);
    const rec = new MediaRecorder(dest.stream);
    const parts: BlobPart[] = [];
    rec.ondataavailable = (e) => { if (e.data.size) parts.push(e.data); };
    const done = new Promise<void>((res) => { rec.onstop = () => res(); });
    rec.start();
    await el.play();
    await new Promise<void>((res, rej) => {
      el.onended = () => res();
      signal?.addEventListener('abort', () => rej(abortError()));
    });
    rec.stop();
    await done;
    const buf = await new Blob(parts).arrayBuffer();
    return await ctx.decodeAudioData(buf);
  } finally {
    el.pause();
    el.remove();
    URL.revokeObjectURL(url);
    void ctx.close();
  }
}

/** File → PCM. Tries the real decoder first. */
export async function decodeAudio(file: File, onMsg?: (m: string) => void, signal?: AbortSignal): Promise<AudioBuffer> {
  if (signal?.aborted) throw abortError();
  onMsg?.('Reading the audio');
  const bytes = await file.arrayBuffer();
  const ctx = newContext();
  try {
    return await ctx.decodeAudioData(bytes);
  } catch {
    return await decodeViaPlayback(file, onMsg, signal);
  } finally {
    void ctx.close();
  }
}

/** Trim, and fold to mono if asked. Returns plain channel arrays — everything
 *  downstream works on these, so no AudioContext is needed again. */
export function shapePcm(buf: AudioBuffer, opts: AudioOptions): { channels: Float32Array[]; sampleRate: number; seconds: number } {
  const rate = buf.sampleRate;
  const start = Math.max(0, Math.floor(opts.trimStart * rate));
  const endSec = opts.trimEnd > 0 ? Math.min(opts.trimEnd, buf.duration) : buf.duration;
  const end = Math.max(start + 1, Math.floor(endSec * rate));
  const length = Math.min(end, buf.length) - start;

  const raw: Float32Array[] = [];
  for (let c = 0; c < buf.numberOfChannels; c++) raw.push(buf.getChannelData(c).subarray(start, start + length));

  if (opts.mono && raw.length > 1) {
    const mix = new Float32Array(length);
    for (let i = 0; i < length; i++) {
      let sum = 0;
      for (const ch of raw) sum += ch[i];
      mix[i] = sum / raw.length;
    }
    return { channels: [mix], sampleRate: rate, seconds: length / rate };
  }
  // Copy out of the source buffer so the caller owns the memory.
  return { channels: raw.map((c) => new Float32Array(c)), sampleRate: rate, seconds: length / rate };
}

/** Float sample → 16-bit. Negative uses the full 32768 step and positive 32767,
 *  which is what encoders expect: scaling both by 32767 quietly throws away the
 *  bottom step of the range. */
const clamp16 = (v: number) => {
  const c = v < -1 ? -1 : v > 1 ? 1 : v;
  return Math.round(c < 0 ? c * 32768 : c * 32767);
};

/** Interleaved 16-bit PCM in a RIFF/WAVE container. */
export function encodeWav(channels: Float32Array[], sampleRate: number): Blob {
  const n = channels[0].length;
  const ch = channels.length;
  const bytes = new ArrayBuffer(44 + n * ch * 2);
  const view = new DataView(bytes);
  const ascii = (off: number, s: string) => { for (let i = 0; i < s.length; i++) view.setUint8(off + i, s.charCodeAt(i)); };
  ascii(0, 'RIFF');
  view.setUint32(4, 36 + n * ch * 2, true);
  ascii(8, 'WAVE');
  ascii(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);            // PCM
  view.setUint16(22, ch, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * ch * 2, true);
  view.setUint16(32, ch * 2, true);
  view.setUint16(34, 16, true);
  ascii(36, 'data');
  view.setUint32(40, n * ch * 2, true);
  let p = 44;
  for (let i = 0; i < n; i++) {
    for (let c = 0; c < ch; c++) { view.setInt16(p, clamp16(channels[c][i]), true); p += 2; }
  }
  return new Blob([bytes], { type: 'audio/wav' });
}

type LameEncoder = { encodeBuffer: (l: Int16Array, r?: Int16Array) => Int8Array; flush: () => Int8Array };
type LameGlobal = { Mp3Encoder: new (channels: number, sampleRate: number, kbps: number) => LameEncoder };

let lamePromise: Promise<LameGlobal> | null = null;

/** Load LAME on demand from /lame/lame.min.js — a standalone file, not part of
 *  the app bundle, so the LGPL's "replaceable component" condition is met and
 *  the encoder only downloads for people who actually make an MP3. */
function loadLame(): Promise<LameGlobal> {
  if (lamePromise) return lamePromise;
  lamePromise = new Promise<LameGlobal>((resolve, reject) => {
    const existing = (window as unknown as { lamejs?: LameGlobal }).lamejs;
    if (existing?.Mp3Encoder) { resolve(existing); return; }
    const s = document.createElement('script');
    s.src = '/lame/lame.min.js';
    s.async = true;
    s.onload = () => {
      const g = (window as unknown as { lamejs?: LameGlobal }).lamejs;
      if (g?.Mp3Encoder) resolve(g);
      else reject(new Error('mp3-encoder-unavailable'));
    };
    s.onerror = () => reject(new Error('mp3-encoder-unavailable'));
    document.head.appendChild(s);
  }).catch((e) => { lamePromise = null; throw e; });
  return lamePromise;
}

const toInt16 = (f: Float32Array) => {
  const out = new Int16Array(f.length);
  for (let i = 0; i < f.length; i++) out[i] = clamp16(f[i]);
  return out;
};

export async function encodeMp3(
  channels: Float32Array[],
  sampleRate: number,
  kbps: number,
  onProgress?: (fraction: number) => void,
  signal?: AbortSignal,
): Promise<Blob> {
  const lame = await loadLame();
  const ch = Math.min(2, channels.length); // LAME takes mono or stereo
  const enc = new lame.Mp3Encoder(ch, sampleRate, kbps);
  const left = toInt16(channels[0]);
  const right = ch > 1 ? toInt16(channels[1]) : undefined;

  const FRAME = 1152; // one MPEG frame
  const parts: Int8Array[] = [];
  const total = left.length;
  for (let i = 0; i < total; i += FRAME) {
    if (signal?.aborted) throw abortError();
    const l = left.subarray(i, i + FRAME);
    const r = right ? right.subarray(i, i + FRAME) : undefined;
    const chunk = ch > 1 ? enc.encodeBuffer(l, r) : enc.encodeBuffer(l);
    if (chunk.length) parts.push(chunk);
    // Hand the thread back regularly: a long file would otherwise lock the tab.
    if ((i / FRAME) % 64 === 0) {
      onProgress?.(i / total);
      await new Promise((r2) => setTimeout(r2, 0));
    }
  }
  const tail = enc.flush();
  if (tail.length) parts.push(tail);
  onProgress?.(1);
  return new Blob(parts as unknown as BlobPart[], { type: 'audio/mpeg' });
}

const stem = (name: string) => name.replace(/\.[^.]+$/, '');

export async function convertAudio(
  file: File,
  opts: AudioOptions,
  cb?: { onMsg?: (m: string) => void; onProgress?: (fraction: number) => void; signal?: AbortSignal },
): Promise<AudioResult> {
  const decoded = await decodeAudio(file, cb?.onMsg, cb?.signal);
  if (decoded.duration > MAX_MINUTES * 60) {
    throw new Error(`That file is longer than ${MAX_MINUTES} minutes. Trim it first, or split it — converting it whole would run the tab out of memory.`);
  }
  cb?.onMsg?.(opts.format === 'mp3' ? 'Encoding MP3' : 'Writing WAV');
  const { channels, sampleRate, seconds } = shapePcm(decoded, opts);

  const blob = opts.format === 'mp3'
    ? await encodeMp3(channels, sampleRate, opts.kbps, cb?.onProgress, cb?.signal)
    : encodeWav(channels, sampleRate);

  const ext = opts.format === 'mp3' ? 'mp3' : 'wav';
  return {
    blob,
    name: `${stem(file.name)}.${ext}`,
    ext,
    mime: blob.type,
    seconds,
    channels: channels.length,
    sampleRate,
  };
}

/** mm:ss for durations, which is how people read audio lengths. */
export function clock(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const two = (n: number) => String(n).padStart(2, '0');
  return h ? `${h}:${two(m)}:${two(sec)}` : `${m}:${two(sec)}`;
}

/** "1:30" / "90" / "1:02:03" → seconds. Anything unparseable reads as 0 rather
 *  than throwing, so a half-typed value never blocks the form. */
export function parseClock(text: string): number {
  const parts = String(text).trim().split(':').map((p) => Number(p.replace(/[^\d.]/g, '')));
  if (!parts.length || parts.some((n) => !Number.isFinite(n))) return 0;
  return parts.reduce((acc, n) => acc * 60 + n, 0);
}
