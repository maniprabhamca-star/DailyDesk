'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { takeFile, deliverTo } from '@/lib/pending-file';

// Delivers the file the app bar picked to whatever tool the route landed on.
//
// Mounted once in the layout rather than in each tool, because the alternative
// is editing a hundred tools to accept an injected file — and every one of them
// already listens for `change` on its own input, which is the same contract.

export function PendingFileHandoff() {
  const pathname = usePathname();

  useEffect(() => {
    const f = takeFile();
    if (!f) return;
    void deliverTo(f);
  }, [pathname]);

  return null;
}
