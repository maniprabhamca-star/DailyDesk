// What kind of thing is this file, and can we show it?
//
// The three-way answer is the important part, and it came from the local tool
// this was learned from: RENDER it, LIST it and say why we can't, or IGNORE it
// entirely. An earlier version silently dropped anything it didn't recognise,
// which made folders look emptier than they actually were — you'd open a folder
// of forty files, see nine, and quietly distrust the tool.
//
// So `null` means "not a document, don't list it" (.exe, .dll, .lnk) while
// 'unsupported' means "this IS your file, we just can't draw it, and here is the
// honest reason". Those are different answers and the UI shows them differently.

export type FileKind =
  | 'html' | 'pdf' | 'svg' | 'image' | 'markdown' | 'table'
  | 'json' | 'font' | 'code' | 'text' | 'unsupported';

const EXTENSIONS: Record<string, FileKind> = {
  html: 'html', htm: 'html',
  pdf: 'pdf',

  svg: 'svg',
  png: 'image', jpg: 'image', jpeg: 'image', gif: 'image',
  webp: 'image', avif: 'image', bmp: 'image', ico: 'image',
  // We CAN decode HEIC — the heic-to-jpg engine already does — so unlike the
  // tool this came from, it is a real image here rather than an apology.
  heic: 'image', heif: 'image',

  md: 'markdown', markdown: 'markdown', mdx: 'markdown',
  csv: 'table', tsv: 'table',
  json: 'json', geojson: 'json',

  ttf: 'font', otf: 'font', woff: 'font', woff2: 'font',

  js: 'code', mjs: 'code', cjs: 'code', ts: 'code', tsx: 'code', jsx: 'code',
  php: 'code', css: 'code', scss: 'code', less: 'code', py: 'code',
  rb: 'code', go: 'code', rs: 'code', java: 'code', c: 'code', cpp: 'code',
  h: 'code', cs: 'code', sh: 'code', bash: 'code', ps1: 'code', sql: 'code',
  vue: 'code', svelte: 'code', xml: 'code', yaml: 'code', yml: 'code',
  toml: 'code', ini: 'code', env: 'code',

  txt: 'text', log: 'text', srt: 'text', vtt: 'text', rtf: 'text',
};

/** Types we knowingly cannot draw in a browser, with the reason we tell people. */
const UNSUPPORTED: Record<string, string> = {
  psd: 'Photoshop files need rasterising, which a browser can’t do.',
  ai: 'Illustrator files need rasterising, which a browser can’t do.',
  eps: 'EPS needs rasterising, which a browser can’t do.',
  doc: 'Old Word format — needs a document parser.',
  docx: 'Word files need a document parser we don’t load here.',
  xls: 'Old Excel format — needs a spreadsheet parser.',
  xlsx: 'Excel files need a spreadsheet parser we don’t load here.',
  ppt: 'Old PowerPoint format — needs a document parser.',
  pptx: 'PowerPoint files need a document parser we don’t load here.',
  zip: 'Archives would have to be unpacked first.',
  rar: 'Archives would have to be unpacked first.',
  '7z': 'Archives would have to be unpacked first.',
  epub: 'EPUB is a zip of pages — it needs unpacking first.',
  mp4: 'Video preview is a separate job — frames, not a thumbnail.',
  mov: 'Video preview is a separate job — frames, not a thumbnail.',
  mp3: 'Audio has nothing to show — a waveform is a different tool.',
  wav: 'Audio has nothing to show — a waveform is a different tool.',
};

export const extOf = (name: string): string => {
  const i = name.lastIndexOf('.');
  return i === -1 ? '' : name.slice(i + 1).toLowerCase();
};

/** null = not a document; ignore it entirely rather than listing it. */
export function classify(name: string): FileKind | null {
  const e = extOf(name);
  if (EXTENSIONS[e]) return EXTENSIONS[e];
  if (UNSUPPORTED[e]) return 'unsupported';
  return null;
}

/** Why we can't preview it — only meaningful for 'unsupported'. */
export function unsupportedReason(name: string): string {
  return UNSUPPORTED[extOf(name)] || 'We don’t have a way to draw this one.';
}

/** True for kinds the browser renders itself, which need an iframe or an <img>. */
export const isNative = (k: FileKind | null): boolean => k === 'html' || k === 'pdf';

/** Only these read their bytes as text — everything else stays a blob. */
export const isTextual = (k: FileKind | null): boolean =>
  k === 'markdown' || k === 'table' || k === 'json' || k === 'code' || k === 'text';

/** Reading more than this to draw a thumbnail is waste. Theirs, and correct. */
export const TEXT_READ_CAP = 256 * 1024;

/** Per-kind display, so the chip colour and label live in one place. */
export const KIND_META: Record<FileKind, { label: string; color: string }> = {
  html: { label: 'HTML', color: '#ea580c' },
  pdf: { label: 'PDF', color: '#dc2626' },
  svg: { label: 'SVG', color: '#7c3aed' },
  image: { label: 'IMG', color: '#db2777' },
  markdown: { label: 'MD', color: '#2563eb' },
  table: { label: 'CSV', color: '#047857' },
  json: { label: 'JSON', color: '#0891b2' },
  font: { label: 'FONT', color: '#b45309' },
  code: { label: 'CODE', color: '#475569' },
  text: { label: 'TXT', color: '#64748b' },
  unsupported: { label: '—', color: '#94a3b8' },
};

export const KIND_GROUP: Record<FileKind, string> = {
  html: 'Web pages', pdf: 'PDFs', svg: 'Vectors', image: 'Images',
  markdown: 'Markdown', table: 'Spreadsheets', json: 'JSON', font: 'Fonts',
  code: 'Code', text: 'Text', unsupported: 'No preview',
};
