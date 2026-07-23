'use client';

// On-device Bates numbering. pdf-lib stamps a sequential legal identifier on each
// page in range; the number carries across a whole set of files so page 1 of file 2
// continues where file 1 left off. The file NEVER leaves the device. pdf-lib is
// imported dynamically to keep it out of the initial route bundle.

import { batesLabel, batesXY, pagesInRange, type BatesOptions } from './bates-core';

export type BatesFileResult = { blob: Blob; name: string; stamped: number };
export type BatesRun = { files: BatesFileResult[]; totalStamped: number; firstLabel: string; lastLabel: string };

async function stampOne(file: File, opts: BatesOptions, startNum: number): Promise<{ result: BatesFileResult; nextNum: number; lastLabel: string }> {
  const { PDFDocument, StandardFonts, rgb } = await import('pdf-lib');
  const bytes = new Uint8Array(await file.arrayBuffer());
  const doc = await PDFDocument.load(bytes, { ignoreEncryption: true, updateMetadata: false });
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const pages = doc.getPages();
  const targets = pagesInRange(pages.length, opts.fromPage, opts.toPage);

  let n = startNum;
  let lastLabel = '';
  for (const p of targets) {
    const page = pages[p - 1];
    const { width: W, height: H } = page.getSize();
    const label = batesLabel(opts.prefix, n, opts.digits, opts.suffix);
    lastLabel = label;
    const tw = font.widthOfTextAtSize(label, opts.fontSize);
    const { x, y } = batesXY(opts.position, W, H, tw, opts.fontSize);
    page.drawText(label, { x, y, size: opts.fontSize, font, color: rgb(0.1, 0.1, 0.1) });
    n++;
  }

  const outBytes = await doc.save();
  const name = file.name.replace(/\.pdf$/i, '') + '-bates.pdf';
  return {
    result: { blob: new Blob([new Uint8Array(outBytes)], { type: 'application/pdf' }), name, stamped: targets.length },
    nextNum: n,
    lastLabel,
  };
}

// Stamp a whole ordered set with continuous numbering.
export async function stampBatesSet(
  files: File[],
  opts: BatesOptions,
  onProgress?: (done: number, total: number) => void,
): Promise<BatesRun> {
  const results: BatesFileResult[] = [];
  let n = opts.start;
  let totalStamped = 0;
  let lastLabel = '';
  const firstLabel = batesLabel(opts.prefix, opts.start, opts.digits, opts.suffix);

  for (let i = 0; i < files.length; i++) {
    const { result, nextNum, lastLabel: ll } = await stampOne(files[i], opts, n);
    results.push(result);
    totalStamped += result.stamped;
    if (ll) lastLabel = ll;
    n = nextNum;
    onProgress?.(i + 1, files.length);
  }

  return { files: results, totalStamped, firstLabel, lastLabel };
}
