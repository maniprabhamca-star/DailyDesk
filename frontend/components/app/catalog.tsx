import {
  Combine, Split, Shrink, RotateCw, FileMinus, ListOrdered,
  FileImage, Image as ImageIcon, FileType, FileType2, Code2,
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
      { name: 'Compress PDF', icon: Shrink, badge: 'device', soon: true },
      { name: 'Rotate PDF', href: '/rotate-pdf', icon: RotateCw, badge: 'device' },
      { name: 'Delete pages', icon: FileMinus, badge: 'device', soon: true },
      { name: 'Page numbers', icon: ListOrdered, badge: 'device', soon: true },
    ],
  },
  {
    label: 'Convert', color: '#0284c7', tools: [
      { name: 'JPG to PDF', href: '/jpg-to-pdf', icon: FileImage, badge: 'device' },
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
