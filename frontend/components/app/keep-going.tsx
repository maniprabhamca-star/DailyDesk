import Link from 'next/link';
import { ArrowRight, Combine, Split, RotateCw, FileMinus, FileImage, Image as ImageIcon, QrCode, KeyRound, type LucideIcon } from 'lucide-react';

// A reusable "what's next" rail for tool result pages. Drop it on any tool's
// done-screen with the current tool's href in `exclude`. Only LIVE tools are
// listed, so there are never dead-end links. Premium gradient tiles, fully
// responsive (1 col on phones, up to 3 on desktop).

type Suggestion = {
  name: string;
  href: string;
  icon: LucideIcon;
  blurb: string;
  // Full Tailwind class strings (JIT needs them literal, not interpolated).
  tile: string;
  chip: string;
};

// Curated, ordered by how often they pair well together. Edit here once and
// every tool's rail updates.
const LIVE: Suggestion[] = [
  { name: 'JPG to PDF', href: '/jpg-to-pdf', icon: FileImage, blurb: 'Combine images back into one PDF',
    tile: 'from-indigo-500/10 to-indigo-500/0 hover:border-indigo-500/40', chip: 'bg-indigo-500' },
  { name: 'Merge PDF', href: '/merge-pdf', icon: Combine, blurb: 'Join several PDFs into a single file',
    tile: 'from-rose-500/10 to-rose-500/0 hover:border-rose-500/40', chip: 'bg-rose-500' },
  { name: 'Split PDF', href: '/split-pdf', icon: Split, blurb: 'Pull out just the pages you need',
    tile: 'from-amber-500/10 to-amber-500/0 hover:border-amber-500/40', chip: 'bg-amber-500' },
  { name: 'Rotate PDF', href: '/rotate-pdf', icon: RotateCw, blurb: 'Fix sideways or upside-down pages',
    tile: 'from-sky-500/10 to-sky-500/0 hover:border-sky-500/40', chip: 'bg-sky-500' },
  { name: 'Delete Pages', href: '/delete-pages-from-pdf', icon: FileMinus, blurb: 'Remove pages you don’t need',
    tile: 'from-red-500/10 to-red-500/0 hover:border-red-500/40', chip: 'bg-red-500' },
  { name: 'PDF to JPG', href: '/pdf-to-jpg', icon: ImageIcon, blurb: 'Turn pages into crisp images',
    tile: 'from-fuchsia-500/10 to-fuchsia-500/0 hover:border-fuchsia-500/40', chip: 'bg-fuchsia-500' },
  { name: 'QR code', href: '/tools/qr-code', icon: QrCode, blurb: 'Make a scannable QR in seconds',
    tile: 'from-emerald-500/10 to-emerald-500/0 hover:border-emerald-500/40', chip: 'bg-emerald-500' },
  { name: 'Password', href: '/tools/password', icon: KeyRound, blurb: 'Generate a strong, private password',
    tile: 'from-violet-500/10 to-violet-500/0 hover:border-violet-500/40', chip: 'bg-violet-500' },
];

export function KeepGoing({ exclude, limit = 3, title = 'Keep going' }: { exclude?: string; limit?: number; title?: string }) {
  const items = LIVE.filter((t) => t.href !== exclude).slice(0, limit);
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
