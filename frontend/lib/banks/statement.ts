'use client';

// The Statement Converter pipeline: PDF → detected bank → transaction table →
// arithmetically verified. Runs ENTIRELY in the browser — a bank statement is the
// most sensitive document a person owns and every competitor uploads it. That claim
// is the product, so nothing here may touch the network.

import { openPdf } from '../pdf-render';
import { itemsToTable, type TItem } from '../table-extract';
import { fingerprintBank, type BankMatch } from './fingerprint';
import { validate, type Validation } from './balance';

export type StatementMeta = {
  account: string | null;   // masked before it ever reaches the UI
  period: string | null;
  ifsc: string | null;
};

export type StatementResult = {
  bank: BankMatch | null;
  meta: StatementMeta;
  validation: Validation;
  numPages: number;
  hasText: boolean;         // false = scanned image → needs OCR first
};

const HEADER_BAND = 0.72;   // top ~28% of page 1 — where the bank identifies itself
// Pages are stacked into ONE coordinate space by pushing each page far below the
// last, so a single itemsToTable() pass clusters columns across the WHOLE document.
// Per-page extraction would let page 2 invent different columns than page 1 and the
// grids wouldn't line up.
const PAGE_STRIDE = 100_000;

/** Mask everything but the last 4 digits. Applied at parse time — the full number
 *  is never put in state, rendered, or logged. */
function maskAccount(acc: string): string {
  const d = acc.replace(/[^0-9A-Za-z]/g, '');
  return d.length < 5 ? '••••' : `••••${d.slice(-4)}`;
}

function readMeta(headerText: string): StatementMeta {
  const t = headerText.replace(/\s+/g, ' ');
  const acc = t.match(/(?:A\/?C|ACCOUNT)\s*(?:NO|NUMBER)?\.?\s*:?\s*([0-9Xx*]{6,20})/i);
  const ifsc = t.match(/\b([A-Z]{4}0[A-Z0-9]{6})\b/);
  const period =
    t.match(/(?:FROM|PERIOD|BETWEEN)\s*:?\s*(\d{1,2}[/\-.][A-Za-z0-9]{2,3}[/\-.]\d{2,4})\s*(?:TO|-|–|AND)\s*(\d{1,2}[/\-.][A-Za-z0-9]{2,3}[/\-.]\d{2,4})/i)
    || t.match(/(\d{1,2}\s+[A-Za-z]{3}\s+\d{4})\s*(?:TO|-|–)\s*(\d{1,2}\s+[A-Za-z]{3}\s+\d{4})/i);
  return {
    account: acc ? maskAccount(acc[1]) : null,
    ifsc: ifsc ? ifsc[1] : null,
    period: period ? `${period[1]} – ${period[2]}` : null,
  };
}

export async function parseStatement(
  file: File | Blob,
  onProgress?: (fraction: number) => void,
): Promise<StatementResult> {
  const handle = await openPdf(file);
  try {
    const all: TItem[] = [];
    let fullText = '';
    let headerText = '';

    for (let p = 0; p < handle.numPages; p++) {
      const page = await handle.doc.getPage(p + 1);
      const vp = page.getViewport({ scale: 1 });
      const tc = await page.getTextContent();

      const items = tc.items
        .filter((i) => 'str' in i)
        .map((raw) => {
          const it = raw as { str: string; width: number; height: number; transform: number[] };
          return {
            x: it.transform[4],
            y: it.transform[5],
            w: it.width,
            h: Math.abs(it.transform[3]) || it.height || 10,
            s: it.str,
          };
        })
        .filter((i) => i.s.trim());

      fullText += ` ${items.map((i) => i.s).join(' ')}`;
      if (p === 0) {
        headerText = items.filter((i) => i.y >= vp.height * HEADER_BAND).map((i) => i.s).join(' ');
      }
      // stack this page below the previous ones (y decreases down the document)
      for (const it of items) all.push({ ...it, y: it.y - p * PAGE_STRIDE });

      (page as unknown as { cleanup?: () => void }).cleanup?.();
      onProgress?.((p + 1) / handle.numPages);
    }

    const { rows } = itemsToTable(all);
    // Repeated page headers/footers carry no date, and validate() only treats
    // date-bearing rows as transactions — so they fall away for free.
    return {
      bank: fingerprintBank(fullText, headerText || fullText.slice(0, 1200)),
      meta: readMeta(headerText || fullText.slice(0, 1500)),
      validation: validate(rows),
      numPages: handle.numPages,
      hasText: fullText.trim().length > 40,
    };
  } finally {
    await handle.destroy();
  }
}
