'use client';

import { ArrowRight, Layers, Zap, type LucideIcon } from 'lucide-react';

// "Keep moving" — chained-workflow actions on a tool's results screen. Each
// action carries the real result files straight into the next tool with no
// re-upload (see lib/handoff.ts). Visual emphasises the instant in-browser flow.

export type MoveAction = {
  count: number; // how many files flow forward
  fromIcon: LucideIcon; // source artifact icon (e.g. images)
  toIcon: LucideIcon; // destination tool icon
  toName: string; // destination tool name
  label: string; // CTA, e.g. "Combine into a PDF"
  blurb: string; // one line on what happens
  onClick: () => void;
};

export function KeepMoving({ actions }: { actions: MoveAction[] }) {
  if (actions.length === 0) return null;

  return (
    <div className="mt-6 rounded-2xl border border-primary/25 bg-gradient-to-br from-primary/[0.07] to-transparent p-4">
      <div className="mb-3 flex items-center gap-2">
        <span className="flex size-6 items-center justify-center rounded-md bg-primary/15 text-primary"><Zap className="size-3.5" /></span>
        <h3 className="text-sm font-semibold">Keep moving</h3>
        <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">no re-upload</span>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {actions.map((a, i) => (
          <button
            key={i}
            type="button"
            onClick={a.onClick}
            className="group flex flex-col gap-3 rounded-xl border bg-card p-4 text-left shadow-soft transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md"
          >
            {/* flow: [N files] → [tool] */}
            <div className="flex items-center gap-2.5">
              <span className="relative flex size-10 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                <a.fromIcon className="size-5" />
                {a.count > 1 && (
                  <span className="absolute -right-1.5 -top-1.5 flex min-w-[18px] items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">{a.count}</span>
                )}
              </span>
              <ArrowRight className="size-4 text-primary transition-transform group-hover:translate-x-0.5" />
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
                <a.toIcon className="size-5" />
              </span>
              <span className="ml-1 min-w-0">
                <span className="block text-sm font-semibold leading-tight">{a.label}</span>
                <span className="block text-xs text-muted-foreground">{a.toName}</span>
              </span>
            </div>
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Layers className="size-3.5 shrink-0" />
              {a.blurb}
            </p>
          </button>
        ))}
      </div>
    </div>
  );
}
