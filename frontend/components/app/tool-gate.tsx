'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { Clock, Wrench } from 'lucide-react';
import { useToolStatus } from '@/lib/tool-flags';
import { Button } from '@/components/ui/button';

// Wraps a tool's interactive area. If the admin has set this tool's status to
// 'coming_soon' or 'disabled', it shows a friendly panel instead of the tool.
// 'enabled' and 'pro' pass through (Pro gating is handled separately by billing).
export function ToolGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const status = useToolStatus(pathname);

  if (status === 'enabled' || status === 'pro') return <>{children}</>;

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
