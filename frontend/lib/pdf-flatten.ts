// Pure pdf-lib scan of what Flatten PDF can act on: interactive form fields and
// non-widget annotations (comments, highlights, links…). Canvas-free so the
// dev-harness can run the REAL shipping code in Node (gate: flatten-qa.js).
import { PDFDocument, PDFArray, PDFDict, PDFName } from 'pdf-lib';

export type FlattenScan = {
  pages: number;
  /** Interactive AcroForm fields (text boxes, checkboxes, dropdowns…). */
  fields: number;
  /** Non-widget annotations: comments, highlights, stamps, links… */
  annotations: number;
  encrypted: boolean;
};

export async function scanFlattenables(bytes: Uint8Array): Promise<FlattenScan> {
  let doc: PDFDocument;
  try {
    doc = await PDFDocument.load(bytes);
  } catch (e) {
    if (e instanceof Error && /encrypted/i.test(e.message)) {
      return { pages: 0, fields: 0, annotations: 0, encrypted: true };
    }
    throw e;
  }

  let fields = 0;
  try {
    fields = doc.getForm().getFields().length;
  } catch {
    // Malformed AcroForm — qpdf itself copes; just report 0 detectable fields.
  }

  let annotations = 0;
  for (const page of doc.getPages()) {
    const annots = page.node.Annots();
    if (!(annots instanceof PDFArray)) continue;
    for (let i = 0; i < annots.size(); i++) {
      try {
        const dict = doc.context.lookup(annots.get(i));
        if (!(dict instanceof PDFDict)) continue;
        const subtype = dict.get(PDFName.of('Subtype'));
        // Widgets are the visible half of form fields — counted under `fields`.
        if (subtype !== PDFName.of('Widget')) annotations++;
      } catch {
        // Broken annotation ref — ignore; flatten will still run.
      }
    }
  }

  return { pages: doc.getPageCount(), fields, annotations, encrypted: false };
}
