import Link from 'next/link';
import { ShowcasePanel } from './showcase-panel';
import { BrandMark } from '@/components/app/brand-mark';

export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-background">
      <ShowcasePanel />
      <div className="flex flex-1 flex-col items-center justify-center px-5 py-10">
        {/* Mobile brand header (panel is hidden on small screens) */}
        <Link href="/" className="mb-8 flex items-center gap-2 md:hidden">
          <BrandMark className="size-8" />
          <span className="text-lg font-semibold">DailyDesk</span>
        </Link>
        <div className="w-full max-w-sm">{children}</div>
      </div>
    </div>
  );
}
