import { FolderOpen,
  Combine, Split, Shrink, RotateCw, FileMinus, ListOrdered, Eye,
  FileImage, Image as ImageIcon, FileType, FileType2, Code2, Presentation, FileSpreadsheet, FileCheck,
  PenLine, Highlighter, Stamp, EyeOff, PenTool, Lock, Unlock, Fingerprint, Layers, ScanLine, ShieldCheck,
  ScanText, MessageSquare, AlignLeft, Languages, HelpCircle, Wrench, Camera, ReceiptText,
  QrCode, KeyRound, NotebookPen, Flame, Wallet, FolderLock, Link2, Workflow,
  ImageDown, Smartphone, Eraser, Film, Clapperboard, ArrowLeftRight, Images, Scaling, Repeat, Crop,
  Ruler, Braces, Palette, CaseSensitive, Crosshair, Contact, SquarePen, ScanFace,
  Binary, Hash, GitCompare, FileJson, Type,
  Cloud, CloudOff, Sparkles, Landmark, Volume2, BookOpen, Table2, Music, AudioLines, Shapes, Captions,
  Scissors, Grid2x2, Tags, ListTree, type LucideIcon } from 'lucide-react';

// A tool's "where it runs" tag — the single source of truth for every privacy
// badge on the site. Keep it HONEST: only client-side tools get 'device'
// ("files never uploaded"); anything that reaches a server is 'server', 'ai',
// or 'encrypted' so no blanket in-browser claim is ever over-applied.
export type Badge = 'device' | 'server' | 'ai' | 'encrypted' | 'account';
export type CatTool = {
  name: string;
  href?: string;
  icon: LucideIcon;
  badge: Badge;
  soon?: boolean;
  /** The day this tool shipped, yyyy-mm-dd. Drives the "New" chip. */
  since?: string;
};

export type CatGroup = { label: string; color: string; tools: CatTool[] };

/** How long a freshly shipped tool wears the "New" chip. */
export const NEW_FOR_DAYS = 30;

/**
 * Is this tool still worth flagging as new?
 *
 * Date-based on purpose. A "New!" chip added by hand is a chip somebody has to
 * remember to remove, and nobody ever does — so it quietly becomes furniture and
 * stops meaning anything.
 *
 * This used to be `newUntil`, an expiry date. That asked the wrong question at
 * the wrong moment: the person shipping a tool had to decide when its chip
 * should die, so nine tools shipped in two days with no date at all and not one
 * of them was ever flagged. `since` is a fact you already know while you are
 * adding the row, the window is policy in one place, and tool-facts.test.ts
 * fails if a tool in the changelog's last 30 days is missing it.
 */
export const isNewTool = (t: CatTool): boolean => {
  if (!t.since) return false;
  const shipped = Date.parse(`${t.since}T00:00:00Z`);
  if (Number.isNaN(shipped)) return false;
  const age = Date.now() - shipped;
  return age >= 0 && age < NEW_FOR_DAYS * 24 * 60 * 60 * 1000;
};

/**
 * The "New" chip, in one place because it renders in four (menu, tools
 * directory, header search, ⌘K palette) and four copies drift.
 *
 * A tint rather than a solid fill. Solid primary put "New" at the same visual
 * weight as the Pro chip, so a free tool shouted as loudly as the paid signal —
 * and with a dozen tools carrying it at once it took over the grid. The order
 * that should read is Pro, then New, then "soon". Text contrast is 5.3:1 light
 * and 5.7:1 dark, both past AA for this size; `text-primary` resolves to the
 * lighter --primary-text token in dark mode via globals.css.
 */
const NEW_CHIP_BASE = 'shrink-0 rounded bg-primary/10 font-bold text-primary ring-1 ring-inset ring-primary/20 dark:bg-primary/20 dark:ring-primary/30';
export const NEW_CHIP = `${NEW_CHIP_BASE} px-1.5 py-0.5 text-[10px]`;
/** Denser variant for the mega-menu's 24px rows. */
export const NEW_CHIP_SM = `${NEW_CHIP_BASE} ml-auto px-1 py-px text-[9px]`;

/**
 * Where a tool runs, as one icon in the corner of its card.
 *
 * `device` used to be a padlock, and a real customer asked why the tool was
 * locked. He was not misreading it — a padlock in the top-right corner of a
 * card is where every paywalled app puts its "locked" badge, so the convention
 * said "you cannot use this" while we meant "this is private". It also sat
 * badly next to `encrypted`, which is a key: two security symbols, neither
 * obviously the privacy one.
 *
 * It is now a crossed-out cloud, which makes `device` and `server` the same
 * metaphor with an on/off state — cloud means it goes to our servers, cloud
 * with a line through it means it never leaves your machine. That reads
 * without the legend, which matters, because the legend is at the bottom of
 * the page and the cards are at the top.
 *
 * `hint` is the sentence shown on hover. The icon alone can only ever be a
 * reminder of something you already know; the hint is where the promise is
 * actually made.
 */
export const BADGE: Record<Badge, { icon: LucideIcon; color: string; label: string; hint: string }> = {
  device: { icon: CloudOff, color: '#16a34a', label: 'Runs in your browser', hint: 'Runs in your browser — your file never leaves your device and is never uploaded.' },
  server: { icon: Cloud, color: '#d97706', label: 'Processed on our servers', hint: 'Sent to our server over an encrypted connection, converted, then deleted immediately.' },
  ai: { icon: Sparkles, color: '#7c3aed', label: 'AI-powered', hint: 'Uses AI, and only when you ask it to.' },
  encrypted: { icon: KeyRound, color: '#2563eb', label: 'End-to-end encrypted', hint: 'Encrypted on your device before it is stored — only you can unlock it.' },
  account: { icon: Cloud, color: '#0891b2', label: 'Synced to your account', hint: 'Saved to your DiemDesk account so it follows you between devices.' },
};

// The premium tier — owner-only until Pro launches: the deep editors, OCR and the
// AI tools. Search surfaces (⌘K palette, header search) badge these "Pro" and send
// free users to pricing instead of a dead end. Keep in sync with the pro-launch
// checklist. Matched by tool name.
export const PRO_TOOLS = new Set(['Edit PDF', 'Redact PDF', 'OCR', 'Chat with PDF', 'Summarize', 'Translate', 'Question generator', 'File vault', 'Link in bio', 'Receipt scanner', 'Workflows']);

export const catalog: CatGroup[] = [
  {
    label: 'Organize PDF', color: '#dc2626', tools: [
      { name: 'PDF viewer', href: '/pdf-viewer', icon: Eye, badge: 'device' },
      { name: 'Merge PDF', href: '/merge-pdf', icon: Combine, badge: 'device' },
      { name: 'Split PDF', href: '/split-pdf', icon: Split, badge: 'device' },
      { name: 'Compress PDF', href: '/compress-pdf', icon: Shrink, badge: 'device' },
      { name: 'Compress to size', href: '/compress-to-size', icon: Crosshair, badge: 'device', since: '2026-08-22' },
      { name: 'Rotate PDF', href: '/rotate-pdf', icon: RotateCw, badge: 'device' },
      { name: 'Reorder pages', href: '/reorder-pdf', icon: ArrowLeftRight, badge: 'device' },
      { name: 'Compare PDF', href: '/compare-pdf', icon: ArrowLeftRight, badge: 'device', soon: true },
      { name: 'Delete pages', href: '/delete-pages-from-pdf', icon: FileMinus, badge: 'device' },
      { name: 'Split pages in half', href: '/split-pages-in-half', icon: Scissors, badge: 'device', since: '2026-08-26' },
      { name: 'Pages per sheet', href: '/pages-per-sheet', icon: Grid2x2, badge: 'device', since: '2026-08-26' },
      { name: 'Change page size', href: '/change-pdf-page-size', icon: Ruler, badge: 'device', since: '2026-08-26' },
      { name: 'Rasterize PDF', href: '/rasterize-pdf', icon: ImageDown, badge: 'device', since: '2026-08-26' },
      { name: 'Crop PDF', href: '/crop-pdf', icon: Crop, badge: 'device', soon: true },
      { name: 'Page numbers', href: '/add-page-numbers-to-pdf', icon: ListOrdered, badge: 'device' },
      { name: 'Add bookmarks', href: '/add-bookmarks-to-pdf', icon: ListTree, badge: 'device', since: '2026-08-26' },
      { name: 'Repair PDF', href: '/repair-pdf', icon: Wrench, badge: 'device' },
    ],
  },
  {
    label: 'Convert to PDF', color: '#0284c7', tools: [
      { name: 'Scan to PDF', href: '/scan-to-pdf', icon: Camera, badge: 'device' },
      { name: 'JPG to PDF', href: '/jpg-to-pdf', icon: FileImage, badge: 'device' },
      { name: 'Word to PDF', href: '/word-to-pdf', icon: FileType2, badge: 'server' },
      { name: 'PowerPoint to PDF', href: '/powerpoint-to-pdf', icon: Presentation, badge: 'server' },
      { name: 'Excel to PDF', href: '/excel-to-pdf', icon: FileSpreadsheet, badge: 'server' },
      { name: 'HTML to PDF', href: '/html-to-pdf', icon: Code2, badge: 'server', soon: true },
      { name: 'EPUB to PDF', href: '/epub-to-pdf', icon: BookOpen, badge: 'device', soon: true },
      { name: 'Markdown to PDF', href: '/markdown-to-pdf', icon: Hash, badge: 'device', soon: true },
      { name: 'SVG to PDF', href: '/svg-to-pdf', icon: Shapes, badge: 'device', soon: true },
    ],
  },
  {
    label: 'Convert from PDF', color: '#0ea5e9', tools: [
      { name: 'PDF to JPG', href: '/pdf-to-jpg', icon: ImageIcon, badge: 'device' },
      { name: 'Extract images', href: '/extract-images-from-pdf', icon: Images, badge: 'device' },
      { name: 'PDF to Word', href: '/pdf-to-word', icon: FileType, badge: 'server' },
      { name: 'PDF to PowerPoint', href: '/pdf-to-powerpoint', icon: Presentation, badge: 'server' },
      { name: 'PDF to RTF', href: '/pdf-to-rtf', icon: FileType, badge: 'server', since: '2026-08-26' },
      { name: 'PDF to HTML', href: '/pdf-to-html', icon: Code2, badge: 'device', since: '2026-08-26' },
      { name: 'PDF to ODT', href: '/pdf-to-odt', icon: FileType2, badge: 'server', since: '2026-08-26' },
      { name: 'OpenDocument to PDF', href: '/odf-to-pdf', icon: FileType2, badge: 'server', since: '2026-08-26' },
      { name: 'PDF to Excel', href: '/pdf-to-excel', icon: FileSpreadsheet, badge: 'device' },
      { name: 'PDF to Markdown', href: '/pdf-to-markdown', icon: Hash, badge: 'device' },
      { name: 'PDF to EPUB', href: '/pdf-to-epub', icon: BookOpen, badge: 'device' , soon: true },
      { name: 'PDF to Text', href: '/pdf-to-text', icon: AlignLeft, badge: 'device', soon: true },
      { name: 'PDF to Audio', href: '/pdf-to-audio', icon: Volume2, badge: 'device' },
      { name: 'Bank statement to Excel', href: '/bank-statement-converter', icon: Landmark, badge: 'device', soon: true },
      { name: 'PDF to PDF/A', href: '/pdf-to-pdfa', icon: FileCheck, badge: 'server' },
    ],
  },
  {
    label: 'Edit & sign', color: '#d97706', tools: [
      // href is REQUIRED even while soon: the search and the palette route Pro
      // tools by it, so an entry without one sent everybody — the owner
      // included — to /pricing instead of the page. /edit-pdf exists and
      // ToolGate does the gating; `soon` still drives the badge.
      { name: 'Edit PDF', href: '/edit-pdf', icon: PenLine, badge: 'device', soon: true },
      { name: 'Annotate', href: '/annotate-pdf', icon: Highlighter, badge: 'device', soon: true },
      { name: 'Watermark', href: '/watermark-pdf', icon: Stamp, badge: 'device' },
      { name: 'Overlay PDF', href: '/overlay-pdf', icon: Layers, badge: 'device', since: '2026-08-24' },
      { name: 'Bates numbering', href: '/bates-numbering', icon: ListOrdered, badge: 'device' },
      { name: 'Remove metadata', href: '/remove-pdf-metadata', icon: Fingerprint, badge: 'device' },
      { name: 'Edit PDF details', href: '/edit-pdf-metadata', icon: Tags, badge: 'device', since: '2026-08-26' },
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
      // Same missing-href bug as Edit PDF above; /ocr-pdf exists and is gated.
      { name: 'OCR', href: '/ocr-pdf', icon: ScanText, badge: 'server', soon: true },
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
    // Beyond-PDF differentiators — media tools that competitors only offer with
    // an upload; ours run on-device on the BROWSER's own codecs (WebCodecs,
    // Web Audio, canvas). Deliberately no ffmpeg.wasm: its useful builds carry
    // GPL encoders, which we can't ship in a commercial product.
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
      { name: 'Video to MP3', href: '/video-to-mp3', icon: Music, badge: 'device' , soon: true },
      { name: 'Audio converter', href: '/audio-converter', icon: AudioLines, badge: 'device' , soon: true },
      { name: 'SVG to PNG', href: '/svg-to-png', icon: Shapes, badge: 'device', soon: true },
      { name: 'Subtitle converter', href: '/subtitle-converter', icon: Captions, badge: 'device', soon: true },
      { name: 'Favicon generator', href: '/favicon-generator', icon: Sparkles, badge: 'device', soon: true },
      { name: 'Video to GIF', href: '/video-to-gif', icon: Clapperboard, badge: 'device' },
    ],
  },
  {
    label: 'Everyday utilities', color: '#0d9488', tools: [
      { name: 'Folder preview', href: '/folder-preview', icon: FolderOpen, badge: 'device', soon: true, since: '2026-08-10' },
      { name: 'Word counter', href: '/word-counter', icon: CaseSensitive, badge: 'device' },
      { name: 'Unit converter', href: '/unit-converter', icon: Ruler, badge: 'device' },
      { name: 'JSON formatter', href: '/json-formatter', icon: Braces, badge: 'device' },
      { name: 'Color picker', href: '/color-picker', icon: Palette, badge: 'device' },
    ],
  },
  {
    // This was one 21-item "Developer tools" list, and it was the single
    // tallest thing in the mega-menu — 514px in one break-inside-avoid block,
    // which set a floor no column count could lower and left the menu 38px from
    // overflowing again. Splitting it is the fix that was written down at the
    // time, and it is the better shelf anyway: somebody cleaning up a CSV and
    // somebody decoding a JWT are not the same person looking in the same place.
    label: 'Developer tools', color: '#4f46e5', tools: [
      { name: 'Base64', href: '/base64', icon: Binary, badge: 'device' },
      { name: 'URL encode', href: '/url-encode', icon: Link2, badge: 'device' },
      { name: 'HTML entities', href: '/html-entities', icon: Code2, badge: 'device' },
      { name: 'Hash generator', href: '/hash-generator', icon: Hash, badge: 'device' },
      { name: 'JWT decoder', href: '/jwt-decoder', icon: KeyRound, badge: 'device' },
      { name: 'UUID generator', href: '/uuid-generator', icon: Fingerprint, badge: 'device' },
      { name: 'Regex tester', href: '/regex-tester', icon: Code2, badge: 'device' },
      { name: 'Timestamp', href: '/timestamp-converter', icon: Ruler, badge: 'device' },
      { name: 'JSON to YAML', href: '/json-to-yaml', icon: Braces, badge: 'device' },
    ],
  },
  {
    label: 'Data & spreadsheets', color: '#0891b2', tools: [
      { name: 'CSV cleaner', href: '/csv-cleaner', icon: FileSpreadsheet, badge: 'device' },
      { name: 'CSV to JSON', href: '/csv-to-json', icon: FileJson, badge: 'device' },
      { name: 'CSV to Excel', href: '/csv-to-excel', icon: FileSpreadsheet, badge: 'device', soon: true },
      { name: 'Excel to CSV', href: '/excel-to-csv', icon: FileSpreadsheet, badge: 'device', soon: true },
      { name: 'JSON to Excel', href: '/json-to-excel', icon: FileJson, badge: 'device', soon: true },
      { name: 'XML to Excel', href: '/xml-to-excel', icon: Braces, badge: 'device', soon: true },
      { name: 'HTML to Excel', href: '/html-to-excel', icon: Table2, badge: 'device', soon: true },
    ],
  },
  {
    label: 'Text tools', color: '#7c3aed', tools: [
      { name: 'Text diff', href: '/text-diff', icon: GitCompare, badge: 'device' },
      { name: 'Case converter', href: '/case-converter', icon: Type, badge: 'device' },
      { name: 'Slugify', href: '/slugify', icon: Link2, badge: 'device' },
      { name: 'Sort lines', href: '/sort-lines', icon: ListOrdered, badge: 'device' },
      { name: 'Lorem ipsum', href: '/lorem-ipsum', icon: Type, badge: 'device' },
    ],
  },
  {
    label: 'Workspace', color: '#16a34a', tools: [
      { name: 'Smart notes', href: '/notes', icon: NotebookPen, badge: 'account' },
      { name: 'Habit tracker', href: '/habits', icon: Flame, badge: 'account' },
      { name: 'Budget tracker', href: '/budget', icon: Wallet, badge: 'account' },
      { name: 'Receipt scanner', href: '/receipt-scanner', icon: ReceiptText, badge: 'server', soon: true },
      { name: 'Workflows', href: '/workflows', icon: Workflow, badge: 'device', soon: true },
      { name: 'Client packet builder', href: '/client-packet-builder', icon: FolderLock, badge: 'device', soon: true },
      { name: 'File vault', href: '/file-vault', icon: FolderLock, badge: 'encrypted', soon: true },
      { name: 'Link in bio', href: '/link-in-bio', icon: Link2, badge: 'server', soon: true },
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
