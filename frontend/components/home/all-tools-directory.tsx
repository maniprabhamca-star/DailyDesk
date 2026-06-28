'use client';

import Link from 'next/link';
import {
  Combine, Split, Shrink, RotateCw, FileMinus, ListOrdered,
  FileImage, Image as ImageIcon, FileType, FileType2, Code2,
  PenLine, Highlighter, Stamp, EyeOff, PenTool, Lock,
  ScanText, MessageSquare, AlignLeft, Languages,
  QrCode, KeyRound, NotebookPen, Flame, Wallet, FolderLock, Link2,
  Cloud, Zap, Sparkles, Search, Wand2, CloudOff, Ban, UserX, Droplets,
  type LucideIcon,
} from 'lucide-react';

type Badge = 'device' | 'offline' | 'memory' | 'ai';
type DTool = { name: string; href?: string; icon: LucideIcon; badge: Badge; soon?: boolean };

const BADGE: Record<Badge, { icon: LucideIcon; color: string; label: string }> = {
  device: { icon: Lock, color: '#16a34a', label: 'Runs in your browser' },
  offline: { icon: Zap, color: '#0284c7', label: 'Works offline' },
  memory: { icon: Cloud, color: '#d97706', label: 'In memory, never stored' },
  ai: { icon: Sparkles, color: '#7c3aed', label: 'AI' },
};

const groups: { label: string; color: string; tools: DTool[] }[] = [
  {
    label: 'Organize PDF', color: '#dc2626', tools: [
      { name: 'Merge PDF', href: '/merge-pdf', icon: Combine, badge: 'device' },
      { name: 'Split PDF', icon: Split, badge: 'device', soon: true },
      { name: 'Compress PDF', icon: Shrink, badge: 'device', soon: true },
      { name: 'Rotate PDF', icon: RotateCw, badge: 'device', soon: true },
      { name: 'Delete pages', icon: FileMinus, badge: 'device', soon: true },
      { name: 'Page numbers', icon: ListOrdered, badge: 'device', soon: true },
    ],
  },
  {
    label: 'Convert', color: '#0284c7', tools: [
      { name: 'JPG to PDF', icon: FileImage, badge: 'device', soon: true },
      { name: 'PDF to JPG', icon: ImageIcon, badge: 'device', soon: true },
      { name: 'PDF to Word', icon: FileType, badge: 'memory', soon: true },
      { name: 'Word to PDF', icon: FileType2, badge: 'memory', soon: true },
      { name: 'HTML to PDF', icon: Code2, badge: 'memory', soon: true },
    ],
  },
  {
    label: 'Edit & sign', color: '#d97706', tools: [
      { name: 'Edit PDF', icon: PenLine, badge: 'device', soon: true },
      { name: 'Annotate', icon: Highlighter, badge: 'device', soon: true },
      { name: 'Watermark', icon: Stamp, badge: 'device', soon: true },
      { name: 'Redact PDF', icon: EyeOff, badge: 'device', soon: true },
      { name: 'Sign PDF', icon: PenTool, badge: 'device', soon: true },
      { name: 'Protect PDF', icon: Lock, badge: 'device', soon: true },
    ],
  },
  {
    label: 'AI & scan', color: '#db2777', tools: [
      { name: 'OCR', icon: ScanText, badge: 'offline', soon: true },
      { name: 'Chat with PDF', icon: MessageSquare, badge: 'ai', soon: true },
      { name: 'Summarize', icon: AlignLeft, badge: 'ai', soon: true },
      { name: 'Translate', icon: Languages, badge: 'ai', soon: true },
    ],
  },
  {
    label: 'Generators', color: '#4f46e5', tools: [
      { name: 'QR generator', href: '/tools/qr-code', icon: QrCode, badge: 'device' },
      { name: 'Password', href: '/tools/password', icon: KeyRound, badge: 'device' },
    ],
  },
  {
    label: 'Workspace', color: '#16a34a', tools: [
      { name: 'Smart notes', icon: NotebookPen, badge: 'device', soon: true },
      { name: 'Habit tracker', icon: Flame, badge: 'device', soon: true },
      { name: 'Budget tracker', icon: Wallet, badge: 'device', soon: true },
      { name: 'File vault', icon: FolderLock, badge: 'memory', soon: true },
      { name: 'Link in bio', icon: Link2, badge: 'memory', soon: true },
    ],
  },
];

function Row({ t, color }: { t: DTool; color: string }) {
  const Icon = t.icon;
  const B = BADGE[t.badge];
  const inner = (
    <div className={`flex items-center gap-2.5 rounded-md px-2 py-1.5 text-sm ${t.soon ? 'opacity-70' : 'hover:bg-accent'}`}>
      <Icon className="size-4 shrink-0" style={{ color }} />
      <span className="flex-1 truncate text-foreground/90">
        {t.name}
        {t.soon && <span className="ml-1.5 text-[10px] font-medium text-muted-foreground">soon</span>}
      </span>
      <B.icon className="size-3.5 shrink-0" style={{ color: B.color }} aria-label={B.label} />
    </div>
  );
  return t.href ? <Link href={t.href}>{inner}</Link> : <div className="cursor-default">{inner}</div>;
}

export function AllToolsDirectory() {
  return (
    <section className="border-t bg-muted/20">
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        {/* Trust strip */}
        <div className="mb-8 flex flex-wrap justify-center gap-x-7 gap-y-2">
          {[
            { icon: CloudOff, t: 'No uploads' },
            { icon: Ban, t: 'No ads' },
            { icon: UserX, t: 'No signup' },
            { icon: Droplets, t: 'No watermark' },
          ].map((x) => (
            <span key={x.t} className="flex items-center gap-1.5 text-sm font-medium text-foreground/80">
              <x.icon className="size-4 text-emerald-600" /> {x.t}
            </span>
          ))}
        </div>

        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-xl font-bold tracking-tight">All tools</h2>
          <button onClick={() => window.dispatchEvent(new Event('dd-command-open'))} className="flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground">
            <Search className="size-3.5" /> Filter…
            <kbd className="rounded border px-1 text-[10px]">⌘K</kbd>
          </button>
        </div>

        {/* Workflows (coming soon) */}
        <div className="mb-7">
          <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-violet-600">
            <Wand2 className="size-3.5" /> Workflows <span className="rounded-full bg-violet-100 px-1.5 py-0.5 text-[9px] text-violet-700 dark:bg-violet-950/50">coming soon</span>
          </p>
          <div className="flex flex-wrap gap-2">
            {['Merge → Compress', 'Scan → OCR → Compress', 'Images → PDF → Sign'].map((w) => (
              <span key={w} className="rounded-full border bg-card px-3 py-1.5 text-xs text-muted-foreground">{w}</span>
            ))}
          </div>
        </div>

        <div className="grid gap-x-6 gap-y-7 sm:grid-cols-2 lg:grid-cols-3">
          {groups.map((g) => (
            <div key={g.label}>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{g.label}</p>
              <div className="space-y-0.5">
                {g.tools.map((t) => <Row key={t.name} t={t} color={g.color} />)}
              </div>
            </div>
          ))}
        </div>

        {/* Legend */}
        <div className="mt-8 flex flex-wrap gap-x-5 gap-y-2 border-t pt-5">
          {(Object.keys(BADGE) as Badge[]).map((k) => {
            const B = BADGE[k];
            return (
              <span key={k} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <B.icon className="size-3.5" style={{ color: B.color }} /> {B.label}
              </span>
            );
          })}
        </div>
      </div>
    </section>
  );
}
