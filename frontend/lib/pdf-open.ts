// The one place a PDF gets opened for PDF-LIB. Note the name: lib/pdf-render.ts
// already exports `openPdf`, which returns a pdf.js handle for rendering and
// takes a password of its own — pdf.js decrypts by itself, so it never needed
// any of this. This module is the pdf-lib side, hence openPdfDoc. Import `openPdf` instead of
// calling `PDFDocument.load` yourself; tests/unit/pdf-open.test.ts fails the
// build if a tool hand-writes the load again.
//
// ── Why this module exists ───────────────────────────────────────────────────
// Every tool used to call `PDFDocument.load(bytes, { ignoreEncryption: true })`.
// That flag does NOT decrypt — it only skips pdf-lib's refusal to open an
// encrypted file. pdf-lib has no decryption at all, so the object streams stay
// encrypted and the very next operation dies on them. Measured on the real
// files, with the current USCIS Form I-130:
//
//   load + save        (Rotate, Edit details)        -> throws
//   copyPages          (Merge, Split, Delete pages)  -> throws
//   drawText           (Page numbers, Bates, Watermark) -> throws
//   embedPdf           (Pages per sheet, N-up)       -> throws
//   getForm().getFields() (Fill form, Flatten)       -> returns 0, SILENTLY
//
// So an encrypted PDF did not degrade gracefully anywhere: it either threw a
// developer error at the user or, worse, quietly reported a fillable
// government form as having no fields and offered the place-anywhere overlay
// instead. That last one is the dangerous kind of bug — nothing looks broken.
//
// This is not a rare input. Most of the high-volume USCIS petitions ship
// encrypted (I-130, I-485, I-765, N-400 — all of them open without a password,
// they are owner-restricted only), and so do plenty of bank statements.
//
// ── The fix ──────────────────────────────────────────────────────────────────
// qpdf, which we already ship as WebAssembly for Protect/Unlock PDF, decrypts
// them properly. Proven on all four petitions: exit 0, no /Encrypt in the
// output, and pdf-lib then reads every field (450 on I-130, 730 on I-485, 440
// on N-400, 161 on I-765 — against 0 before).
//
// We only reach for qpdf when a plain load fails AND the bytes declare
// /Encrypt, so an ordinary PDF never pays for the WebAssembly start-up.
//
// ⚠ WORKERS: qpdf's inline fallback builds a <script> tag, so it needs a DOM.
// Do NOT call openPdfDoc from inside a worker — decrypt on the main thread and
// post the clean bytes in. lib/pdf-rewrite.ts does exactly that, because
// lib/pdf-rewrite-core.ts runs in lib/pdf-rewrite.worker.ts.
import type { PDFDocument as PDFDocumentType } from 'pdf-lib';
import { runQpdf, QpdfError } from './qpdf';

/** Thrown when the file needs a password we do not have. User-presentable. */
export class PdfLockedError extends Error {
  constructor() {
    super('This PDF is locked with a password. Remove it first with Unlock PDF, then try again.');
    this.name = 'PdfLockedError';
  }
}

// Cheap gate before we start a WebAssembly engine. A false positive only costs
// one wasted qpdf run on a file that already failed to load, and a false
// negative just means we rethrow the original parse error — which is what the
// old code did anyway.
/** Callers hold bytes in whichever shape their source gave them. */
export type PdfBytes = Uint8Array | ArrayBuffer;

const asBytes = (b: PdfBytes): Uint8Array => (b instanceof Uint8Array ? b : new Uint8Array(b));

export function declaresEncryption(input: PdfBytes): boolean {
  const bytes = asBytes(input);
  // /Encrypt lives in the trailer, but a cross-reference STREAM puts it in a
  // dictionary that can sit anywhere, so scan the tail generously and then the
  // whole buffer. Latin-1 keeps byte offsets honest.
  const tail = new TextDecoder('latin1').decode(bytes.subarray(Math.max(0, bytes.length - 8192)));
  if (/\/Encrypt\b/.test(tail)) return true;
  return /\/Encrypt\b/.test(new TextDecoder('latin1').decode(bytes));
}

/** Strip encryption with qpdf, using the empty user password. */
export async function decryptPdf(input: PdfBytes): Promise<Uint8Array> {
  const bytes = asBytes(input);
  try {
    // Copy: runQpdf TRANSFERS the buffer to the worker, which would detach the
    // caller's array and leave them holding an empty Uint8Array.
    const blob = new Blob([bytes.slice() as unknown as BlobPart], { type: 'application/pdf' });
    return await runQpdf(blob, { type: 'decrypt', password: '' });
  } catch (e) {
    // A non-zero exit on an EMPTY password means the file wants a real one.
    if (e instanceof QpdfError) throw new PdfLockedError();
    throw e;
  }
}

export type OpenPdfOptions = {
  /**
   * pdf-lib's own flag, and we keep ITS default of `true` rather than picking a
   * nicer one, so swapping a `PDFDocument.load` for an `openPdfDoc` changes
   * nothing but the encryption handling. Tools that must not stamp ModDate and
   * a pdf-lib Producer string already pass `false` explicitly, and they keep
   * doing that.
   */
  updateMetadata?: boolean;
};

/**
 * Open `bytes` for pdf-lib, decrypting first if that is what is in the way.
 * Returns a document every pdf-lib operation actually works on.
 */
const RICH_TEXT_FLAG = 1 << 25; // bit 26, ISO 32000-1 table 228

/**
 * Clear the rich-text marking on any text field that carries it.
 *
 * pdf-lib regenerates field appearances inside `save()` and throws outright on
 * a rich-text field — "Reading rich text fields is not supported". Form I-485
 * has them, so Merge, Rotate, Watermark and Page numbers would STILL fail on
 * it after decryption, for a reason with nothing to do with what they did.
 *
 * Doing it here means the 61 `doc.save()` calls across the codebase keep
 * working untouched. It is safe: `/RV` is a formatted-text alternative to the
 * plain `/V` value, pdf-lib never reads or writes it, and the plain value is
 * what every one of our tools uses. Only reached when a field actually
 * declares it, so an ordinary PDF is not modified.
 */
async function neutraliseRichText(doc: PDFDocumentType): Promise<void> {
  const { PDFName, PDFNumber } = await import('pdf-lib');
  // getForm() CREATES an AcroForm when none exists, which would quietly add a
  // form to every plain PDF we open. Only proceed if the catalog has one.
  const hasForm = !!doc.catalog.lookup(PDFName.of('AcroForm'));
  if (!hasForm) return;

  let fields;
  try { fields = doc.getForm().getFields(); } catch { return; }

  for (const field of fields) {
    const dict = field.acroField.dict;
    const ff = dict.lookup(PDFName.of('Ff'));
    const flags = ff && typeof (ff as { asNumber?: () => number }).asNumber === 'function'
      ? (ff as { asNumber: () => number }).asNumber()
      : 0;
    const hasRV = !!dict.get(PDFName.of('RV'));
    if (!(flags & RICH_TEXT_FLAG) && !hasRV) continue;
    if (flags & RICH_TEXT_FLAG) dict.set(PDFName.of('Ff'), PDFNumber.of(flags & ~RICH_TEXT_FLAG));
    if (hasRV) dict.delete(PDFName.of('RV'));
  }
}

export async function openPdfDoc(input: PdfBytes, opts: OpenPdfOptions = {}): Promise<PDFDocumentType> {
  const bytes = asBytes(input);
  const { PDFDocument } = await import('pdf-lib');
  const load = (b: Uint8Array) =>
    PDFDocument.load(b as unknown as Uint8Array, {
      // Deliberately NOT ignoreEncryption: we want the failure, so we can go
      // and actually fix it rather than carrying on with unreadable objects.
      updateMetadata: opts.updateMetadata ?? true,
    });

  let doc: PDFDocumentType;
  try {
    doc = await load(bytes.slice());
  } catch (first) {
    if (!declaresEncryption(bytes)) throw first;
    const clear = await decryptPdf(bytes);
    doc = await load(clear);
  }
  await neutraliseRichText(doc);
  return doc;
}

/** Convenience for the common `File` case. */
export async function openPdfDocFile(file: File | Blob, opts: OpenPdfOptions = {}): Promise<PDFDocumentType> {
  return openPdfDoc(new Uint8Array(await file.arrayBuffer()), opts);
}

/**
 * Decrypted bytes for code that cannot use `openPdfDoc` — a worker payload, or a
 * second library (pdf.js handles encryption itself, so it never needs this).
 * Returns the input untouched when there is nothing to do.
 */
export async function ensureDecrypted(input: PdfBytes): Promise<Uint8Array> {
  const bytes = asBytes(input);
  if (!declaresEncryption(bytes)) return bytes;
  return decryptPdf(bytes);
}

/**
 * Save a document whose FIELD VALUES we did not change.
 *
 * pdf-lib regenerates field appearances on save, and it throws outright on a
 * rich-text field — "Reading rich text fields is not supported". Form I-485
 * has them, so Merge/Rotate/Watermark/Page-numbers would still fail on it even
 * after decryption, for a reason that has nothing to do with what they did.
 * They never touch values, so skipping that pass is free and correct.
 *
 * The fill path must NOT use this — it needs appearances for the values it
 * wrote, and gets them from qpdf's --generate-appearances on flatten.
 */
export async function savePreservingFields(doc: PDFDocumentType): Promise<Uint8Array> {
  return doc.save({ updateFieldAppearances: false });
}
