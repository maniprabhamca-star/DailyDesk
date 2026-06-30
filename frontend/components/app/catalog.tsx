import {
  Combine, Split, Shrink, RotateCw, FileMinus, ListOrdered,
  FileImage, Image as ImageIcon, FileType, FileType2, Code2, Presentation, FileSpreadsheet, FileCheck,
  PenLine, Highlighter, Stamp, EyeOff, PenTool, Lock,
  ScanText, MessageSquare, AlignLeft, Languages,
  QrCode, KeyRound, NotebookPen, Flame, Wallet, FolderLock, Link2,
  Cloud, Zap, Sparkles, type LucideIcon,
} from 'lucide-react';

export type Badge = 'device' | 'offline' | 'memory' | 'ai';
export type CatTool = { name: string; href?: string; icon: LucideIcon; badge: Badge; soon?: boolean };
export type CatGroup = { label: string; color: string; tools: CatTool[] };

export const BADGE: Record<Badge, { icon: LucideIcon; color: string; label: string }> = {
  device: { icon: Lock, color: '#16a34a', label: 'Runs in your browser' },
  offline: { icon: Zap, color: '#0284c7', label: 'Works offline' },
  memory: { icon: Cloud, color: '#d97706', label: 'In memory, never stored' },
  ai: { icon: Sparkles, color: '#7c3aed', label: 'AI' },
};

export const catalog: CatGroup[] = [
  {
    label: 'Organize PDF', color: '#dc2626', tools: [
      { name: 'Merge PDF', href: '/merge-pdf', icon: Combine, badge: 'device' },
      { name: 'Split PDF', href: '/split-pdf', icon: Split, badge: 'device' },
      { name: 'Compress PDF', href: '/compress-pdf', icon: Shrink, badge: 'device' },
      { name: 'Rotate PDF', href: '/rotate-pdf', icon: RotateCw, badge: 'device' },
      { name: 'Delete pages', href: '/delete-pages-from-pdf', icon: FileMinus, badge: 'device' },
      { name: 'Page numbers', href: '/add-page-numbers-to-pdf', icon: ListOrdered, badge: 'device' },
    ],
  },
  {
    label: 'Convert to PDF', color: '#0284c7', tools: [
      { name: 'JPG to PDF', href: '/jpg-to-pdf', icon: FileImage, badge: 'device' },
      { name: 'Word to PDF', icon: FileType2, badge: 'memory', soon: true },
      { name: 'PowerPoint to PDF', icon: Presentation, badge: 'memory', soon: true },
      { name: 'Excel to PDF', icon: FileSpreadsheet, badge: 'memory', soon: true },
      { name: 'HTML to PDF', icon: Code2, badge: 'memory', soon: true },
    ],
  },
  {
    label: 'Convert from PDF', color: '#0ea5e9', tools: [
      { name: 'PDF to JPG', href: '/pdf-to-jpg', icon: ImageIcon, badge: 'device' },
      { name: 'PDF to Word', icon: FileType, badge: 'memory', soon: true },
      { name: 'PDF to PowerPoint', icon: Presentation, badge: 'memory', soon: true },
      { name: 'PDF to Excel', icon: FileSpreadsheet, badge: 'memory', soon: true },
      { name: 'PDF to PDF/A', icon: FileCheck, badge: 'memory', soon: true },
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

// Number of tools that are actually ready (have a real route + not flagged "soon").
// Drives every "N tools" count on the home page, so they auto-update as tools ship —
// flip a tool's `soon: true` to a real `href` and the count rises everywhere.
export const liveToolCount = catalog.reduce(
  (n, g) => n + g.tools.filter((t) => !t.soon && !!t.href).length,
  0,
);
