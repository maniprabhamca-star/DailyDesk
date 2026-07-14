// Photo-privacy engine — on-device. Reads whether a photo is leaking metadata,
// blurs chosen regions (manual boxes + optional auto-detected faces), and exports
// a clean JPEG. Re-encoding through a canvas drops ALL EXIF/GPS/device data, so the
// export is metadata-free by construction.
export type MetaReport = { hasExif: boolean; gps: boolean; camera: boolean; date: boolean };
export type BlurRect = { x: number; y: number; w: number; h: number }; // fractions 0..1

// Lightweight header scan — enough to tell the user what's hidden in the file
// (we don't need to decode exact values to strip them).
export async function readMeta(file: File): Promise<MetaReport> {
  const buf = new Uint8Array(await file.slice(0, 256 * 1024).arrayBuffer());
  let hasExif = false;
  for (let i = 0; i + 6 < buf.length; i++) {
    if (buf[i] === 0xff && buf[i + 1] === 0xe1 && buf[i + 4] === 0x45 && buf[i + 5] === 0x78 && buf[i + 6] === 0x69) { hasExif = true; break; } // "Exif"
  }
  if (!hasExif) return { hasExif, gps: false, camera: false, date: false };
  const pair = (a: number, b: number) => {
    for (let i = 0; i + 1 < buf.length; i++) if ((buf[i] === a && buf[i + 1] === b) || (buf[i] === b && buf[i + 1] === a)) return true;
    return false;
  };
  return { hasExif, gps: pair(0x88, 0x25), camera: pair(0x01, 0x0f) || pair(0x01, 0x10), date: pair(0x90, 0x03) || pair(0x01, 0x32) };
}

// Auto-detect faces via the browser Shape Detection API (Chrome/Edge). Safe no-op
// elsewhere. Returns fractional rects, padded slightly to cover the whole head.
export async function detectFaces(bitmap: ImageBitmap): Promise<BlurRect[]> {
  try {
    const FD = (window as unknown as { FaceDetector?: new (o?: object) => { detect: (i: CanvasImageSource) => Promise<{ boundingBox: DOMRectReadOnly }[]> } }).FaceDetector;
    if (!FD) return [];
    const faces = await new FD({ fastMode: true, maxDetectedFaces: 25 }).detect(bitmap);
    const W = bitmap.width, H = bitmap.height;
    return (faces || []).map((f) => {
      const b = f.boundingBox;
      const px = b.width * 0.15, py = b.height * 0.25;
      return { x: Math.max(0, (b.x - px) / W), y: Math.max(0, (b.y - py) / H), w: Math.min(1, (b.width + 2 * px) / W), h: Math.min(1, (b.height + 2 * py) / H) };
    });
  } catch { return []; }
}

// Draw the image, blur every region, and export a JPEG (metadata stripped).
export async function exportCleanImage(bitmap: ImageBitmap, blurs: BlurRect[]): Promise<Blob> {
  const W = bitmap.width, H = bitmap.height;
  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const cx = canvas.getContext('2d');
  if (!cx) throw new Error('Your browser blocked canvas access.');
  cx.drawImage(bitmap, 0, 0);
  for (const b of blurs) {
    const rx = b.x * W, ry = b.y * H, rw = b.w * W, rh = b.h * H;
    if (rw < 2 || rh < 2) continue;
    cx.save();
    cx.beginPath();
    cx.rect(rx, ry, rw, rh);
    cx.clip();
    cx.filter = `blur(${Math.max(6, Math.round(Math.min(rw, rh) / 5))}px)`;
    cx.drawImage(bitmap, 0, 0, W, H); // full original, blurred, clipped to the region
    cx.restore();
  }
  const blob = await new Promise<Blob>((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error('encode'))), 'image/jpeg', 0.92));
  canvas.width = 0; canvas.height = 0;
  return blob; // canvas re-encode = no EXIF/GPS/device metadata carried over
}
