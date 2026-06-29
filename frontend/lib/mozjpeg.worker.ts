/// <reference lib="webworker" />
// Off-main-thread mozjpeg encoder. One of these runs per pool worker so pages
// encode in parallel across CPU cores. The wasm is fetched from /public (same
// file the main thread uses) and compiled once per worker.
import encode, { init } from '@jsquash/jpeg/encode';

let ready: Promise<void> | null = null;
function ensure(): Promise<void> {
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
  const { id, data, width, height, quality } = e.data as {
    id: number; data: ArrayBuffer; width: number; height: number; quality: number;
  };
  try {
    await ensure();
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
