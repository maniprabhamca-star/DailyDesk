'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toolGroups } from './tools-config';
import { Button } from '@/components/ui/button';
import { BrandMark } from '@/components/app/brand-mark';

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden md:flex w-60 shrink-0 flex-col border-r bg-card/50 backdrop-blur-sm">
      <div className="flex h-16 items-center gap-2.5 px-5">
        <BrandMark className="size-8" />
        <span className="text-base font-semibold tracking-tight">DailyDesk</span>
      </div>

      <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-2">
        {toolGroups.map((group) => (
          <div key={group.label}>
            <p className="px-3 pb-1.5 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              {group.label}
            </p>
            <div className="space-y-0.5">
              {group.tools.map((tool) => {
                const active = pathname === tool.href;
                const Icon = tool.icon;
                return (
                  <Link
                    key={tool.id}
                    href={tool.available ? tool.href : '#'}
                    aria-disabled={!tool.available}
                    className={cn(
                      'group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                      active
                        ? 'bg-primary/10 text-primary'
                        : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                      !tool.available && 'cursor-not-allowed opacity-50 hover:bg-transparent hover:text-muted-foreground',
                    )}
                  >
                    <Icon className="size-[18px] shrink-0" />
                    <span className="truncate">{tool.name}</span>
                    {!tool.available && (
                      <span className="ml-auto text-[10px] font-medium text-muted-foreground">soon</span>
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="m-3 rounded-xl border border-primary/20 bg-primary/5 p-4">
        <div className="mb-1 flex items-center gap-1.5 text-sm font-semibold text-primary">
          <Sparkles className="size-4" /> Upgrade to Pro
        </div>
        <p className="mb-3 text-xs leading-relaxed text-muted-foreground">
          Unlimited tools, AI features, and storage.
        </p>
        <Button size="sm" className="w-full">
          $4.99 / month
        </Button>
      </div>
    </aside>
  );
}
