// Decode a QR code from an image Blob, fully in the browser. jsQR (Apache-2.0)
// scans a single luminance pass, so we help it: try several sizes (huge photos
// are downscaled — faster AND blur-tolerant; tiny screenshots are tried at
// native size too) and both polarities (inversionAttempts) for dark-mode
// screenshots. Returns the decoded string or null if no code was found.
type Drawable = ImageBitmap | HTMLImageElement;

// jsQR is ~50KB — loaded on first scan, not with the page.
let jsqrPromise: Promise<typeof import('jsqr').default> | null = null;
function getJsQr() {
  if (!jsqrPromise) jsqrPromise = import('jsqr').then((m) => m.default);
  return jsqrPromise;
}

async function loadImage(src: Blob): Promise<{ img: Drawable; w: number; h: number; done: () => void }> {
  // createImageBitmap decodes off the main thread where supported…
  if (typeof createImageBitmap === 'function') {
    try {
      const bmp = await createImageBitmap(src);
      return { img: bmp, w: bmp.width, h: bmp.height, done: () => bmp.close() };
    } catch {
      // …fall through to the universal <img> path (older Safari, odd formats)
    }
  }
  const url = URL.createObjectURL(src);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('not-an-image'));
      el.src = url;
    });
    return { img, w: img.naturalWidth, h: img.naturalHeight, done: () => URL.revokeObjectURL(url) };
  } catch (e) {
    URL.revokeObjectURL(url);
    throw e;
  }
}

export async function decodeQrFromImage(src: Blob): Promise<string | null> {
  const jsQR = await getJsQr();
  const { img, w, h, done } = await loadImage(src);
  try {
    if (!w || !h) return null;
    const long = Math.max(w, h);
    // Candidate long edges, most-likely-to-hit first. Native size is capped —
    // jsQR is O(pixels) and a 48MP photo would stall for nothing extra.
    const targets = Array.from(new Set([
      Math.min(long, 1100),
      Math.min(long, 2000),
      Math.min(long, 640),
      Math.min(long, 3000),
    ])).filter((t) => t > 40);

    const canvas = document.createElement('canvas');
    const cx = canvas.getContext('2d', { willReadFrequently: true });
    if (!cx) return null;
    try {
      for (const target of targets) {
        const scale = target / long;
        canvas.width = Math.max(1, Math.round(w * scale));
        canvas.height = Math.max(1, Math.round(h * scale));
        cx.imageSmoothingEnabled = true;
        cx.imageSmoothingQuality = 'high';
        // White backing: transparent PNGs of dark-on-transparent codes need it.
        cx.fillStyle = '#ffffff';
        cx.fillRect(0, 0, canvas.width, canvas.height);
        cx.drawImage(img, 0, 0, canvas.width, canvas.height);
        const data = cx.getImageData(0, 0, canvas.width, canvas.height);
        const hit = jsQR(data.data, data.width, data.height, { inversionAttempts: 'attemptBoth' });
        if (hit && hit.data) return hit.data;
      }
      return null;
    } finally {
      canvas.width = 0; canvas.height = 0;
    }
  } finally {
    done();
  }
}
