'use client';

import { useEffect, useState } from 'react';

// Feature detection that is safe to render with.
//
// THE BUG THIS EXISTS FOR: several tools computed a capability during render —
//   const canEyedrop = typeof window !== 'undefined' && 'EyeDropper' in window;
// The server renders that as false and the browser renders it as true, which is
// a hydration mismatch. React then throws away the server-rendered DOM for that
// subtree and re-renders it on the client (React errors #418 and #423, caught
// by the E2E console assertion on /color-picker and /pdf-to-audio). That is not
// cosmetic: the discarded subtree is unresponsive while it re-renders, which
// lengthens the window where a button looks ready and does nothing.
//
// `undefined` means "not known yet" — the first client render must match the
// server, so callers decide whether unknown should read as available (don't
// show a "not supported" warning prematurely) or unavailable (don't offer a
// control that might not work).
export function useClientCapability(detect: () => boolean): boolean | undefined {
  const [supported, setSupported] = useState<boolean | undefined>(undefined);
  useEffect(() => {
    try { setSupported(detect()); } catch { setSupported(false); }
    // Detection functions are inline literals at every call site; re-running on
    // identity change would loop forever.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return supported;
}
