'use client';

// Repair a damaged PDF — 100% on-device. Broken PDFs usually have a corrupt
// cross-reference table (the index pdf readers use to find objects), truncated
// trailers, or malformed metadata. Loading with a tolerant parser and RE-SAVING
// rebuilds the xref from scratch and drops unreferenced junk, which is what
// most "please repair" cases actually need. We also cross-check with pdf.js so
// we can honestly report how many pages came back.
import { getPdfjs } from './pdf-render';

export type RepairResult = {
  blob: Blob;
  name: string;
  pages: number;
  beforeBytes: number;
  afterBytes: number;
  notes: string[]; // human-readable list of what the repair did
};

export async function repairPdf(file: File): Promise<RepairResult> {
  const src = new Uint8Array(await file.arrayBuffer());
  const notes: string[] = [];

  // What can pdf.js actually read out of it? (best-effort page recovery)
  let pdfjsPages = 0;
  try {
    const pdfjs = await getPdfjs();
    const task = pdfjs.getDocument({ data: src.slice(), stopAtErrors: false });
    const doc = await task.promise;
    pdfjsPages = doc.numPages;
    await task.destroy();
  } catch { /* pdf.js couldn't parse it — pdf-lib may still rebuild it */ }

  const { PDFDocument } = await import('pdf-lib');
  let doc;
  try {
    // The tolerant path: don't throw on the very errors we're here to fix.
    doc = await PDFDocument.load(src, { ignoreEncryption: true, throwOnInvalidObject: false, updateMetadata: false });
  } catch (e) {
    throw new RepairError(pdfjsPages, e instanceof Error ? e.message : 'parse failed');
  }

  const pages = doc.getPageCount();
  if (pages === 0) throw new RepairError(pdfjsPages, 'no readable pages');

  notes.push('Rebuilt the cross-reference table and object index');
  if (pdfjsPages && pages >= pdfjsPages) notes.push(`Recovered all ${pages} page${pages === 1 ? '' : 's'}`);
  else notes.push(`Kept ${pages} readable page${pages === 1 ? '' : 's'}`);

  // Normalize metadata dates — a common corruption source; harmless to reset.
  try {
    doc.setModificationDate(new Date());
    if (!doc.getTitle()) doc.setTitle(file.name.replace(/\.pdf$/i, ''));
    notes.push('Cleaned document metadata');
  } catch { /* non-fatal */ }

  // Re-serialize with object streams off for maximum reader compatibility.
  const out = await doc.save({ useObjectStreams: false });
  const blob = new Blob([out as unknown as BlobPart], { type: 'application/pdf' });
  if (blob.size < src.length) notes.push(`Dropped unreferenced data — ${Math.max(1, Math.round((1 - blob.size / src.length) * 100))}% smaller`);

  return {
    blob,
    name: file.name.replace(/\.pdf$/i, '') + '-repaired.pdf',
    pages,
    beforeBytes: src.length,
    afterBytes: blob.size,
    notes,
  };
}

// Thrown when the file is too damaged even for the tolerant parser — carries
// whatever pdf.js managed to see so the UI can be specific, not just "failed".
export class RepairError extends Error {
  recoverablePages: number;
  constructor(recoverablePages: number, detail: string) {
    super(detail);
    this.recoverablePages = recoverablePages;
  }
}
