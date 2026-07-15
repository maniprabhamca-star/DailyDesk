'use client';

import { useEffect } from 'react';

// Pass a file from one tool to another WITHOUT re-uploading. Next's <Link>/router
// navigations are client-side (SPA), so a module-level variable survives the
// route change — the PDF viewer stashes the open file here, then navigates to a
// tool which picks it up on mount. Nothing touches disk or a server; a hard
// refresh clears it (→ the target just shows its normal upload zone).
let pending: File | null = null;

export function setHandoff(file: File | null) { pending = file; }
export function takeHandoff(): File | null { const f = pending; pending = null; return f; }

/** Target tools call this with their own file-load function. On mount, if a file
 *  was handed off, it loads straight into the tool — skipping the upload step. */
export function useFileHandoff(load: (f: File) => void) {
  useEffect(() => {
    const f = takeHandoff();
    if (f) load(f);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
