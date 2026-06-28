import {
  QrCode,
  FileText,
  ImageIcon,
  Eraser,
  KeyRound,
  NotebookPen,
  Flame,
  Wallet,
  FolderLock,
  Link2,
  type LucideIcon,
} from 'lucide-react';

export type Tool = {
  id: string;
  name: string;
  href: string;
  icon: LucideIcon;
  available: boolean;
  description: string;
  color: string; // brand hex; tinted for icon chips, works in light + dark
};

export type ToolGroup = { label: string; tools: Tool[] };

// Single source of truth for navigation across the app (sidebar, home, command palette).
export const toolGroups: ToolGroup[] = [
  {
    label: 'Quick tools',
    tools: [
      { id: 'qr-code', name: 'QR generator', href: '/tools/qr-code', icon: QrCode, available: true, description: 'Custom QR codes with logo and bulk export', color: '#4f46e5' },
      { id: 'pdf', name: 'PDF workspace', href: '/tools/pdf', icon: FileText, available: false, description: 'Merge, split, compress, edit and e-sign', color: '#dc2626' },
      { id: 'image-compress', name: 'Image compressor', href: '/tools/image-compress', icon: ImageIcon, available: false, description: 'Shrink JPG, PNG and WebP without quality loss', color: '#0284c7' },
      { id: 'bg-remover', name: 'Background remover', href: '/tools/bg-remover', icon: Eraser, available: false, description: 'Erase image backgrounds automatically', color: '#7c3aed' },
      { id: 'password', name: 'Password generator', href: '/tools/password', icon: KeyRound, available: true, description: 'Generate strong, secure passwords', color: '#059669' },
    ],
  },
  {
    label: 'Workspace',
    tools: [
      { id: 'notes', name: 'Smart notes', href: '/tools/notes', icon: NotebookPen, available: false, description: 'Voice-to-text notes with AI organization', color: '#d97706' },
      { id: 'habits', name: 'Habit tracker', href: '/tools/habits', icon: Flame, available: false, description: 'Track daily habits with streaks and charts', color: '#ea580c' },
      { id: 'budget', name: 'Budget tracker', href: '/tools/budget', icon: Wallet, available: false, description: 'Track spending and scan receipts', color: '#16a34a' },
      { id: 'vault', name: 'File vault', href: '/tools/vault', icon: FolderLock, available: false, description: 'Encrypted personal cloud storage', color: '#475569' },
      { id: 'bio', name: 'Link in bio', href: '/tools/bio', icon: Link2, available: false, description: 'One link for all your links', color: '#db2777' },
    ],
  },
];

export const allTools: Tool[] = toolGroups.flatMap((g) => g.tools);
