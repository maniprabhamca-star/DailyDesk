'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { pushRecent } from '@/lib/recent';
import { catalog } from '@/components/app/catalog';

// Set of real tool routes, so we only record actual tool visits (not home/pricing/etc.).
const TOOL_HREFS = new Set(
  catalog.flatMap((g) => g.tools.map((t) => t.href).filter((h): h is string => !!h)),
);

// Records the current route as "recent" when it's a tool page. Mounted once in the
// root layout; powers the command palette's Recent section. Local-only.
export function RecordRecent() {
  const pathname = usePathname();
  useEffect(() => {
    if (pathname && TOOL_HREFS.has(pathname)) pushRecent(pathname);
  }, [pathname]);
  return null;
}
