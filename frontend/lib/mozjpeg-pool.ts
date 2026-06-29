// A small pool of Web Workers that encode JPEGs with mozjpeg in parallel.
// Encoding is ~97% of conversion time and fully parallelizable, so spreading
// pages across cores turns a 30s job into a few seconds — while keeping the
// main thread free (no frozen tab).
//
// Cross-browser safety: if module Workers aren't supported, a worker fails to
// spawn, or a job errors, we transparently fall back to main-thread encoding
// (lib/mozjpeg.ts). The job always completes — never a dead end.

import { encodeJpeg } from './mozjpeg';

type Task = {
  id: number;
  buf: ArrayBuffer;
  width: number;
  height: number;
  quality: number;
  resolve: (b: Blob) => void;
  reject: (e: unknown) => void;
};

export interface MozjpegPool {
  encode(image: ImageData, quality: number): Promise<Blob>;
  inFlight(): number;
  destroy(): void;
}

export function createMozjpegPool(size: number): MozjpegPool {
  let workers: Worker[] = [];
  try {
    for (let i = 0; i < size; i++) {
      workers.push(new Worker(new URL('./mozjpeg.worker.ts', import.meta.url), { type: 'module' }));
    }
  } catch {
    workers.forEach((w) => w.terminate());
    workers = [];
  }

  const idle: Worker[] = [...workers];
  const queue: Task[] = [];
  const pending = new Map<number, Task>();
  const owner = new Map<number, Worker>();
  let seq = 0;
  let inflight = 0;

  function pump() {
    while (idle.length && queue.length) {
      const w = idle.pop()!;
      const t = queue.shift()!;
      pending.set(t.id, t);
      owner.set(t.id, w);
      w.postMessage({ id: t.id, data: t.buf, width: t.width, height: t.height, quality: t.quality }, [t.buf]);
    }
  }

  for (const w of workers) {
    w.onmessage = (e: MessageEvent) => {
      const { id, ok, buf, error } = e.data as { id: number; ok: boolean; buf?: ArrayBuffer; error?: string };
      const t = pending.get(id);
      pending.delete(id);
      owner.delete(id);
      idle.push(w);
      inflight--;
      pump();
      if (!t) return;
      if (ok && buf) t.resolve(new Blob([buf], { type: 'image/jpeg' }));
      else t.reject(new Error(error || 'encode failed'));
    };
    w.onerror = () => {
      // Reject whatever job(s) this worker was running; the caller falls back.
      owner.forEach((ww, id) => {
        if (ww === w) {
          const t = pending.get(id);
          pending.delete(id);
          owner.delete(id);
          inflight--;
          t?.reject(new Error('worker error'));
        }
      });
      idle.push(w);
      pump();
    };
  }

  return {
    encode(image, quality) {
      if (workers.length === 0) return encodeJpeg(image, quality); // no workers → main thread
      // Copy the pixels so we own a transferable buffer AND the original survives
      // for the main-thread fallback if the worker job fails.
      const buf = image.data.buffer.slice(0);
      inflight++;
      return new Promise<Blob>((resolve, reject) => {
        queue.push({ id: ++seq, buf, width: image.width, height: image.height, quality, resolve, reject });
        pump();
      }).catch(() => encodeJpeg(image, quality));
    },
    inFlight() {
      return inflight;
    },
    destroy() {
      workers.forEach((w) => w.terminate());
      workers = [];
      idle.length = 0;
      queue.length = 0;
      pending.clear();
      owner.clear();
    },
  };
}
