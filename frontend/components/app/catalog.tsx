import {
  Combine, Split, Shrink, RotateCw, FileMinus, ListOrdered, Eye,
  FileImage, Image as ImageIcon, FileType, FileType2, Code2, Presentation, FileSpreadsheet, FileCheck,
  PenLine, Highlighter, Stamp, EyeOff, PenTool, Lock, Unlock, Fingerprint, Layers, ScanLine, ShieldCheck,
  ScanText, MessageSquare, AlignLeft, Languages, HelpCircle,
  QrCode, KeyRound, NotebookPen, Flame, Wallet, FolderLock, Link2,
  ImageDown, Smartphone, Eraser, Film, Clapperboard, ArrowLeftRight, Images, Scaling, Repeat, Crop,
  Ruler, Braces, Palette, CaseSensitive, Crosshair, Contact, SquarePen, ScanFace,
  Binary, Hash, GitCompare, FileJson, Type,
  Cloud, Sparkles, Landmark, type LucideIcon,
} from 'lucide-react';

// A tool's "where it runs" tag — the single source of truth for every privacy
// badge on the site. Keep it HONEST: only client-side tools get 'device'
// ("files never uploaded"); anything that reaches a server is 'server', 'ai',
// or 'encrypted' so no blanket in-browser claim is ever over-applied.
export type Badge = 'device' | 'server' | 'ai' | 'encrypted';
export type CatTool = { name: string; href?: string; icon: LucideIcon; badge: Badge; soon?: boolean };
export type CatGroup = { label: string; color: string; tools: CatTool[] };

export const BADGE: Record<Badge, { icon: LucideIcon; color: string; label: string }> = {
  device: { icon: Lock, color: '#16a34a', label: 'Runs in your browser' },
  server: { icon: Cloud, color: '#d97706', label: 'Processed on our servers' },
  ai: { icon: Sparkles, color: '#7c3aed', label: 'AI-powered' },
  encrypted: { icon: KeyRound, color: '#2563eb', label: 'End-to-end encrypted' },
};

// The premium tier — owner-only until Pro launches: the deep editors, OCR and the
// AI tools. Search surfaces (⌘K palette, header search) badge these "Pro" and send
// free users to pricing instead of a dead end. Keep in sync with the pro-launch
// checklist. Matched by tool name.
export const PRO_TOOLS = new Set(['Edit PDF', 'Redact PDF', 'OCR', 'Chat with PDF', 'Summarize', 'Translate', 'File vault', 'Link in bio']);

export const catalog: CatGroup[] = [
  {
    label: 'Organize PDF', color: '#dc2626', tools: [
      { name: 'PDF viewer', href: '/pdf-viewer', icon: Eye, badge: 'device' },
      { name: 'Merge PDF', href: '/merge-pdf', icon: Combine, badge: 'device' },
      { name: 'Split PDF', href: '/split-pdf', icon: Split, badge: 'device' },
      { name: 'Compress PDF', href: '/compress-pdf', icon: Shrink, badge: 'device' },
      { name: 'Compress to size', href: '/compress-to-size', icon: Crosshair, badge: 'device' },
      { name: 'Rotate PDF', href: '/rotate-pdf', icon: RotateCw, badge: 'device' },
      { name: 'Reorder pages', href: '/reorder-pdf', icon: ArrowLeftRight, badge: 'device' },
      { name: 'Compare PDF', href: '/compare-pdf', icon: ArrowLeftRight, badge: 'device', soon: true },
      { name: 'Delete pages', href: '/delete-pages-from-pdf', icon: FileMinus, badge: 'device' },
      { name: 'Crop PDF', href: '/crop-pdf', icon: Crop, badge: 'device', soon: true },
      { name: 'Page numbers', href: '/add-page-numbers-to-pdf', icon: ListOrdered, badge: 'device' },
    ],
  },
  {
    label: 'Convert to PDF', color: '#0284c7', tools: [
      { name: 'JPG to PDF', href: '/jpg-to-pdf', icon: FileImage, badge: 'device' },
      { name: 'Word to PDF', href: '/word-to-pdf', icon: FileType2, badge: 'server' },
      { name: 'PowerPoint to PDF', href: '/powerpoint-to-pdf', icon: Presentation, badge: 'server' },
      { name: 'Excel to PDF', href: '/excel-to-pdf', icon: FileSpreadsheet, badge: 'server' },
      { name: 'HTML to PDF', href: '/html-to-pdf', icon: Code2, badge: 'server', soon: true },
    ],
  },
  {
    label: 'Convert from PDF', color: '#0ea5e9', tools: [
      { name: 'PDF to JPG', href: '/pdf-to-jpg', icon: ImageIcon, badge: 'device' },
      { name: 'Extract images', href: '/extract-images-from-pdf', icon: Images, badge: 'device' },
      { name: 'PDF to Word', href: '/pdf-to-word', icon: FileType, badge: 'server' },
      { name: 'PDF to PowerPoint', icon: Presentation, badge: 'server', soon: true },
      { name: 'PDF to Excel', href: '/pdf-to-excel', icon: FileSpreadsheet, badge: 'device' },
      { name: 'Bank statement to Excel', href: '/bank-statement-converter', icon: Landmark, badge: 'device', soon: true },
      { name: 'PDF to PDF/A', icon: FileCheck, badge: 'server', soon: true },
    ],
  },
  {
    label: 'Edit & sign', color: '#d97706', tools: [
      { name: 'Edit PDF', icon: PenLine, badge: 'device', soon: true },
      { name: 'Annotate', href: '/annotate-pdf', icon: Highlighter, badge: 'device', soon: true },
      { name: 'Watermark', href: '/watermark-pdf', icon: Stamp, badge: 'device' },
      { name: 'Remove metadata', href: '/remove-pdf-metadata', icon: Fingerprint, badge: 'device' },
      { name: 'Share-Safe PDF Check', href: '/share-safe-pdf-check', icon: ShieldCheck, badge: 'device', soon: true },
      { name: 'Redact PDF', href: '/redact-pdf', icon: EyeOff, badge: 'device', soon: true },
      { name: 'Sign PDF', href: '/sign-pdf', icon: PenTool, badge: 'device' },
      { name: 'Fill PDF form', href: '/fill-pdf-form', icon: SquarePen, badge: 'device' },
      { name: 'Flatten PDF', href: '/flatten-pdf', icon: Layers, badge: 'device' },
      { name: 'Protect PDF', href: '/protect-pdf', icon: Lock, badge: 'device' },
      { name: 'Unlock PDF', href: '/unlock-pdf', icon: Unlock, badge: 'device' },
    ],
  },
  {
    label: 'AI & scan', color: '#db2777', tools: [
      { name: 'Clean scanned PDF', href: '/clean-scanned-pdf', icon: ScanText, badge: 'device', soon: true },
      { name: 'OCR', icon: ScanText, badge: 'server', soon: true },
      { name: 'Chat with PDF', href: '/chat-pdf', icon: MessageSquare, badge: 'ai', soon: true },
      { name: 'Summarize', href: '/summarize-pdf', icon: AlignLeft, badge: 'ai', soon: true },
      { name: 'Translate', href: '/translate-pdf', icon: Languages, badge: 'ai', soon: true },
      { name: 'Question generator', href: '/pdf-question-generator', icon: HelpCircle, badge: 'ai', soon: true },
    ],
  },
  {
    label: 'Generators', color: '#4f46e5', tools: [
      { name: 'QR generator', href: '/qr-code-generator', icon: QrCode, badge: 'device' },
      { name: 'QR scanner', href: '/scan-qr-code', icon: ScanLine, badge: 'device' },
      { name: 'Password', href: '/password-generator', icon: KeyRound, badge: 'device' },
    ],
  },
  {
    // Beyond-PDF differentiators — media tools that competitors only offer
    // with an upload; ours run on-device (ffmpeg.wasm / codecs in the browser).
    label: 'Images & media', color: '#ea580c', tools: [
      { name: 'Compress image', href: '/compress-image', icon: ImageDown, badge: 'device' },
      { name: 'Resize image', href: '/resize-image', icon: Scaling, badge: 'device' },
      { name: 'Crop image', href: '/crop-image', icon: Crop, badge: 'device' },
      { name: 'Convert image', href: '/convert-image', icon: Repeat, badge: 'device' },
      { name: 'HEIC to JPG', href: '/heic-to-jpg', icon: Smartphone, badge: 'device' },
      { name: 'Background remover', href: '/remove-background', icon: Eraser, badge: 'device' },
      { name: 'Passport & ID photo', href: '/passport-photo', icon: Contact, badge: 'device' },
      { name: 'Blur & remove metadata', href: '/photo-privacy', icon: ScanFace, badge: 'device' },
      { name: 'Compress video', href: '/compress-video', icon: Film, badge: 'device' },
      { name: 'Video to GIF', href: '/video-to-gif', icon: Clapperboard, badge: 'device' },
    ],
  },
  {
    label: 'Everyday utilities', color: '#0d9488', tools: [
      { name: 'Word counter', href: '/word-counter', icon: CaseSensitive, badge: 'device' },
      { name: 'Unit converter', href: '/unit-converter', icon: Ruler, badge: 'device' },
      { name: 'JSON formatter', href: '/json-formatter', icon: Braces, badge: 'device' },
      { name: 'Color picker', href: '/color-picker', icon: Palette, badge: 'device' },
    ],
  },
  {
    label: 'Developer tools', color: '#4f46e5', tools: [
      { name: 'Base64', href: '/base64', icon: Binary, badge: 'device' },
      { name: 'URL encode', href: '/url-encode', icon: Link2, badge: 'device' },
      { name: 'HTML entities', href: '/html-entities', icon: Code2, badge: 'device' },
      { name: 'Hash generator', href: '/hash-generator', icon: Hash, badge: 'device' },
      { name: 'JWT decoder', href: '/jwt-decoder', icon: KeyRound, badge: 'device' },
      { name: 'UUID generator', href: '/uuid-generator', icon: Fingerprint, badge: 'device' },
      { name: 'CSV to JSON', href: '/csv-to-json', icon: FileJson, badge: 'device' },
      { name: 'Text diff', href: '/text-diff', icon: GitCompare, badge: 'device' },
      { name: 'Timestamp', href: '/timestamp-converter', icon: Ruler, badge: 'device' },
      { name: 'JSON to YAML', href: '/json-to-yaml', icon: Braces, badge: 'device' },
      { name: 'CSV cleaner', href: '/csv-cleaner', icon: FileSpreadsheet, badge: 'device' },
      { name: 'Case converter', href: '/case-converter', icon: Type, badge: 'device' },
      { name: 'Slugify', href: '/slugify', icon: Link2, badge: 'device' },
      { name: 'Sort lines', href: '/sort-lines', icon: ListOrdered, badge: 'device' },
      { name: 'Regex tester', href: '/regex-tester', icon: Code2, badge: 'device' },
      { name: 'Lorem ipsum', href: '/lorem-ipsum', icon: Type, badge: 'device' },
    ],
  },
  {
    label: 'Workspace', color: '#16a34a', tools: [
      { name: 'Smart notes', icon: NotebookPen, badge: 'device', soon: true },
      { name: 'Habit tracker', icon: Flame, badge: 'device', soon: true },
      { name: 'Budget tracker', icon: Wallet, badge: 'device', soon: true },
      { name: 'Client packet builder', href: '/client-packet-builder', icon: FolderLock, badge: 'device', soon: true },
      { name: 'File vault', icon: FolderLock, badge: 'encrypted', soon: true },
      { name: 'Link in bio', icon: Link2, badge: 'server', soon: true },
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
