'use client';

import { useEffect } from 'react';

// Pass a file from one tool to another WITHOUT re-uploading. Next's <Link>/router
// navigations are client-side (SPA), so a module-level variable survives the
// route change — the PDF viewer stashes the open file here, then navigates to a
// tool which picks it up on mount. Nothing touches disk or a server; a hard
// refresh clears it (→ the target just shows its normal upload zone).
let pending: { file: File; t: number } | null = null;

export function setHandoff(file: File | null) { pending = file ? { file, t: Date.now() } : null; }
// Consume the handed-off file. Expires after a short window so a click that lands
// on a gated "coming soon" / pricing page (which never consumes it) can't leave a
// stale file that auto-loads into the NEXT tool the user opens.
export function takeHandoff(): File | null {
  const p = pending; pending = null;
  return p && Date.now() - p.t < 12000 ? p.file : null;
}

/** Target tools call this with their own file-load function. On mount, if a file
 *  was handed off, it loads straight into the tool — skipping the upload step. */
export function useFileHandoff(load: (f: File) => void) {
  useEffect(() => {
    const f = takeHandoff();
    if (f) load(f);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
