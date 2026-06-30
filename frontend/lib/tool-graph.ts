import { Combine, Split, RotateCw, FileMinus, ListOrdered, Shrink, FileImage, Image as ImageIcon, QrCode, KeyRound, type LucideIcon } from 'lucide-react';

// Single source of truth for the live tool set + how tools relate, so the
// "Keep moving" (carry the file forward) and "Keep going" (what's next) rails are
// genuinely CONTEXTUAL — ordered by what actually pairs well after each tool —
// instead of every tool showing the same first-N tiles. Edit the relationships in
// NEXT; both rails update everywhere.

export type Tool = {
  href: string;
  name: string;
  icon: LucideIcon;
  blurb: string; // one-line "what's next" description
  moveLabel: string; // short CTA used by "Keep moving" (carry this file forward)
  acceptsPdf: boolean; // can receive a PDF via handoff? (gates "Keep moving" for PDF outputs)
  // Full Tailwind class strings (JIT needs them literal, not interpolated).
  tile: string;
  chip: string;
};

export const TOOLS: Record<string, Tool> = {
  '/compress-pdf': { href: '/compress-pdf', name: 'Compress PDF', icon: Shrink, blurb: 'Make the file smaller', moveLabel: 'Make it smaller', acceptsPdf: true,
    tile: 'from-teal-500/10 to-teal-500/0 hover:border-teal-500/40', chip: 'bg-teal-500' },
  '/merge-pdf': { href: '/merge-pdf', name: 'Merge PDF', icon: Combine, blurb: 'Join several PDFs into a single file', moveLabel: 'Merge with more', acceptsPdf: true,
    tile: 'from-rose-500/10 to-rose-500/0 hover:border-rose-500/40', chip: 'bg-rose-500' },
  '/split-pdf': { href: '/split-pdf', name: 'Split PDF', icon: Split, blurb: 'Pull out just the pages you need', moveLabel: 'Split pages', acceptsPdf: true,
    tile: 'from-amber-500/10 to-amber-500/0 hover:border-amber-500/40', chip: 'bg-amber-500' },
  '/rotate-pdf': { href: '/rotate-pdf', name: 'Rotate PDF', icon: RotateCw, blurb: 'Fix sideways or upside-down pages', moveLabel: 'Rotate pages', acceptsPdf: true,
    tile: 'from-sky-500/10 to-sky-500/0 hover:border-sky-500/40', chip: 'bg-sky-500' },
  '/delete-pages-from-pdf': { href: '/delete-pages-from-pdf', name: 'Delete Pages', icon: FileMinus, blurb: 'Remove pages you don’t need', moveLabel: 'Remove pages', acceptsPdf: true,
    tile: 'from-red-500/10 to-red-500/0 hover:border-red-500/40', chip: 'bg-red-500' },
  '/add-page-numbers-to-pdf': { href: '/add-page-numbers-to-pdf', name: 'Page numbers', icon: ListOrdered, blurb: 'Stamp numbers on the pages', moveLabel: 'Add page numbers', acceptsPdf: true,
    tile: 'from-violet-500/10 to-violet-500/0 hover:border-violet-500/40', chip: 'bg-violet-500' },
  '/pdf-to-jpg': { href: '/pdf-to-jpg', name: 'PDF to JPG', icon: ImageIcon, blurb: 'Turn pages into crisp images', moveLabel: 'Convert to images', acceptsPdf: true,
    tile: 'from-fuchsia-500/10 to-fuchsia-500/0 hover:border-fuchsia-500/40', chip: 'bg-fuchsia-500' },
  '/jpg-to-pdf': { href: '/jpg-to-pdf', name: 'JPG to PDF', icon: FileImage, blurb: 'Combine images back into one PDF', moveLabel: 'Images to PDF', acceptsPdf: false,
    tile: 'from-indigo-500/10 to-indigo-500/0 hover:border-indigo-500/40', chip: 'bg-indigo-500' },
  '/tools/qr-code': { href: '/tools/qr-code', name: 'QR code', icon: QrCode, blurb: 'Make a scannable QR in seconds', moveLabel: 'Make a QR code', acceptsPdf: false,
    tile: 'from-emerald-500/10 to-emerald-500/0 hover:border-emerald-500/40', chip: 'bg-emerald-500' },
  '/tools/password': { href: '/tools/password', name: 'Password', icon: KeyRound, blurb: 'Generate a strong, private password', moveLabel: 'Make a password', acceptsPdf: false,
    tile: 'from-violet-500/10 to-violet-500/0 hover:border-violet-500/40', chip: 'bg-violet-500' },
};

// Curated "what makes sense next" per tool, ordered by real workflow relevance.
const NEXT: Record<string, string[]> = {
  '/compress-pdf': ['/split-pdf', '/merge-pdf', '/add-page-numbers-to-pdf', '/rotate-pdf', '/pdf-to-jpg'],
  '/merge-pdf': ['/compress-pdf', '/add-page-numbers-to-pdf', '/split-pdf', '/rotate-pdf'],
  '/split-pdf': ['/merge-pdf', '/compress-pdf', '/rotate-pdf', '/delete-pages-from-pdf'],
  '/rotate-pdf': ['/compress-pdf', '/split-pdf', '/merge-pdf', '/pdf-to-jpg'],
  '/delete-pages-from-pdf': ['/compress-pdf', '/merge-pdf', '/add-page-numbers-to-pdf', '/split-pdf'],
  '/add-page-numbers-to-pdf': ['/compress-pdf', '/merge-pdf', '/split-pdf', '/rotate-pdf'],
  '/pdf-to-jpg': ['/jpg-to-pdf', '/compress-pdf', '/split-pdf'],
  '/jpg-to-pdf': ['/compress-pdf', '/merge-pdf', '/add-page-numbers-to-pdf', '/rotate-pdf'],
  '/tools/qr-code': ['/tools/password', '/compress-pdf', '/pdf-to-jpg'],
  '/tools/password': ['/tools/qr-code', '/compress-pdf', '/merge-pdf'],
};

// Sensible fallback order for any tool without an explicit list (and to backfill
// short lists), so a rail is never empty.
const DEFAULT_ORDER = ['/compress-pdf', '/merge-pdf', '/split-pdf', '/pdf-to-jpg', '/rotate-pdf', '/add-page-numbers-to-pdf', '/delete-pages-from-pdf', '/jpg-to-pdf', '/tools/qr-code', '/tools/password'];

// Ordered, de-duplicated, self-excluded list of relevant next tools. Backfilled
// from DEFAULT_ORDER so it's never short or empty.
export function nextFor(current: string | undefined, limit = 3): Tool[] {
  const order = (current && NEXT[current]) ? NEXT[current] : DEFAULT_ORDER;
  const seen = new Set<string>();
  const out: Tool[] = [];
  const push = (href: string) => {
    const tool = TOOLS[href];
    if (tool && href !== current && !seen.has(href)) { seen.add(href); out.push(tool); }
  };
  order.forEach(push);
  DEFAULT_ORDER.forEach(push); // backfill
  return out.slice(0, limit);
}
