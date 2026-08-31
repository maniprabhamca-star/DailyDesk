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
  Scissors, Grid2x2, Tags, ListTree, Globe, type LucideIcon } from 'lucide-react';

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
  /**
   * The card blurb. Two clauses: what it does, then the guarantee or the
   * controls — the thing the reader was actually unsure about. Never restate
   * the tool's own name; "Word into a PDF" under "Word to PDF" costs a line and
   * returns nothing. 6-12 words, which holds two lines at card width.
   *
   * Required. tests/unit/tool-blurbs.test.ts fails the build on a missing one —
   * 67 of 114 tools had none before that test existed, because nothing forced
   * the question at the moment a tool row was added.
   */
  desc: string;
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
  device: { icon: CloudOff, color: 'var(--badge-device)', label: 'Runs in your browser', hint: 'Runs in your browser — your file never leaves your device and is never uploaded.' },
  server: { icon: Cloud, color: 'var(--badge-server)', label: 'Processed on our servers', hint: 'Sent to our server over an encrypted connection, converted, then deleted immediately.' },
  ai: { icon: Sparkles, color: 'var(--badge-ai)', label: 'AI-powered', hint: 'Uses AI, and only when you ask it to.' },
  encrypted: { icon: KeyRound, color: 'var(--badge-encrypted)', label: 'End-to-end encrypted', hint: 'Encrypted on your device before it is stored — only you can unlock it.' },
  account: { icon: Cloud, color: 'var(--badge-account)', label: 'Synced to your account', hint: 'Saved to your DiemDesk account so it follows you between devices.' },
};

// The premium tier — owner-only until Pro launches: the deep editors, OCR and the
// AI tools. Search surfaces (⌘K palette, header search) badge these "Pro" and open
// the tool page, where the tool makes its own case. Keep in sync with the pro-launch
// checklist. Matched by tool name.
export const PRO_TOOLS = new Set(['Edit PDF', 'Redact PDF', 'OCR', 'Chat with PDF', 'Summarize', 'Translate', 'Question generator', 'File vault', 'Link in bio', 'Receipt scanner', 'Workflows']);

export const catalog: CatGroup[] = [
  {
    label: 'Organize PDF', color: '#dc2626', tools: [
      { name: 'PDF viewer', href: '/pdf-viewer', icon: Eye, badge: 'device', desc: 'Open big files fast. Search the text, jump by page.' },
      { name: 'Merge PDF', href: '/merge-pdf', icon: Combine, badge: 'device', desc: 'Combine any number of files. Reorder before you merge.' },
      { name: 'Split PDF', href: '/split-pdf', icon: Split, badge: 'device', desc: 'Take one page or a range. The original stays untouched.' },
      { name: 'Compress PDF', href: '/compress-pdf', icon: Shrink, badge: 'device', desc: 'Smaller file, text stays sharp. You set the quality.' },
      { name: 'Compress to size', href: '/compress-to-size', icon: Crosshair, badge: 'device', since: '2026-08-22' , desc: 'Hit the exact KB limit a portal insists on.' },
      { name: 'Rotate PDF', href: '/rotate-pdf', icon: RotateCw, badge: 'device', desc: 'Turn pages upright. The fix survives saving and reopening.' },
      { name: 'Reorder pages', href: '/reorder-pdf', icon: ArrowLeftRight, badge: 'device', desc: 'Drag pages into order. Delete and duplicate as you go.' },
      { name: 'Compare PDF', href: '/compare-pdf', icon: ArrowLeftRight, badge: 'device', soon: true , desc: 'Spot every change between two versions, side by side.' },
      { name: 'Delete pages', href: '/delete-pages-from-pdf', icon: FileMinus, badge: 'device', desc: 'Remove a page or a range. Everything else untouched.' },
      { name: 'Split pages in half', href: '/split-pages-in-half', icon: Scissors, badge: 'device', since: '2026-08-26' , desc: 'Cut two-up scans into single pages, left then right.' },
      { name: 'Pages per sheet', href: '/pages-per-sheet', icon: Grid2x2, badge: 'device', since: '2026-08-26' , desc: 'Fit 2, 4 or more pages on one sheet to save paper.' },
      { name: 'Change page size', href: '/change-pdf-page-size', icon: Ruler, badge: 'device', since: '2026-08-26' , desc: 'Rescale to A4, Letter or a size you type. Margins kept.' },
      { name: 'Rasterize PDF', href: '/rasterize-pdf', icon: ImageDown, badge: 'device', since: '2026-08-26' , desc: 'Pages become images, so the text cannot be copied out.' },
      { name: 'Crop PDF', href: '/crop-pdf', icon: Crop, badge: 'device', soon: true , desc: 'Trim margins or white space. One page or all of them.' },
      { name: 'Page numbers', href: '/add-page-numbers-to-pdf', icon: ListOrdered, badge: 'device', desc: 'Number pages automatically. Choose position, format and start.' },
      { name: 'Add bookmarks', href: '/add-bookmarks-to-pdf', icon: ListTree, badge: 'device', since: '2026-08-26' , desc: 'Build the clickable contents panel readers navigate by.' },
      { name: 'Repair PDF', href: '/repair-pdf', icon: Wrench, badge: 'device', desc: 'Opens files other readers refuse. Recovers what it can.' },
    ],
  },
  {
    label: 'Convert to PDF', color: '#0284c7', tools: [
      { name: 'Scan to PDF', href: '/scan-to-pdf', icon: Camera, badge: 'device', desc: 'Photograph paper with your phone. Edges straightened for you.' },
      { name: 'JPG to PDF', href: '/jpg-to-pdf', icon: FileImage, badge: 'device', desc: 'Photos into one PDF at full resolution. Set the margins.' },
      { name: 'Word to PDF', href: '/word-to-pdf', icon: FileType2, badge: 'server', desc: 'Fonts, tables and layout land where you left them.' },
      { name: 'PowerPoint to PDF', href: '/powerpoint-to-pdf', icon: Presentation, badge: 'server', desc: 'Slides become a share-ready PDF that opens anywhere.' },
      { name: 'Excel to PDF', href: '/excel-to-pdf', icon: FileSpreadsheet, badge: 'server', desc: 'Sheets fit the page, with column widths and formatting kept.' },
      { name: 'HTML to PDF', href: '/html-to-pdf', icon: Code2, badge: 'server', soon: true , desc: 'Renders an HTML file you already have, styles applied.' },
      { name: 'Webpage to PDF', href: '/webpage-to-pdf', icon: Globe, badge: 'server', since: '2026-08-26' , desc: 'Paste a URL and archive the live page as it looks now.' },
      { name: 'EPUB to PDF', href: '/epub-to-pdf', icon: BookOpen, badge: 'device', soon: true , desc: 'An ebook as fixed pages you can print or annotate.' },
      { name: 'Markdown to PDF', href: '/markdown-to-pdf', icon: Hash, badge: 'device', soon: true , desc: 'Headings, tables and code blocks all formatted.' },
      { name: 'SVG to PDF', href: '/svg-to-pdf', icon: Shapes, badge: 'device', soon: true , desc: 'Vector stays vector — sharp at any print size.' },
    ],
  },
  {
    label: 'Convert from PDF', color: '#0ea5e9', tools: [
      { name: 'PDF to JPG', href: '/pdf-to-jpg', icon: ImageIcon, badge: 'device', desc: 'Every page as an image, at the resolution you choose.' },
      { name: 'Extract images', href: '/extract-images-from-pdf', icon: Images, badge: 'device', desc: 'Pulls out the original pictures, not screenshots of them.' },
      { name: 'PDF to Word', href: '/pdf-to-word', icon: FileType, badge: 'server', desc: 'Editable DOCX with the layout and fonts retained.' },
      { name: 'PDF to PowerPoint', href: '/pdf-to-powerpoint', icon: Presentation, badge: 'server', desc: 'Editable slides, with fonts and positioning kept.' },
      { name: 'PDF to RTF', href: '/pdf-to-rtf', icon: FileType, badge: 'server', since: '2026-08-26' , desc: 'Formatted text any word processor will open.' },
      { name: 'PDF to HTML', href: '/pdf-to-html', icon: Code2, badge: 'device', since: '2026-08-26' , desc: 'Real selectable text, not a page of flat images.' },
      { name: 'PDF to ODT', href: '/pdf-to-odt', icon: FileType2, badge: 'server', since: '2026-08-26' , desc: 'Editable in LibreOffice and OpenOffice, formatting intact.' },
      { name: 'OpenDocument to PDF', href: '/odf-to-pdf', icon: FileType2, badge: 'server', since: '2026-08-26' , desc: 'ODT and ODS to PDF with the layout preserved.' },
      { name: 'PDF to Excel', href: '/pdf-to-excel', icon: FileSpreadsheet, badge: 'device', desc: 'Tables become rows you can total, not a screenshot.' },
      { name: 'PDF to Markdown', href: '/pdf-to-markdown', icon: Hash, badge: 'device', desc: 'Clean Markdown with the headings and tables preserved.' },
      { name: 'PDF to EPUB', href: '/pdf-to-epub', icon: BookOpen, badge: 'device', soon: true , desc: 'Reflows to fit a phone or an e-reader screen.' },
      { name: 'PDF to Text', href: '/pdf-to-text', icon: AlignLeft, badge: 'device', soon: true , desc: 'Just the words, ready to paste or search.' },
      { name: 'PDF to Audio', href: '/pdf-to-audio', icon: Volume2, badge: 'device', desc: 'Listen to a document. Choose the voice and the speed.' },
      { name: 'Bank statement to Excel', href: '/bank-statement-converter', icon: Landmark, badge: 'device', soon: true , desc: 'Rows that add up — checked against the closing balance.' },
      { name: 'PDF to PDF/A', href: '/pdf-to-pdfa', icon: FileCheck, badge: 'server', desc: 'The archival format records offices and courts require.' },
    ],
  },
  {
    label: 'Edit & sign', color: '#d97706', tools: [
      // href is REQUIRED even while soon: the search and the palette route Pro
      // tools by it, so an entry without one sent everybody — the owner
      // included — to /pricing instead of the page. /edit-pdf exists and
      // ToolGate does the gating; `soon` still drives the badge.
      { name: 'Edit PDF', href: '/edit-pdf', icon: PenLine, badge: 'device', soon: true , desc: 'Change the text and images already on the page.' },
      { name: 'Annotate', href: '/annotate-pdf', icon: Highlighter, badge: 'device', soon: true , desc: 'Highlight, draw and comment. Several colours and widths.' },
      { name: 'Watermark', href: '/watermark-pdf', icon: Stamp, badge: 'device', desc: 'Stamp text or a logo. Set position, size and transparency.' },
      { name: 'Overlay PDF', href: '/overlay-pdf', icon: Layers, badge: 'device', since: '2026-08-24' , desc: 'Lay letterhead or a stamp behind every page.' },
      { name: 'Bates numbering', href: '/bates-numbering', icon: ListOrdered, badge: 'device', desc: 'Numbering that runs on across every file in the set.' },
      { name: 'Remove metadata', href: '/remove-pdf-metadata', icon: Fingerprint, badge: 'device', desc: 'Strips author, software and revision history.' },
      { name: 'Edit PDF details', href: '/edit-pdf-metadata', icon: Tags, badge: 'device', since: '2026-08-26' , desc: 'Set title, author and keywords — in both Info and XMP.' },
      { name: 'Share-Safe PDF Check', href: '/share-safe-pdf-check', icon: ShieldCheck, badge: 'device', soon: true , desc: 'Finds hidden text, metadata and comments before you send.' },
      { name: 'Redact PDF', href: '/redact-pdf', icon: EyeOff, badge: 'device', soon: true , desc: 'Removes the words underneath, not just a black box.' },
      { name: 'Sign PDF', href: '/sign-pdf', icon: PenTool, badge: 'device', desc: 'Draw, type or photograph a signature. Place it anywhere.' },
      { name: 'Fill PDF form', href: '/fill-pdf-form', icon: SquarePen, badge: 'device', desc: 'Type into the form fields and save it filled in.' },
      { name: 'Flatten PDF', href: '/flatten-pdf', icon: Layers, badge: 'device', desc: 'Locks in fields and annotations so nothing shifts later.' },
      { name: 'Protect PDF', href: '/protect-pdf', icon: Lock, badge: 'device', desc: 'A password is needed to open it. AES encryption.' },
      { name: 'Unlock PDF', href: '/unlock-pdf', icon: Unlock, badge: 'device', desc: 'Removes a password you already know, restrictions cleared.' },
    ],
  },
  {
    label: 'AI & scan', color: '#db2777', tools: [
      { name: 'Clean scanned PDF', href: '/clean-scanned-pdf', icon: ScanText, badge: 'device', soon: true , desc: 'Straightens, de-skews and lifts a washed-out scan.' },
      // Live as a Pro tool (2026-08-27): no longer "soon", so the catalog says
      // available and the Pro badge in search says who it is for.
      { name: 'OCR', href: '/ocr-pdf', icon: ScanText, badge: 'server', since: '2026-08-27' , desc: 'Turns a picture of text into text you can search.' },
      { name: 'Chat with PDF', href: '/chat-pdf', icon: MessageSquare, badge: 'ai', soon: true , desc: 'Ask a question, get page-cited answers you can check.' },
      { name: 'Summarize', href: '/summarize-pdf', icon: AlignLeft, badge: 'ai', soon: true , desc: 'A summary with its pages cited, in any language.' },
      { name: 'Translate', href: '/translate-pdf', icon: Languages, badge: 'ai', soon: true , desc: '30+ languages, with control over how terms are handled.' },
      { name: 'Question generator', href: '/pdf-question-generator', icon: HelpCircle, badge: 'ai', soon: true , desc: 'Turns a document into a quiz, with Anki export.' },
    ],
  },
  {
    label: 'Generators', color: '#4f46e5', tools: [
      { name: 'QR generator', href: '/qr-code-generator', icon: QrCode, badge: 'device', desc: 'URL, wifi or text. Download as PNG or SVG.' },
      { name: 'QR scanner', href: '/scan-qr-code', icon: ScanLine, badge: 'device', desc: 'Read a code from a photo or from your camera.' },
      { name: 'Password', href: '/password-generator', icon: KeyRound, badge: 'device', desc: 'Long random passwords, generated on your device only.' },
    ],
  },
  {
    // Beyond-PDF differentiators — media tools that competitors only offer with
    // an upload; ours run on-device on the BROWSER's own codecs (WebCodecs,
    // Web Audio, canvas). Deliberately no ffmpeg.wasm: its useful builds carry
    // GPL encoders, which we can't ship in a commercial product.
    label: 'Images & media', color: '#ea580c', tools: [
      { name: 'Compress image', href: '/compress-image', icon: ImageDown, badge: 'device', desc: 'Smaller JPG, PNG or WebP with the detail kept.' },
      { name: 'Resize image', href: '/resize-image', icon: Scaling, badge: 'device', desc: 'Exact pixels or a percentage, aspect ratio locked.' },
      { name: 'Crop image', href: '/crop-image', icon: Crop, badge: 'device', desc: 'Frame the shot, or crop to a preset ratio.' },
      { name: 'Convert image', href: '/convert-image', icon: Repeat, badge: 'device', desc: 'Between WebP, PNG, JPG, AVIF and HEIC.' },
      { name: 'HEIC to JPG', href: '/heic-to-jpg', icon: Smartphone, badge: 'device', desc: 'iPhone photos anything can open, quality preserved.' },
      { name: 'Background remover', href: '/remove-background', icon: Eraser, badge: 'device', desc: 'Cuts out the subject and leaves the edges clean.' },
      { name: 'Passport & ID photo', href: '/passport-photo', icon: Contact, badge: 'device', desc: 'The right size and head height for 46 countries.' },
      { name: 'Blur & remove metadata', href: '/photo-privacy', icon: ScanFace, badge: 'device', desc: 'Blur faces or plates, and strip the GPS location.' },
      { name: 'Compress video', href: '/compress-video', icon: Film, badge: 'device', desc: 'Small enough to email or upload. You choose the quality.' },
      { name: 'Video to MP3', href: '/video-to-mp3', icon: Music, badge: 'device', soon: true , desc: 'Pull the audio out at the bitrate you pick.' },
      { name: 'Audio converter', href: '/audio-converter', icon: AudioLines, badge: 'device', soon: true , desc: 'Between MP3, WAV, M4A, OGG and FLAC.' },
      { name: 'SVG to PNG', href: '/svg-to-png', icon: Shapes, badge: 'device', soon: true , desc: 'Rasterise at any size, background optional.' },
      { name: 'Subtitle converter', href: '/subtitle-converter', icon: Captions, badge: 'device', soon: true , desc: 'Between SRT, VTT and ASS, timings preserved.' },
      { name: 'Favicon generator', href: '/favicon-generator', icon: Sparkles, badge: 'device', soon: true , desc: 'Every size a browser asks for, plus the manifest.' },
      { name: 'Video to GIF', href: '/video-to-gif', icon: Clapperboard, badge: 'device', desc: 'Trim a clip to a loop. Set frame rate and width.' },
    ],
  },
  {
    label: 'Everyday utilities', color: '#0d9488', tools: [
      { name: 'Folder preview', href: '/folder-preview', icon: FolderOpen, badge: 'device', soon: true, since: '2026-08-10' , desc: 'Thumbnails for a folder Windows shows as grey icons.' },
      { name: 'Word counter', href: '/word-counter', icon: CaseSensitive, badge: 'device', desc: 'Words, characters and reading time as you type.' },
      { name: 'Unit converter', href: '/unit-converter', icon: Ruler, badge: 'device', desc: 'Length, weight, temperature, data and more.' },
      { name: 'JSON formatter', href: '/json-formatter', icon: Braces, badge: 'device', desc: 'Pretty-print, minify, and find the syntax error.' },
      { name: 'Color picker', href: '/color-picker', icon: Palette, badge: 'device', desc: 'Pick a colour and copy it as HEX, RGB or HSL.' },
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
      { name: 'Base64', href: '/base64', icon: Binary, badge: 'device', desc: 'Encode and decode text or a file, both directions.' },
      { name: 'URL encode', href: '/url-encode', icon: Link2, badge: 'device', desc: 'Percent-encode and decode query strings safely.' },
      { name: 'HTML entities', href: '/html-entities', icon: Code2, badge: 'device', desc: 'Escape and unescape, so markup renders as text.' },
      { name: 'Hash generator', href: '/hash-generator', icon: Hash, badge: 'device', desc: 'MD5, SHA-1, SHA-256 and SHA-512, of text or a file.' },
      { name: 'JWT decoder', href: '/jwt-decoder', icon: KeyRound, badge: 'device', desc: 'Read the header and claims without sending the token.' },
      { name: 'UUID generator', href: '/uuid-generator', icon: Fingerprint, badge: 'device', desc: 'Version 4 or 7, one at a time or a thousand at once.' },
      { name: 'Regex tester', href: '/regex-tester', icon: Code2, badge: 'device', desc: 'Live matches, with the capture groups highlighted.' },
      { name: 'Timestamp', href: '/timestamp-converter', icon: Ruler, badge: 'device', desc: 'Unix time to a date and back, in any timezone.' },
      { name: 'JSON to YAML', href: '/json-to-yaml', icon: Braces, badge: 'device', desc: 'Both directions, with structure and types kept.' },
    ],
  },
  {
    label: 'Data & spreadsheets', color: '#0891b2', tools: [
      { name: 'CSV cleaner', href: '/csv-cleaner', icon: FileSpreadsheet, badge: 'device', desc: 'Fixes delimiters, blank rows and broken quoting.' },
      { name: 'CSV to JSON', href: '/csv-to-json', icon: FileJson, badge: 'device', desc: 'Typed JSON, with the header row as the keys.' },
      { name: 'CSV to Excel', href: '/csv-to-excel', icon: FileSpreadsheet, badge: 'device', soon: true , desc: 'A real .xlsx, with columns sized to fit.' },
      { name: 'Excel to CSV', href: '/excel-to-csv', icon: FileSpreadsheet, badge: 'device', soon: true , desc: 'One sheet or every sheet, in the encoding you need.' },
      { name: 'JSON to Excel', href: '/json-to-excel', icon: FileJson, badge: 'device', soon: true , desc: 'Nested objects flattened to one row per record.' },
      { name: 'XML to Excel', href: '/xml-to-excel', icon: Braces, badge: 'device', soon: true , desc: 'Elements and attributes mapped onto rows.' },
      { name: 'HTML to Excel', href: '/html-to-excel', icon: Table2, badge: 'device', soon: true , desc: 'Pulls every table out of a page into sheets.' },
    ],
  },
  {
    label: 'Text tools', color: '#7c3aed', tools: [
      { name: 'Text diff', href: '/text-diff', icon: GitCompare, badge: 'device', desc: 'Line and word changes highlighted side by side.' },
      { name: 'Case converter', href: '/case-converter', icon: Type, badge: 'device', desc: 'camelCase, snake_case, Title Case and six more.' },
      { name: 'Slugify', href: '/slugify', icon: Link2, badge: 'device', desc: 'URL-safe text, with accents and symbols handled.' },
      { name: 'Sort lines', href: '/sort-lines', icon: ListOrdered, badge: 'device', desc: 'Alphabetical, numeric or reversed. Duplicates removed.' },
      { name: 'Lorem ipsum', href: '/lorem-ipsum', icon: Type, badge: 'device', desc: 'Placeholder words, sentences or paragraphs.' },
    ],
  },
  {
    label: 'Workspace', color: '#16a34a', tools: [
      { name: 'Smart notes', href: '/notes', icon: NotebookPen, badge: 'account', desc: 'Quick notes that sync across your devices.' },
      { name: 'Habit tracker', href: '/habits', icon: Flame, badge: 'account', desc: 'Daily streaks you can see at a glance.' },
      { name: 'Budget tracker', href: '/budget', icon: Wallet, badge: 'account', desc: 'Where the money went, by category and by month.' },
      { name: 'Receipt scanner', href: '/receipt-scanner', icon: ReceiptText, badge: 'server', soon: true , desc: 'Reads the total, date and merchant off a photo.' },
      { name: 'Workflows', href: '/workflows', icon: Workflow, badge: 'device', soon: true , desc: 'Chain several tools and run them all on one drop.' },
      { name: 'Client packet builder', href: '/client-packet-builder', icon: FolderLock, badge: 'device', soon: true , desc: 'Assemble a branded pack of documents, in order.' },
      { name: 'File vault', href: '/file-vault', icon: FolderLock, badge: 'encrypted', soon: true , desc: 'End-to-end encrypted — we cannot read what you store.' },
      { name: 'Link in bio', href: '/link-in-bio', icon: Link2, badge: 'server', soon: true , desc: 'One page linking everywhere else you are.' },
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
