'use client';
import { useCallback, useRef } from 'react';
import { isCancel } from './pdf-rewrite';

// Shared responsiveness helper. Gives a tool two guarantees without changing its
// own busy/done/error state:
//   1. Cancel — abort the in-flight worker crunch immediately (via AbortSignal).
//   2. Never a stuck spinner / never a stale result — a monotonic job token means
//      a cancelled OR superseded run (user picked a new file, ran again) can't
//      land its result or leave `busy` stuck.
//
// Usage in a tool:
//   const jobs = useCancelableJob();
//   async function apply() {
//     const { id, signal } = jobs.begin();
//     setBusy(true); setError(null); setDone(null);
//     try {
//       const out = await rewritePdf(file, op, { signal });
//       if (!jobs.isCurrent(id)) return;      // superseded/cancelled — drop it
//       ... setDone ...
//     } catch (e) {
//       if (isCancel(e) || !jobs.isCurrent(id)) return; // quiet on cancel
//       setError(...);
//     } finally {
//       if (jobs.isCurrent(id)) setBusy(false);
//     }
//   }
//   // Cancel button: onClick={() => { jobs.cancel(); setBusy(false); }}
export function useCancelableJob() {
  const jobRef = useRef(0);
  const acRef = useRef<AbortController | null>(null);

  const begin = useCallback(() => {
    const id = ++jobRef.current;
    const ac = new AbortController();
    acRef.current = ac;
    return { id, signal: ac.signal };
  }, []);

  const isCurrent = useCallback((id: number) => jobRef.current === id, []);

  const cancel = useCallback(() => {
    jobRef.current++;        // invalidate any in-flight job so its result is dropped
    acRef.current?.abort();  // terminate the worker crunch now
    acRef.current = null;
  }, []);

  return { begin, isCurrent, cancel };
}

export { isCancel };
