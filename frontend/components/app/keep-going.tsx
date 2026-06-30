import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { nextFor } from '@/lib/tool-graph';

// A reusable "what's next" rail for tool result pages. Drop it on any tool's
// done-screen with the current tool's href in `exclude`. Suggestions are now
// genuinely CONTEXTUAL — ordered per-tool by what pairs well next (see
// lib/tool-graph). Only LIVE tools are listed, so there are never dead-end links.
// Premium gradient tiles, fully responsive (1 col on phones, up to 3 on desktop).

export function KeepGoing({ exclude, limit = 3, title = 'Keep going' }: { exclude?: string; limit?: number; title?: string }) {
  const items = nextFor(exclude, limit);
  if (items.length === 0) return null;

  return (
    <div className="mt-6 border-t pt-5">
      <div className="mb-3 flex items-baseline justify-between">
        <h3 className="text-sm font-semibold">{title}</h3>
        <Link href="/#tools" className="text-xs font-medium text-primary hover:underline">All tools</Link>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((t) => (
          <Link
            key={t.href}
            href={t.href}
            className={`group relative flex items-center gap-3 overflow-hidden rounded-2xl border bg-gradient-to-br ${t.tile} p-3.5 shadow-soft transition-all hover:-translate-y-0.5 hover:shadow-md`}
          >
            <span className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${t.chip} text-white shadow-sm`}>
              <t.icon className="size-5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold">{t.name}</span>
              <span className="block text-xs text-muted-foreground">{t.blurb}</span>
            </span>
            <ArrowRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
          </Link>
        ))}
      </div>
    </div>
  );
}
