// Fill-a-PDF-form engine — all on-device. Two complementary layers:
//
//  1. NATIVE fields (AcroForm, v1.1). A real fillable PDF embeds named input
//     widgets — text boxes, checkboxes, radio groups, dropdowns, lists, signature
//     fields. We read each widget's box/type/page/flags so the tool can light them
//     up in place, let you click/Tab through them, and write your answers back
//     INTO the fields — so the download either stays fillable (keep-editable) or is
//     flattened & locked. Coordinates are page fractions (top-left origin) so the
//     editor overlay and the output line up pixel-for-pixel.
//
//  2. PLACE-ANYWHERE overlay (the original tool). For flat scans with no fields —
//     and for extras on real forms — you drop your own text/ticks/dates/signature
//     anywhere; each is rendered to a crisp transparent PNG and drawn onto the page
//     with pdf-lib. Overlays are page content, so they're always baked (permanent).
//
// pdf.js/canvas render can't be exercised in the Node sandbox; the pdf-lib read/
// write paths here are all verified headlessly (see the session notes).

export type FillKind = 'text' | 'check' | 'x' | 'date' | 'signature';

export type FillEl = {
  id: string;
  page: number;      // 0-based
  kind: FillKind;
  text: string;
  xFrac: number;     // top-left, fraction of page width
  yFrac: number;     // top-left, fraction of page height
  fontFrac: number;  // font size as a fraction of page height
  color: string;
};

export function fontFamilyFor(kind: FillKind): string {
  return kind === 'signature' ? '"Segoe Script","Brush Script MT","Snell Roundhand",cursive' : 'Arial, "Helvetica Neue", sans-serif';
}
export function glyphFor(kind: FillKind, text: string): string {
  return kind === 'check' ? '✓' : kind === 'x' ? '✗' : text;
}

// Draw an element to a tightly-cropped transparent canvas at the given px size.
export function elementToCanvas(el: FillEl, fontPx: number): HTMLCanvasElement {
  const family = fontFamilyFor(el.kind);
  const bold = el.kind === 'check' || el.kind === 'x';
  const text = glyphFor(el.kind, el.text) || ' ';
  const font = `${bold ? 'bold ' : ''}${fontPx}px ${family}`;
  const measure = document.createElement('canvas').getContext('2d');
  if (!measure) throw new Error('Your browser blocked canvas access.');
  measure.font = font;
  const w = Math.max(1, Math.ceil(measure.measureText(text).width) + Math.ceil(fontPx * 0.12));
  const h = Math.ceil(fontPx * 1.3);
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  const cx = canvas.getContext('2d');
  if (!cx) throw new Error('Your browser blocked canvas access.');
  cx.font = font;
  cx.fillStyle = el.color || '#1e3a8a';
  cx.textBaseline = 'middle';
  cx.fillText(text, Math.ceil(fontPx * 0.06), h / 2);
  return canvas;
}

// ── Native AcroForm layer ──────────────────────────────────────────────────

export type NativeFieldType = 'text' | 'checkbox' | 'radio' | 'dropdown' | 'optionlist' | 'signature';

// One clickable hotspot over a real form widget. `name` keys the value; several
// hotspots can share a name (a field placed on more than one page).
export type NativeField = {
  key: string;                 // unique per hotspot (name + widget index)
  name: string;                // AcroForm field name (the value key)
  type: NativeFieldType;
  page: number;                // 0-based
  rect: { x: number; y: number; w: number; h: number }; // fractions, top-left origin
  required: boolean;
  readOnly: boolean;
  options?: string[];          // radio / dropdown / optionlist choices
  editable?: boolean;          // dropdown allows a custom typed value
  multiSelect?: boolean;       // option list allows multiple
  maxLen?: number;             // text field character cap
  multiline?: boolean;         // text field accepts newlines
  order: number;               // Tab order (page, then top-to-bottom, left-to-right)
};

// text -> string · checkbox -> boolean · radio/dropdown -> string · optionlist -> string[]
export type NativeValue = string | boolean | string[];

export type FontKey = 'Helvetica' | 'Times' | 'Courier';
export type FieldCustom = {
  size?: number | 'auto';      // point size, or 'auto' to fit the box
  font?: FontKey;
  color?: string;              // hex, e.g. '#111827'
  align?: 'left' | 'center' | 'right';
};

// True for a field the user can actually put a value into by clicking it.
export function isFillable(t: NativeFieldType): boolean {
  return t === 'text' || t === 'checkbox' || t === 'radio' || t === 'dropdown' || t === 'optionlist';
}

// Read every AcroForm widget's geometry, type and constraints. Returns [] for a
// flat PDF (no form) — the tool then falls back to the place-anywhere overlay.
export async function extractNativeFields(file: File): Promise<NativeField[]> {
  const { PDFDocument, PDFTextField, PDFCheckBox, PDFRadioGroup, PDFDropdown, PDFOptionList, PDFSignature } = await import('pdf-lib');
  let doc;
  try {
    doc = await PDFDocument.load(new Uint8Array(await file.arrayBuffer()), { ignoreEncryption: true });
  } catch {
    return [];
  }
  let form;
  try { form = doc.getForm(); } catch { return []; }
  const fields = form.getFields();
  if (!fields.length) return [];

  const pages = doc.getPages();
  // page ref (identity) -> { index, mediabox }
  const pageInfo = pages.map((p) => ({ ref: p.ref, mb: p.getMediaBox() }));

  const out: NativeField[] = [];
  for (const field of fields) {
    const name = field.getName();
    // Use instanceof, NOT constructor.name — the production minifier mangles
    // class names, so name checks silently mis-type every field as text.
    const type: NativeFieldType =
      field instanceof PDFTextField ? 'text'
      : field instanceof PDFCheckBox ? 'checkbox'
      : field instanceof PDFRadioGroup ? 'radio'
      : field instanceof PDFDropdown ? 'dropdown'
      : field instanceof PDFOptionList ? 'optionlist'
      : field instanceof PDFSignature ? 'signature'
      : 'text';

    // metadata (guarded — not every field type has every getter)
    const anyField = field as unknown as {
      isRequired?: () => boolean; isReadOnly?: () => boolean;
      getOptions?: () => string[]; isEditable?: () => boolean; isMultiselect?: () => boolean;
      getMaxLength?: () => number | undefined; isMultiline?: () => boolean;
    };
    // Wrap in thunks so each getter is called AS A METHOD (preserves `this`);
    // passing the bare function reference would detach it and throw.
    const required = safeBool(() => anyField.isRequired?.());
    const readOnly = safeBool(() => anyField.isReadOnly?.());
    const options = type === 'radio' || type === 'dropdown' || type === 'optionlist' ? safeArr(() => anyField.getOptions?.()) : undefined;
    const editable = type === 'dropdown' ? safeBool(() => anyField.isEditable?.()) : undefined;
    const multiSelect = type === 'optionlist' ? safeBool(() => anyField.isMultiselect?.()) : undefined;
    const maxLen = type === 'text' ? safeNum(() => anyField.getMaxLength?.()) : undefined;
    const multiline = type === 'text' ? safeBool(() => anyField.isMultiline?.()) : undefined;

    // one hotspot per widget; radio groups collapse to a single hotspot (the
    // option pick happens in the side panel), so we only take the first widget.
    const widgets = (field as unknown as { acroField: { getWidgets: () => Array<{ getRectangle: () => { x: number; y: number; width: number; height: number }; P: () => unknown }> } }).acroField.getWidgets();
    const useWidgets = type === 'radio' ? widgets.slice(0, 1) : widgets;
    useWidgets.forEach((w, wi) => {
      const pref = w.P();
      const pi = pageInfo.findIndex((p) => p.ref === pref);
      if (pi < 0) return;
      const mb = pageInfo[pi].mb;
      if (!mb.width || !mb.height) return;
      const r = w.getRectangle();
      const x = (r.x - mb.x) / mb.width;
      const yTop = (mb.y + mb.height - (r.y + r.height)) / mb.height;
      out.push({
        key: `${name}#${wi}`,
        name, type, page: pi,
        rect: { x, y: yTop, w: r.width / mb.width, h: r.height / mb.height },
        required, readOnly, options, editable, multiSelect, maxLen, multiline,
        order: 0,
      });
    });
  }

  // Tab order: page, then reading order (top-to-bottom, left-to-right), with a
  // small row tolerance so items on the same line sort by x.
  out.sort((a, b) => {
    if (a.page !== b.page) return a.page - b.page;
    if (Math.abs(a.rect.y - b.rect.y) > 0.02) return a.rect.y - b.rect.y;
    return a.rect.x - b.rect.x;
  });
  out.forEach((f, i) => { f.order = i; });
  return out;
}

function safeBool(fn: () => boolean | undefined): boolean { try { return !!fn(); } catch { return false; } }
function safeArr(fn: () => string[] | undefined): string[] | undefined { try { const v = fn(); return Array.isArray(v) ? v : undefined; } catch { return undefined; } }
function safeNum(fn: () => number | undefined): number | undefined { try { const v = fn(); return typeof v === 'number' ? v : undefined; } catch { return undefined; } }

// #rrggbb -> "r g b" components (0..1, 3dp) for a PDF colour operator.
function hexToRgbOp(hex?: string): string {
  const m = /^#?([0-9a-f]{6})$/i.exec((hex || '').trim());
  if (!m) return '0 0 0';
  const n = parseInt(m[1], 16);
  const r = ((n >> 16) & 255) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
  return `${+r.toFixed(3)} ${+g.toFixed(3)} ${+b.toFixed(3)}`;
}

const FONT_STD: Record<FontKey, string> = { Helvetica: 'Helvetica', Times: 'TimesRoman', Courier: 'Courier' };
// Short DA resource token per family (cosmetic — the real font is passed to
// updateAppearances; only the size + colour in the DA are read back).
const FONT_TOKEN: Record<FontKey, string> = { Helvetica: 'Helv', Times: 'TiRo', Courier: 'Cour' };

export async function detectFieldCount(file: File): Promise<number> {
  try {
    const { PDFDocument } = await import('pdf-lib');
    const doc = await PDFDocument.load(new Uint8Array(await file.arrayBuffer()), { ignoreEncryption: true });
    return doc.getForm().getFields().length;
  } catch {
    return 0;
  }
}

export type NativeExport = {
  values: Record<string, NativeValue>;
  custom: Record<string, FieldCustom>;
  fields: NativeField[];
  flatten: boolean;            // false = keep the form editable
};

// Build the final PDF: write native values (+ per-field font/size/colour/align),
// draw any place-anywhere overlays, then flatten (lock) or keep the form editable.
export async function exportFilledPdf(file: File, overlays: FillEl[], native?: NativeExport): Promise<Blob> {
  const pdfLib = await import('pdf-lib');
  const { PDFDocument, StandardFonts, TextAlignment } = pdfLib;
  const doc = await PDFDocument.load(new Uint8Array(await file.arrayBuffer()), { ignoreEncryption: true });

  // 1) Native fields ---------------------------------------------------------
  if (native && native.fields.length) {
    const form = doc.getForm();
    const fontCache = new Map<FontKey, Awaited<ReturnType<typeof doc.embedFont>>>();
    const fontFor = async (key: FontKey) => {
      let f = fontCache.get(key);
      if (!f) { f = await doc.embedFont(StandardFonts[FONT_STD[key] as keyof typeof StandardFonts]); fontCache.set(key, f); }
      return f;
    };
    const alignEnum = (a?: string) => a === 'center' ? TextAlignment.Center : a === 'right' ? TextAlignment.Right : TextAlignment.Left;

    // one field object per NAME (hotspots may repeat a name across pages)
    const byName = new Map<string, NativeField>();
    for (const f of native.fields) if (!byName.has(f.name)) byName.set(f.name, f);

    for (const [name, meta] of Array.from(byName.entries())) {
      if (meta.readOnly) continue;
      const value = native.values[name];
      const c = native.custom[name] || {};
      try {
        if (meta.type === 'text') {
          const tf = form.getTextField(name);
          tf.setText(typeof value === 'string' ? value : '');
          // Apply for both modes: keep-editable renders it, and flatten reads the
          // DA colour/size when baking the appearance.
          const fontKey = c.font || 'Helvetica';
          const size = c.size === 'auto' || c.size == null ? 0 : c.size; // 0 = auto-fit
          // DA carries size + colour; set AFTER any size call so it isn't clobbered.
          tf.acroField.setDefaultAppearance(`/${FONT_TOKEN[fontKey]} ${size} Tf ${hexToRgbOp(c.color)} rg`);
          tf.setAlignment(alignEnum(c.align));
          try { tf.updateAppearances(await fontFor(fontKey)); } catch { /* appearance best-effort */ }
        } else if (meta.type === 'checkbox') {
          const cb = form.getCheckBox(name);
          if (value === true) cb.check(); else cb.uncheck();
        } else if (meta.type === 'radio') {
          if (typeof value === 'string' && value) { try { form.getRadioGroup(name).select(value); } catch { /* stale option */ } }
        } else if (meta.type === 'dropdown') {
          const dd = form.getDropdown(name);
          if (typeof value === 'string' && value) {
            if ((meta.options || []).includes(value)) dd.select(value);
            else if (meta.editable) { try { dd.setOptions([...(meta.options || []), value]); dd.select(value); } catch { /* ignore */ } }
          }
        } else if (meta.type === 'optionlist') {
          const ol = form.getOptionList(name);
          const vals = Array.isArray(value) ? value : typeof value === 'string' && value ? [value] : [];
          if (vals.length) ol.select(vals);
        }
      } catch { /* a field that won't take its value shouldn't sink the whole export */ }
    }

    if (native.flatten) {
      try { form.flatten(); } catch { /* nothing to flatten */ }
    }
  }

  // 2) Place-anywhere overlays (always baked page content) --------------------
  const pages = doc.getPages();
  for (const el of overlays) {
    const page = pages[el.page];
    if (!page) continue;
    const { width: W, height: H } = page.getSize();
    const fontPt = Math.max(4, el.fontFrac * H);
    const canvas = elementToCanvas(el, fontPt * 4); // 4× supersample for crisp text
    const pngBlob = await new Promise<Blob>((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error('encode'))), 'image/png'));
    const img = await doc.embedPng(await pngBlob.arrayBuffer());
    const imgH = fontPt * 1.3;
    const imgW = imgH * (canvas.width / canvas.height);
    const x = el.xFrac * W;
    const y = H - el.yFrac * H - imgH; // PDF origin is bottom-left
    page.drawImage(img, { x, y, width: imgW, height: imgH });
  }

  // 3) A flat form with overlays only: lock it too if there was a form at all.
  if (!native) { try { doc.getForm().flatten(); } catch { /* no form */ } }

  const bytes = await doc.save();
  return new Blob([new Uint8Array(bytes)], { type: 'application/pdf' });
}
