'use client';

// On-device PDF → Markdown. Like every DiemDesk in-browser tool, the FILE never
// leaves the device: pdf.js (the same engine as the rest of the site) reads each
// page's text with its x/y positions and font info, and the pure core in
// lib/pdf-markdown-core.ts rebuilds headings, lists and tables from the layout.

import { openPdf } from './pdf-render';
import { pdfItemsToMarkdown, type MItem, type MdOptions } from './pdf-markdown-core';

export type { MdOptions } from './pdf-markdown-core';

export type MarkdownResult = { markdown: string; numPages: number; hasText: boolean };
export type ExtractedPages = { pages: MItem[][]; numPages: number; hasText: boolean };

// Extract the positioned text once (the slow pdf.js step). The component caches
// this so toggling Headings/Tables re-runs only the pure, instant core.
export async function extractPages(
  file: File | Blob,
  onProgress?: (fraction: number) => void,
): Promise<ExtractedPages> {
  const handle = await openPdf(file);
  const pages: MItem[][] = [];
  let anyText = false;
  try {
    for (let i = 0; i < handle.numPages; i++) {
      const page = await handle.doc.getPage(i + 1);
      const tc = await page.getTextContent();
      const styles = (tc as { styles?: Record<string, { fontFamily?: string }> }).styles || {};
      const items: MItem[] = tc.items
        .filter((it) => 'str' in it)
        .map((raw) => {
          const it = raw as { str: string; width: number; height: number; transform: number[]; fontName?: string };
          const fam = (it.fontName && styles[it.fontName]?.fontFamily) || '';
          const bold = /bold|black|heavy|semibold|extrabold/i.test(fam) || /bold|bd\b|-b\b/i.test(it.fontName || '');
          return {
            x: it.transform[4],
            y: it.transform[5],
            w: it.width,
            h: Math.abs(it.transform[3]) || it.height || 10,
            s: it.str,
            bold,
          };
        });
      if (items.some((it) => it.s.trim())) anyText = true;
      pages.push(items);
      (page as unknown as { cleanup?: () => void }).cleanup?.();
      onProgress?.((i + 1) / handle.numPages);
    }
  } finally {
    await handle.destroy();
  }
  return { pages, numPages: handle.numPages, hasText: anyText };
}

export async function pdfToMarkdown(
  file: File | Blob,
  opts: MdOptions = {},
  onProgress?: (fraction: number) => void,
): Promise<MarkdownResult> {
  const handle = await openPdf(file);
  const pages: MItem[][] = [];
  let anyText = false;
  try {
    for (let i = 0; i < handle.numPages; i++) {
      const page = await handle.doc.getPage(i + 1);
      const tc = await page.getTextContent();
      const styles = (tc as { styles?: Record<string, { fontFamily?: string }> }).styles || {};
      const items: MItem[] = tc.items
        .filter((it) => 'str' in it)
        .map((raw) => {
          const it = raw as { str: string; width: number; height: number; transform: number[]; fontName?: string };
          const fam = (it.fontName && styles[it.fontName]?.fontFamily) || '';
          // Bold is best-effort: pdf.js exposes only a generic family, so we also
          // sniff the internal font name. Used lightly (a bold, short, isolated line
          // reads as a heading) — never to emit **bold** runs, which would misfire.
          const bold = /bold|black|heavy|semibold|extrabold/i.test(fam) || /bold|bd\b|-b\b/i.test(it.fontName || '');
          return {
            x: it.transform[4],
            y: it.transform[5],
            w: it.width,
            h: Math.abs(it.transform[3]) || it.height || 10,
            s: it.str,
            bold,
          };
        });
      if (items.some((it) => it.s.trim())) anyText = true;
      pages.push(items);
      (page as unknown as { cleanup?: () => void }).cleanup?.();
      onProgress?.((i + 1) / handle.numPages);
    }
  } finally {
    await handle.destroy();
  }
  return { markdown: pdfItemsToMarkdown(pages, opts), numPages: handle.numPages, hasText: anyText };
}
