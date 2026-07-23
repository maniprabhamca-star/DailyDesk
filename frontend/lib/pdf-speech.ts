'use client';

// Extract plain reading text from a PDF on-device (pdf.js). Feeds the read-aloud
// player. The file never leaves the device; the browser's own speech engine reads
// the text, so nothing is uploaded.

import { openPdf } from './pdf-render';

export type SpeechText = { pages: string[]; hasText: boolean };

export async function extractSpeechText(
  file: File | Blob,
  onProgress?: (fraction: number) => void,
): Promise<SpeechText> {
  const handle = await openPdf(file);
  const pages: string[] = [];
  let chars = 0;
  try {
    for (let i = 0; i < handle.numPages; i++) {
      const page = await handle.doc.getPage(i + 1);
      const tc = await page.getTextContent();
      // Join into readable flow: a line end becomes a space (reading doesn't want
      // the PDF's hard wraps), collapse whitespace.
      const text = tc.items
        .map((it) => ('str' in it ? (it as { str: string; hasEOL?: boolean }).str + ((it as { hasEOL?: boolean }).hasEOL ? ' ' : ' ') : ''))
        .join('')
        .replace(/\s+/g, ' ')
        .trim();
      chars += text.length;
      pages.push(text);
      (page as unknown as { cleanup?: () => void }).cleanup?.();
      onProgress?.((i + 1) / handle.numPages);
    }
  } finally {
    await handle.destroy();
  }
  return { pages, hasText: chars > 40 };
}
