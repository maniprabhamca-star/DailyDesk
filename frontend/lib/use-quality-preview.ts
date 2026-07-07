'use client';

import { useEffect, useRef, useState } from 'react';
import type { RenderedPage } from '@/lib/pdf-render';

// Shared "what you'll get, before you commit" preview engine for the
// quality↔size-tradeoff tools (Convert Image, Compress Image, PDF→JPG, HEIC→JPG),
// mirroring the Compress-PDF live preview. Given a render() that produces the
// output at the CURRENTLY selected settings, this debounces re-renders, cancels
// stale ones, and manages the object-URL lifecycle so callers just drop the
// result into <BeforeAfter after={...} />.
//
// The previous preview stays on screen until the next one is ready (no blank
// flash while dragging a slider), and is revoked on swap and on unmount.

export function useQualityPreview(opts: {
  // Only render while this is true (e.g. a file is loaded and we're not showing
  // a final result). Going false clears the preview.
  active: boolean;
  // A string that changes whenever the inputs change (file id + settings). The
  // render() closure is read from a ref, so only this drives re-runs — no
  // exhaustive-deps churn from the closure identity.
  signature: string;
  render: (signal: AbortSignal) => Promise<{ blob: Blob; w: number; h: number } | null>;
  delay?: number;
}): { preview: RenderedPage | null; busy: boolean } {
  const { active, signature, delay = 260 } = opts;
  const renderRef = useRef(opts.render);
  renderRef.current = opts.render;
  const [preview, setPreview] = useState<RenderedPage | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!active) {
      setPreview((p) => { if (p) URL.revokeObjectURL(p.url); return null; });
      setBusy(false);
      return;
    }
    const ac = new AbortController();
    setBusy(true);
    const t = setTimeout(async () => {
      try {
        const out = await renderRef.current(ac.signal);
        if (ac.signal.aborted) return;
        if (out) {
          const url = URL.createObjectURL(out.blob);
          setPreview((prev) => { if (prev) URL.revokeObjectURL(prev.url); return { url, w: out.w, h: out.h }; });
        }
      } catch {
        /* preview is best-effort — never surfaces an error */
      } finally {
        if (!ac.signal.aborted) setBusy(false);
      }
    }, delay);
    return () => { ac.abort(); clearTimeout(t); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, signature, delay]);

  // Release the last preview URL when the component unmounts.
  useEffect(() => () => { setPreview((p) => { if (p) URL.revokeObjectURL(p.url); return null; }); }, []);

  return { preview, busy };
}
