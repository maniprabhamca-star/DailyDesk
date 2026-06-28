import { LayoutGrid } from 'lucide-react';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { HeaderUser } from '@/components/app/header-user';

export function ToolHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-4 border-b bg-background/80 px-4 backdrop-blur-md sm:px-6">
      <div className="flex items-center gap-2.5 min-w-0">
        <span className="flex size-7 items-center justify-center rounded-lg bg-primary text-primary-foreground md:hidden">
          <LayoutGrid className="size-4" />
        </span>
        <div className="min-w-0">
          <h1 className="truncate text-base font-semibold leading-tight sm:text-lg">{title}</h1>
          {subtitle && <p className="truncate text-xs text-muted-foreground sm:text-sm">{subtitle}</p>}
        </div>
      </div>
      <div className="flex items-center gap-2">
        <ThemeToggle />
        <HeaderUser />
      </div>
    </header>
  );
}
