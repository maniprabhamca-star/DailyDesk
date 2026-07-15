'use client';

// On-device table extraction for PDF → Excel. The whole point vs every competitor:
// the file is NEVER uploaded. We read each page's text WITH its x/y positions using
// pdf.js (the same engine as our other tools), then reconstruct rows and columns
// from the layout — grouping items into lines by their y, splitting lines into
// cells at horizontal gaps, and clustering cell x-positions into columns.
//
// This is "stream mode" table extraction (like tabula-py's lattice-free path): it
// works well for digital PDFs with real text (statements, invoices, data exports)
// and is honest about its limits — the UI lets the user fix any cell before export,
// and the Pro tier adds AI cleanup + OCR for the tables positional logic can't
// untangle. The core `itemsToTable` is pure (no pdf.js) so it's unit-testable.

import { openPdf } from './pdf-render';
import { itemsToTable, looksTabular, type TItem } from './table-extract';

export type { TItem } from './table-extract';
export { itemsToTable, looksTabular } from './table-extract';
// bbox is in PDF user units (origin bottom-left) so the UI can overlay a highlight
// on the rendered page; pageW/pageH are the page size in the same units.
export type Table = {
  page: number; rows: string[][]; cols: number;
  bbox: { x0: number; y0: number; x1: number; y1: number };
  pageW: number; pageH: number;
};

// Extract one candidate table per page (pages without a tabular layout are skipped).
export async function extractTables(
  file: File | Blob,
  onProgress?: (fraction: number) => void,
): Promise<{ tables: Table[]; numPages: number; hasText: boolean }> {
  const handle = await openPdf(file);
  const tables: Table[] = [];
  let anyText = false;
  try {
    for (let i = 0; i < handle.numPages; i++) {
      const page = await handle.doc.getPage(i + 1);
      const tc = await page.getTextContent();
      const items: TItem[] = tc.items
        .filter((it) => 'str' in it)
        .map((raw) => {
          const it = raw as { str: string; width: number; height: number; transform: number[] };
          return {
            x: it.transform[4],
            y: it.transform[5],
            w: it.width,
            h: Math.abs(it.transform[3]) || it.height || 10,
            s: it.str,
          };
        });
      const withText = items.filter((it) => it.s.trim());
      if (withText.length) anyText = true;
      const { rows, cols } = itemsToTable(items);
      if (looksTabular(rows, cols)) {
        const vp = page.getViewport({ scale: 1 });
        // Content bounds of the page's text = a good-enough highlight for the table.
        const x0 = Math.min(...withText.map((it) => it.x));
        const x1 = Math.max(...withText.map((it) => it.x + it.w));
        const y0 = Math.min(...withText.map((it) => it.y));
        const y1 = Math.max(...withText.map((it) => it.y + it.h));
        tables.push({ page: i + 1, rows, cols, bbox: { x0, y0, x1, y1 }, pageW: vp.width, pageH: vp.height });
      }
      (page as unknown as { cleanup?: () => void }).cleanup?.();
      onProgress?.((i + 1) / handle.numPages);
    }
  } finally {
    await handle.destroy();
  }
  return { tables, numPages: handle.numPages, hasText: anyText };
}
