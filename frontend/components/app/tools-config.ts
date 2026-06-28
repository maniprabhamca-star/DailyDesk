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
};

export type ToolGroup = { label: string; tools: Tool[] };

// Single source of truth for navigation across the app (sidebar, landing, mobile nav).
export const toolGroups: ToolGroup[] = [
  {
    label: 'Tools',
    tools: [
      { id: 'qr-code', name: 'QR generator', href: '/tools/qr-code', icon: QrCode, available: true },
      { id: 'pdf', name: 'PDF workspace', href: '/tools/pdf', icon: FileText, available: false },
      { id: 'image-compress', name: 'Image compress', href: '/tools/image-compress', icon: ImageIcon, available: false },
      { id: 'bg-remover', name: 'Background remover', href: '/tools/bg-remover', icon: Eraser, available: false },
      { id: 'password', name: 'Password generator', href: '/tools/password', icon: KeyRound, available: true },
    ],
  },
  {
    label: 'Workspace',
    tools: [
      { id: 'notes', name: 'Smart notes', href: '/tools/notes', icon: NotebookPen, available: false },
      { id: 'habits', name: 'Habit tracker', href: '/tools/habits', icon: Flame, available: false },
      { id: 'budget', name: 'Budget tracker', href: '/tools/budget', icon: Wallet, available: false },
      { id: 'vault', name: 'File vault', href: '/tools/vault', icon: FolderLock, available: false },
      { id: 'bio', name: 'Link in bio', href: '/tools/bio', icon: Link2, available: false },
    ],
  },
];

export const allTools: Tool[] = toolGroups.flatMap((g) => g.tools);
