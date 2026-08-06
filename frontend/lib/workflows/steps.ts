// Saved Workflows — the step registry.
//
// Each step is an on-device operation backed by an engine DiemDesk already
// ships. A workflow is just an ordered list of these; the runner (run.ts) pipes
// the File(s) from one step into the next, entirely in the browser — nothing is
// uploaded between steps, which is the whole point (server tools can't do this).
//
// v1 wires the steps whose engines run cleanly headless-in-worker with no extra
// assets. Steps that need interactive input (a drawn signature) or heavier
// assets (watermark fonts, scan cleanup) are declared with `soon: true` so the
// builder shows the full vision while only the wired ones execute.

import { mergePdfs, rewritePdf } from '@/lib/pdf-rewrite';
import { runQpdf } from '@/lib/qpdf';
import { compressPdfToTarget } from '@/lib/compress-to-target';

export type StepId =
  | 'merge' | 'delete' | 'rotate' | 'page-numbers'
  | 'remove-metadata' | 'flatten' | 'protect' | 'compress-size'
  // declared-but-not-yet-wired (shown disabled in the palette):
  | 'sign' | 'watermark' | 'share-safe' | 'clean-scanned';

export type StepConfig = Record<string, string | number>;
export type WorkflowStep = { id: StepId; config?: StepConfig };

export type StepField =
  | { key: string; label: string; type: 'text'; placeholder?: string; default?: string }
  | { key: string; label: string; type: 'number'; suffix?: string; default: number; min?: number; max?: number }
  | { key: string; label: string; type: 'select'; options: { value: string; label: string }[]; default: string };

export type StepDef = {
  id: StepId;
  label: string;
  blurb: string;
  color: string;   // CSS var name used for the chip/icon
  glyph: string;   // emoji shown in the pipeline
  collapse?: boolean; // consumes ALL input files into one (merge)
  soon?: boolean;     // shown in the palette but not yet executable
  fields?: StepField[];
  run?: (files: File[], cfg: StepConfig, signal?: AbortSignal, onMsg?: (m: string) => void) => Promise<File[]>;
};

const PDF = 'application/pdf';
const asFile = (bytes: Uint8Array | ArrayBuffer, name: string): File =>
  new File([bytes as BlobPart], name, { type: PDF });
const stem = (n: string) => n.replace(/\.pdf$/i, '');

/** Page count via pdf-lib without mutating the file — needed by rotate / delete /
 *  page-numbers to build per-page arrays. */
async function pageCount(file: File): Promise<number> {
  const { PDFDocument } = await import('pdf-lib');
  const doc = await PDFDocument.load(await file.arrayBuffer(), { ignoreEncryption: true, updateMetadata: false });
  return doc.getPageCount();
}

/** Parse "1,3,5-7" (1-based) into a sorted unique set of 0-based indices. */
function parsePages(spec: string, count: number): number[] {
  const out = new Set<number>();
  for (const part of String(spec).split(/[,\s]+/).filter(Boolean)) {
    const m = part.match(/^(\d+)(?:-(\d+))?$/);
    if (!m) continue;
    const a = Number(m[1]), b = m[2] ? Number(m[2]) : a;
    for (let p = Math.min(a, b); p <= Math.max(a, b); p++) if (p >= 1 && p <= count) out.add(p - 1);
  }
  return Array.from(out).sort((x, y) => x - y);
}

// Map a per-file transform over every input file.
const perFile = (fn: (f: File, cfg: StepConfig, signal?: AbortSignal, onMsg?: (m: string) => void) => Promise<File>) =>
  async (files: File[], cfg: StepConfig, signal?: AbortSignal, onMsg?: (m: string) => void) =>
    Promise.all(files.map((f) => fn(f, cfg, signal, onMsg)));

export const STEPS: Record<StepId, StepDef> = {
  merge: {
    id: 'merge', label: 'Merge', blurb: 'Combine the dropped files into one, in order', color: '--indigo', glyph: '🗂️',
    collapse: true,
    async run(files) {
      if (files.length === 1) return files; // nothing to merge
      const bytes = await mergePdfs(files);
      return [asFile(bytes, `${stem(files[0].name)}-merged.pdf`)];
    },
  },

  delete: {
    id: 'delete', label: 'Delete pages', blurb: 'Remove specific pages', color: '--rose', glyph: '🧹',
    fields: [{ key: 'pages', label: 'Pages to delete', type: 'text', placeholder: 'e.g. 1, 3, 5-7' }],
    run: perFile(async (f, cfg) => {
      const count = await pageCount(f);
      const indices = parsePages(String(cfg.pages ?? ''), count);
      if (!indices.length || indices.length >= count) return f; // no-op / would empty the doc
      const bytes = await rewritePdf(f, { type: 'delete', indices });
      return asFile(bytes, `${stem(f.name)}-trimmed.pdf`);
    }),
  },

  rotate: {
    id: 'rotate', label: 'Rotate', blurb: 'Turn every page', color: '--indigo', glyph: '🔄',
    fields: [{ key: 'angle', label: 'Rotate by', type: 'select', default: '90', options: [
      { value: '90', label: '90° right' }, { value: '180', label: '180°' }, { value: '270', label: '90° left' }] }],
    run: perFile(async (f, cfg) => {
      const count = await pageCount(f);
      const angle = Number(cfg.angle ?? 90);
      const bytes = await rewritePdf(f, { type: 'rotate', deltas: new Array(count).fill(angle) });
      return asFile(bytes, `${stem(f.name)}-rotated.pdf`);
    }),
  },

  'page-numbers': {
    id: 'page-numbers', label: 'Page numbers', blurb: 'Stamp a number on every page', color: '--violet', glyph: '#️⃣',
    fields: [
      { key: 'template', label: 'Format', type: 'text', default: '{n}', placeholder: '{n}  or  {n} of {p}' },
      { key: 'pos', label: 'Position', type: 'select', default: 'bc', options: [
        { value: 'bc', label: 'Bottom centre' }, { value: 'br', label: 'Bottom right' }, { value: 'bl', label: 'Bottom left' },
        { value: 'tc', label: 'Top centre' }, { value: 'tr', label: 'Top right' }, { value: 'tl', label: 'Top left' }] },
    ],
    run: perFile(async (f, cfg) => {
      const count = await pageCount(f);
      const pageNums = Array.from({ length: count }, (_, i) => i + 1);
      const bytes = await rewritePdf(f, { type: 'page-numbers', opts: {
        pageNums, start: 1, template: String(cfg.template || '{n}'), fontSize: 11, margin: 24,
        colorRgb: [0.1, 0.1, 0.12], pos: (String(cfg.pos || 'bc') as 'bc'), standardFont: 'Helvetica',
      } });
      return asFile(bytes, `${stem(f.name)}-numbered.pdf`);
    }),
  },

  'remove-metadata': {
    id: 'remove-metadata', label: 'Remove metadata', blurb: 'Strip author, history & hidden data', color: '--green', glyph: '🧽',
    run: perFile(async (f) => {
      const { PDFDocument } = await import('pdf-lib');
      const { stripDocMetadata } = await import('@/lib/pdf-sanitize');
      const doc = await PDFDocument.load(await f.arrayBuffer(), { ignoreEncryption: true });
      await stripDocMetadata(doc);
      const bytes = await doc.save({ useObjectStreams: true });
      return asFile(bytes, `${stem(f.name)}-clean.pdf`);
    }),
  },

  flatten: {
    id: 'flatten', label: 'Flatten', blurb: 'Bake in annotations & form fields', color: '--cyan', glyph: '🧾',
    run: perFile(async (f) => {
      const bytes = await runQpdf(f, { type: 'flatten' });
      return asFile(bytes, `${stem(f.name)}-flat.pdf`);
    }),
  },

  protect: {
    id: 'protect', label: 'Protect', blurb: 'Lock with a password', color: '--rose', glyph: '🔒',
    fields: [{ key: 'password', label: 'Password', type: 'text', placeholder: 'Set a password' }],
    run: perFile(async (f, cfg) => {
      const password = String(cfg.password ?? '').trim();
      if (!password) return f; // no password set → skip rather than fail the chain
      const bytes = await runQpdf(f, { type: 'encrypt', password, allowPrint: true, allowCopy: true });
      return asFile(bytes, `${stem(f.name)}-protected.pdf`);
    }),
  },

  'compress-size': {
    id: 'compress-size', label: 'Compress to size', blurb: 'Shrink toward a target size', color: '--green', glyph: '🎯',
    fields: [{ key: 'targetMb', label: 'Target size', type: 'number', suffix: 'MB', default: 2, min: 0.05, max: 100 }],
    run: perFile(async (f, cfg, signal, onMsg) => {
      const target = Math.max(0.05, Number(cfg.targetMb ?? 2)) * 1024 * 1024;
      const res = await compressPdfToTarget(f, target, onMsg, signal);
      return new File([res.blob], res.name || `${stem(f.name)}-compressed.pdf`, { type: PDF });
    }),
  },

  // ---- declared, not yet wired (palette shows them disabled) ----
  sign: { id: 'sign', label: 'Sign', blurb: 'Place a saved signature', color: '--coral', glyph: '✍️', soon: true },
  watermark: { id: 'watermark', label: 'Watermark', blurb: 'Stamp text across pages', color: '--amber', glyph: '💧', soon: true },
  'share-safe': { id: 'share-safe', label: 'Share-safe check', blurb: 'Report risky hidden data', color: '--coral', glyph: '🛡️', soon: true },
  'clean-scanned': { id: 'clean-scanned', label: 'Clean scanned', blurb: 'Deskew & de-speckle scans', color: '--cyan', glyph: '📷', soon: true },
};

export const STEP_ORDER: StepId[] = [
  'merge', 'delete', 'rotate', 'remove-metadata', 'page-numbers', 'flatten', 'protect', 'compress-size',
  'sign', 'watermark', 'share-safe', 'clean-scanned',
];
