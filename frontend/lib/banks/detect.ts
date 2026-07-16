'use client';

// PDF → which bank issued this statement. The pdf.js IO layer that feeds the pure
// fingerprint logic (lib/banks/fingerprint.ts). Runs entirely in the browser — the
// statement never leaves the device, which is the whole point of this tool.

import { openPdf } from '../pdf-render';
import { fingerprintBank, type BankMatch } from './fingerprint';

export type StatementScan = {
  bank: BankMatch | null;
  numPages: number;
  hasText: boolean;     // false = scanned image → needs OCR first
  headerText: string;   // kept for the "why did it pick this bank" debug view
};

// The issuing bank identifies itself at the TOP of page 1 (logo line, address, IFSC).
// Transaction rows below are full of OTHER banks' names (NEFT/UPI counterparties), so
// we hand the fingerprinter this region separately and weight it far higher.
const HEADER_BAND = 0.72; // top ~28% of page 1 (pdf y-origin is bottom-left)

export async function detectBank(file: File | Blob): Promise<StatementScan> {
  const handle = await openPdf(file);
  try {
    const page = await handle.doc.getPage(1);
    const vp = page.getViewport({ scale: 1 });
    const tc = await page.getTextContent();

    const items = tc.items
      .filter((i) => 'str' in i)
      .map((raw) => {
        const it = raw as { str: string; transform: number[] };
        return { y: it.transform[5], s: it.str };
      })
      .filter((i) => i.s.trim());

    const fullText = items.map((i) => i.s).join(' ');
    const cut = vp.height * HEADER_BAND;
    const headerText = items.filter((i) => i.y >= cut).map((i) => i.s).join(' ');

    (page as unknown as { cleanup?: () => void }).cleanup?.();

    return {
      bank: fingerprintBank(fullText, headerText || fullText.slice(0, 1200)),
      numPages: handle.numPages,
      hasText: fullText.trim().length > 40,
      headerText,
    };
  } finally {
    await handle.destroy();
  }
}
