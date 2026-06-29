/// <reference lib="webworker" />
// Off-main-thread mozjpeg encoder. The WASM is compiled ONCE on the main thread
// and the resulting WebAssembly.Module is shared to every worker via an 'init'
// message — so we never download or compile the codec more than once, and each
// worker just instantiates from the shared module (cheap). Falls back to a
// self-fetch only if the shared module never arrives.
import encode, { init } from '@jsquash/jpeg/encode';

let ready: Promise<void> | null = null;

function ensureSelf(): Promise<void> {
  if (!ready) {
    ready = (async () => {
      const res = await fetch('/mozjpeg_enc.wasm');
      if (!res.ok) throw new Error('wasm load failed');
      await init(await WebAssembly.compile(await res.arrayBuffer()));
    })();
  }
  return ready;
}

self.onmessage = async (e: MessageEvent) => {
  const msg = e.data;

  // Shared compiled module from the main thread (one compile for the whole pool).
  if (msg && msg.type === 'init') {
    ready = (async () => { await init(msg.module as WebAssembly.Module); })();
    try { await ready; } catch { ready = null; }
    return;
  }

  const { id, data, width, height, quality } = msg as {
    id: number; data: ArrayBuffer; width: number; height: number; quality: number;
  };
  try {
    await (ready ?? ensureSelf());
    const hi = quality >= 90;
    const out = await encode(
      { data: new Uint8ClampedArray(data), width, height, colorSpace: 'srgb' } as ImageData,
      { quality, progressive: true, optimize_coding: true, auto_subsample: !hi, chroma_subsample: hi ? 1 : 2 },
    );
    (self as unknown as Worker).postMessage({ id, ok: true, buf: out }, [out]);
  } catch (err) {
    (self as unknown as Worker).postMessage({ id, ok: false, error: String(err) });
  }
};
