// Client-side mozjpeg (MozJPEG via WASM) encoder.
//
// Why: the browser's built-in `canvas.toBlob('image/jpeg')` is a weak encoder —
// it softens text edges and bloats files. mozjpeg (the encoder used by Squoosh
// and by server-side tools like iLovePDF/Smallpdf) preserves fine text while
// producing smaller files. It runs entirely in the browser, so files are never
// uploaded and our privacy promise is intact.
//
// The .wasm is served from /public (same pattern as the pdf.js worker) and
// compiled once, so we never depend on webpack bundling the wasm asset.

let initPromise: Promise<void> | null = null;

async function ensureReady(): Promise<void> {
  if (!initPromise) {
    initPromise = (async () => {
      const { init } = await import('@jsquash/jpeg/encode');
      const res = await fetch('/mozjpeg_enc.wasm');
      if (!res.ok) throw new Error('Could not load the image encoder.');
      const wasmModule = await WebAssembly.compile(await res.arrayBuffer());
      await init(wasmModule);
    })();
  }
  return initPromise;
}

/**
 * Encode raw pixels to a high-quality JPEG Blob using mozjpeg.
 * @param image  ImageData from a canvas (ctx.getImageData).
 * @param quality 0–100. >=90 uses full 4:4:4 colour (no chroma blur) for crisp coloured text.
 */
export async function encodeJpeg(image: ImageData, quality: number): Promise<Blob> {
  await ensureReady();
  const encode = (await import('@jsquash/jpeg/encode')).default;
  const hi = quality >= 90;
  const data = await encode(image, {
    quality,
    // Baseline (NOT progressive): progressive multi-scan ~doubles encode time for
    // zero visual gain. optimize_coding stays on — it shrinks the file and is cheap.
    progressive: false,
    optimize_coding: true,
    // For high quality keep full colour resolution (4:4:4) so coloured text/edges
    // stay sharp; for lower quality let mozjpeg subsample to save space.
    auto_subsample: !hi,
    chroma_subsample: hi ? 1 : 2,
  });
  return new Blob([data], { type: 'image/jpeg' });
}
