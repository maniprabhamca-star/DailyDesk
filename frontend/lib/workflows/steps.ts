// Saved Workflows — the step registry.
//
// Each step is an on-device operation backed by an engine DiemDesk already
// ships. A workflow is just an ordered list of these; the runner (run.ts) pipes
// the File(s) from one step into the next, entirely in the browser — nothing is
// uploaded between steps, which is the whole point (server tools can't do this).
//
// Every step here executes. Steps that need something from the user beyond a
// text field (Sign needs a signature) collect it in the builder and keep it on
// the device — a `soon: true` step would still be skipped by the runner rather
// than breaking the chain.

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
  | { key: string; label: string; type: 'select'; options: { value: string; label: string }[]; default: string }
  /** Renders the signature pad. The signature itself never enters the workflow
   *  config — it stays in this device's localStorage (see ./signature). */
  | { key: string; label: string; type: 'signature' };

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

  sign: {
    id: 'sign', label: 'Sign', blurb: 'Stamp your saved signature', color: '--coral', glyph: '✍️',
    fields: [
      { key: 'sig', label: 'Signature', type: 'signature' },
      { key: 'page', label: 'On', type: 'select', default: 'last', options: [
        { value: 'first', label: 'First page' }, { value: 'last', label: 'Last page' }, { value: 'all', label: 'Every page' }] },
      { key: 'pos', label: 'Position', type: 'select', default: 'br', options: [
        { value: 'br', label: 'Bottom right' }, { value: 'bc', label: 'Bottom centre' }, { value: 'bl', label: 'Bottom left' },
        { value: 'tr', label: 'Top right' }, { value: 'tl', label: 'Top left' }] },
      { key: 'widthPct', label: 'Width', type: 'number', suffix: '% of page', default: 22, min: 5, max: 60 },
    ],
    run: perFile(async (f, cfg, _signal, onMsg) => {
      const { loadSignature, signatureBytes } = await import('./signature');
      const sig = loadSignature();
      if (!sig) { onMsg?.('No signature saved on this device — Sign step skipped'); return f; }
      const { PDFDocument } = await import('pdf-lib');
      const doc = await PDFDocument.load(await f.arrayBuffer(), { ignoreEncryption: true, updateMetadata: false });
      const bytes = signatureBytes(sig);
      const img = sig.isPng ? await doc.embedPng(bytes) : await doc.embedJpg(bytes);
      const pages = doc.getPages();
      const which = String(cfg.page ?? 'last');
      const targets = which === 'all' ? pages : which === 'first' ? [pages[0]] : [pages[pages.length - 1]];
      const wPct = Math.min(60, Math.max(5, Number(cfg.widthPct ?? 22))) / 100;
      const pos = String(cfg.pos ?? 'br');
      const M = 28; // pt from the page edges
      for (const page of targets) {
        if (!page) continue;
        const { width: W, height: H } = page.getSize();
        const w = W * wPct;
        const h = w * (sig.h / sig.w);
        const x = pos.endsWith('l') ? M : pos.endsWith('c') ? (W - w) / 2 : W - w - M;
        const y = pos.startsWith('t') ? H - h - M : M;
        page.drawImage(img, { x, y, width: w, height: h });
      }
      const out = await doc.save({ useObjectStreams: true });
      return asFile(out, `${stem(f.name)}-signed.pdf`);
    }),
  },

  watermark: {
    id: 'watermark', label: 'Watermark', blurb: 'Stamp text across every page', color: '--amber', glyph: '💧',
    fields: [
      { key: 'text', label: 'Text', type: 'text', default: 'CONFIDENTIAL', placeholder: 'CONFIDENTIAL' },
      { key: 'pos', label: 'Position', type: 'select', default: 'tiled', options: [
        { value: 'tiled', label: 'Tiled across the page' }, { value: 'mc', label: 'Centre' },
        { value: 'bc', label: 'Bottom centre' }, { value: 'tc', label: 'Top centre' },
        { value: 'br', label: 'Bottom right' }, { value: 'tr', label: 'Top right' }] },
      { key: 'angle', label: 'Angle', type: 'select', default: '-30', options: [
        { value: '-30', label: 'Diagonal' }, { value: '0', label: 'Straight' }, { value: '-90', label: 'Sideways' }] },
      { key: 'sizePct', label: 'Size', type: 'number', suffix: '%', default: 8, min: 2, max: 30 },
      { key: 'opacityPct', label: 'Opacity', type: 'number', suffix: '%', default: 18, min: 3, max: 100 },
      { key: 'layer', label: 'Layer', type: 'select', default: 'over', options: [
        { value: 'over', label: 'Over the content' }, { value: 'under', label: 'Behind the content' }] },
    ],
    run: perFile(async (f, cfg, signal) => {
      const bytes = await rewritePdf(f, { type: 'watermark', opts: {
        mode: 'text',
        text: String(cfg.text ?? '').trim() || 'CONFIDENTIAL',
        colorRgb: [0.45, 0.45, 0.5],
        sizeFrac: Math.min(0.3, Math.max(0.02, Number(cfg.sizePct ?? 8) / 100)),
        opacity: Math.min(1, Math.max(0.03, Number(cfg.opacityPct ?? 18) / 100)),
        position: String(cfg.pos ?? 'tiled'),
        rotation: Number(cfg.angle ?? -30),
        imageScale: 0.3,
        layer: String(cfg.layer ?? 'over') === 'under' ? 'under' : 'over',
        range: '', // every page
        standardFont: 'Helvetica',
      } }, { signal });
      return asFile(bytes, `${stem(f.name)}-watermarked.pdf`);
    }),
  },

  // Non-interactive sibling of the Share-safe PDF check: it removes the hidden
  // data that leaks when a file is forwarded. It deliberately does NOT redact
  // visible text — that needs a human eye, so the full tool keeps that job.
  'share-safe': {
    id: 'share-safe', label: 'Share-safe clean', blurb: 'Strip hidden data, scripts & links', color: '--coral', glyph: '🛡️',
    fields: [{ key: 'links', label: 'Clickable links', type: 'select', default: 'remove', options: [
      { value: 'remove', label: 'Remove' }, { value: 'keep', label: 'Keep' }] }],
    run: perFile(async (f, cfg, _signal, onMsg) => {
      const { PDFDocument, PDFName, PDFDict } = await import('pdf-lib');
      const { scanDocMetadata, stripDocMetadata } = await import('@/lib/pdf-sanitize');
      const doc = await PDFDocument.load(await f.arrayBuffer(), { ignoreEncryption: true });
      const ctx = doc.context;
      const scan = await scanDocMetadata(doc);
      const metaRemoved = await stripDocMetadata(doc);

      // Document-level scripts & attachments.
      let scripts = 0;
      let attachments = 0;
      const names = ctx.lookup(doc.catalog.get(PDFName.of('Names')));
      if (names instanceof PDFDict) {
        if (names.has(PDFName.of('JavaScript'))) { names.delete(PDFName.of('JavaScript')); scripts++; }
        if (names.has(PDFName.of('EmbeddedFiles'))) { names.delete(PDFName.of('EmbeddedFiles')); attachments++; }
      }
      for (const key of ['OpenAction', 'AA'] as const) {
        if (doc.catalog.has(PDFName.of(key))) { doc.catalog.delete(PDFName.of(key)); scripts++; }
      }

      // Per-page: link annotations + page-open actions.
      let links = 0;
      const dropLinks = String(cfg.links ?? 'remove') !== 'keep';
      for (const page of doc.getPages()) {
        if (page.node.has(PDFName.of('AA'))) { page.node.delete(PDFName.of('AA')); scripts++; }
        const annots = page.node.Annots();
        if (!annots || !dropLinks) continue;
        for (let i = annots.size() - 1; i >= 0; i--) {
          const a = ctx.lookup(annots.get(i));
          if (a instanceof PDFDict && String(ctx.lookup(a.get(PDFName.of('Subtype')))) === '/Link') { annots.remove(i); links++; }
        }
      }

      const parts = [
        metaRemoved ? `${metaRemoved} metadata item${metaRemoved > 1 ? 's' : ''}` : '',
        scan.xmpBytes ? 'XMP block' : '',
        links ? `${links} link${links > 1 ? 's' : ''}` : '',
        scripts ? 'scripts' : '',
        attachments ? 'attachments' : '',
      ].filter(Boolean);
      onMsg?.(parts.length ? `Share-safe: removed ${parts.join(', ')}` : 'Share-safe: nothing hidden found');

      const out = await doc.save({ useObjectStreams: true });
      return asFile(out, `${stem(f.name)}-share-safe.pdf`);
    }),
  },

  'clean-scanned': {
    id: 'clean-scanned', label: 'Clean scanned', blurb: 'Whiten & sharpen a scan or photo', color: '--cyan', glyph: '📷',
    fields: [
      { key: 'mode', label: 'Look', type: 'select', default: 'clean', options: [
        { value: 'clean', label: 'Clean grey' }, { value: 'bw', label: 'Pure black & white' }] },
      { key: 'contrast', label: 'Contrast', type: 'number', default: 18, min: 0, max: 60 },
    ],
    run: perFile(async (f, cfg, signal, onMsg) => {
      const { cleanScanToPdf } = await import('@/lib/clean-scan-core');
      const bytes = await cleanScanToPdf(f, {
        mode: String(cfg.mode ?? 'clean') === 'bw' ? 'bw' : 'clean',
        contrast: Math.min(60, Math.max(0, Number(cfg.contrast ?? 18))),
        signal, onMsg,
      });
      return asFile(bytes, `${stem(f.name)}-clean-scan.pdf`);
    }),
  },
};

// Palette order — roughly the order these make sense in a real pipeline.
export const STEP_ORDER: StepId[] = [
  'merge', 'delete', 'rotate', 'clean-scanned',
  'watermark', 'page-numbers', 'sign', 'flatten',
  'remove-metadata', 'share-safe', 'protect', 'compress-size',
];
