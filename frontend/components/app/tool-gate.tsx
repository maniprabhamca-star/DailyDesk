'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { Clock, Wrench, EyeOff } from 'lucide-react';
import { useToolStatus } from '@/lib/tool-flags';
import { useIsOwner } from '@/lib/plan';
import { Button } from '@/components/ui/button';

// Wraps a tool's interactive area. If the admin set this tool to 'coming_soon'
// or 'disabled', the PUBLIC sees a friendly panel — but the OWNER still sees and
// can use the real tool (with a "hidden from public" ribbon), so tools can be
// built and tested in production before being enabled at launch.
// 'enabled' and 'pro' pass through (Pro gating is handled separately by billing).
export function ToolGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const status = useToolStatus(pathname);
  const isOwner = useIsOwner();

  if (status === 'enabled' || status === 'pro') return <>{children}</>;

  // Owner bypass: show the real tool + a private-preview ribbon.
  if (isOwner) {
    return (
      <div>
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-amber-400/40 bg-amber-400/10 px-3 py-2 text-xs font-medium text-amber-700 dark:text-amber-400">
          <EyeOff className="size-4 shrink-0" />
          Hidden from the public ({status === 'disabled' ? 'disabled' : 'coming soon'}) — only you can see this. Enable it in the admin when ready.
        </div>
        {children}
      </div>
    );
  }

  const disabled = status === 'disabled';
  const Icon = disabled ? Wrench : Clock;
  return (
    <div className="rounded-2xl border bg-card p-10 text-center shadow-soft">
      <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
        <Icon className="size-6" />
      </span>
      <h2 className="mt-4 text-lg font-bold">{disabled ? 'Temporarily unavailable' : 'Coming soon'}</h2>
      <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
        {disabled
          ? 'This tool is briefly offline for maintenance — please check back shortly.'
          : 'This tool isn’t available just yet — it’s on the way. Meanwhile, explore the other free tools.'}
      </p>
      <Button asChild className="mt-5"><Link href="/#tools">Browse all tools</Link></Button>
    </div>
  );
}
