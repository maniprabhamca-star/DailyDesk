// Shared PDF metadata scanner/stripper. Two consumers:
//  - Compress PDF: strips before save at every level — lossless bytes (XMP
//    packets are 3-20KB on office files) and a privacy win in one move.
//  - The Remove-PDF-metadata tool: scans + shows what's inside, then strips.
// What's covered: the document Info dictionary (Title/Author/Producer/dates/
// custom keys), the XMP metadata stream (/Metadata on the catalog), per-page
// embedded thumbnails (/Thumb), and /PieceInfo private application data (both
// page-level and catalog-level). Everything else is untouched — no content,
// no fonts, no images, so the document renders identically.

import type { PDFDocument } from 'pdf-lib';

export type MetadataScan = {
  /** Standard + custom Info-dictionary fields that are present. */
  fields: Array<{ key: string; value: string }>;
  /** Size of the XMP metadata stream in bytes (0 = none). */
  xmpBytes: number;
  /** Number of pages carrying an embedded thumbnail. */
  thumbs: number;
  /** Whether /PieceInfo private application data exists anywhere. */
  pieceInfo: boolean;
};

export async function scanDocMetadata(doc: PDFDocument): Promise<MetadataScan> {
  const { PDFName, PDFDict, PDFRawStream, PDFString, PDFHexString } = await import('pdf-lib');
  const ctx = doc.context;
  const fields: Array<{ key: string; value: string }> = [];
  const infoRef = ctx.trailerInfo.Info;
  const info = infoRef ? ctx.lookup(infoRef) : undefined;
  if (info instanceof PDFDict) {
    for (const [k, v] of info.entries()) {
      const val = ctx.lookup(v);
      let s = '';
      if (val instanceof PDFString || val instanceof PDFHexString) s = val.decodeText();
      else if (val) s = String(val);
      if (s) fields.push({ key: k.decodeText(), value: s });
    }
  }
  let xmpBytes = 0;
  const meta = ctx.lookup(doc.catalog.get(PDFName.of('Metadata')));
  if (meta instanceof PDFRawStream) xmpBytes = (meta.contents as Uint8Array).length;
  let thumbs = 0;
  let pieceInfo = doc.catalog.has(PDFName.of('PieceInfo'));
  for (const page of doc.getPages()) {
    if (page.node.has(PDFName.of('Thumb'))) thumbs++;
    if (page.node.has(PDFName.of('PieceInfo'))) pieceInfo = true;
  }
  return { fields, xmpBytes, thumbs, pieceInfo };
}

/** Remove Info entries, the XMP stream, page thumbnails and /PieceInfo.
 * Returns the number of items removed. Call right BEFORE save — pdf-lib's
 * load(updateMetadata:true) default re-writes Producer/ModDate at load time. */
export async function stripDocMetadata(doc: PDFDocument): Promise<number> {
  const { PDFName, PDFDict, PDFRef } = await import('pdf-lib');
  const ctx = doc.context;
  let removed = 0;

  const infoRef = ctx.trailerInfo.Info;
  const info = infoRef ? ctx.lookup(infoRef) : undefined;
  if (info instanceof PDFDict) {
    for (const [k] of info.entries()) {
      info.delete(k);
      removed++;
    }
  }

  const metaRef = doc.catalog.get(PDFName.of('Metadata'));
  if (metaRef) {
    doc.catalog.delete(PDFName.of('Metadata'));
    if (metaRef instanceof PDFRef) ctx.delete(metaRef);
    removed++;
  }
  if (doc.catalog.has(PDFName.of('PieceInfo'))) {
    doc.catalog.delete(PDFName.of('PieceInfo'));
    removed++;
  }

  for (const page of doc.getPages()) {
    const t = page.node.get(PDFName.of('Thumb'));
    if (t) {
      page.node.delete(PDFName.of('Thumb'));
      if (t instanceof PDFRef) ctx.delete(t);
      removed++;
    }
    if (page.node.has(PDFName.of('PieceInfo'))) {
      page.node.delete(PDFName.of('PieceInfo'));
      removed++;
    }
  }
  return removed;
}
