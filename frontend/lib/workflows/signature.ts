// The signature a workflow's "Sign" step stamps.
//
// It lives ONLY in this browser's localStorage — never in the workflow JSON we
// might one day sync to an account, and never on a server. A signature is
// closer to an identity document than to a setting, so it stays on the device
// that drew it; clearing it is one click and one key.

export type SavedSignature = {
  /** PNG (or JPEG) data URL of the trimmed signature. */
  dataUrl: string;
  isPng: boolean;
  w: number;
  h: number;
};

const KEY = 'dd-signature-v1';

export function loadSignature(): SavedSignature | null {
  if (typeof localStorage === 'undefined') return null;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as SavedSignature;
    return s && typeof s.dataUrl === 'string' && s.w > 0 && s.h > 0 ? s : null;
  } catch { return null; }
}

export function saveSignature(sig: SavedSignature): void {
  try { localStorage.setItem(KEY, JSON.stringify(sig)); } catch { /* private mode / quota */ }
}

export function clearSignature(): void {
  try { localStorage.removeItem(KEY); } catch { /* ignore */ }
}

/** data: URL → raw bytes, for pdf-lib embedding. */
export function signatureBytes(sig: SavedSignature): ArrayBuffer {
  const b64 = sig.dataUrl.slice(sig.dataUrl.indexOf(',') + 1);
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out.buffer;
}
