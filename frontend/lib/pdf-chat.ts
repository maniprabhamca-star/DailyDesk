'use client';

// Client-side plumbing for "Chat with PDF". The whole point: the FILE never leaves
// the device. We extract the text with pdf.js (same engine as every other tool),
// split it into page-tagged chunks, and — per question — send only the few most
// relevant chunks to the backend. No embeddings, no network for retrieval: a light
// keyword score keeps it instant and free, and bounds what we forward to the AI.

import { openPdf } from './pdf-render';

export type Chunk = { page: number; text: string };
export type ExtractResult = { chunks: Chunk[]; numPages: number; chars: number; hasText: boolean };

// Extract text page-by-page and chunk it. `hasText` is false for scanned/image-only
// PDFs (no text layer) so the UI can nudge the user to OCR first.
export async function extractChunks(
  file: File | Blob,
  onProgress?: (fraction: number) => void,
): Promise<ExtractResult> {
  const handle = await openPdf(file);
  const chunks: Chunk[] = [];
  let chars = 0;
  try {
    for (let i = 0; i < handle.numPages; i++) {
      const page = await handle.doc.getPage(i + 1);
      const tc = await page.getTextContent();
      const text = tc.items
        .map((it) => ('str' in it ? (it as { str: string }).str : ''))
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim();
      chars += text.length;
      for (const piece of splitText(text, 900)) {
        const t = piece.trim();
        if (t) chunks.push({ page: i + 1, text: t });
      }
      // free the page's operator list / fonts as we go (big docs)
      (page as unknown as { cleanup?: () => void }).cleanup?.();
      onProgress?.((i + 1) / handle.numPages);
    }
  } finally {
    await handle.destroy();
  }
  // ~40 chars total is our floor for "this PDF actually has selectable text".
  return { chunks, numPages: handle.numPages, chars, hasText: chars > 40 };
}

// Split a long page into ~`size`-char pieces, preferring sentence boundaries so a
// chunk isn't cut mid-word/sentence (keeps the excerpts readable for the model).
function splitText(s: string, size: number): string[] {
  if (s.length <= size) return [s];
  const out: string[] = [];
  let i = 0;
  while (i < s.length) {
    let end = Math.min(i + size, s.length);
    if (end < s.length) {
      const stop = s.lastIndexOf('. ', end);
      if (stop > i + size * 0.5) end = stop + 1;
    }
    out.push(s.slice(i, end));
    i = end;
  }
  return out;
}

const STOP = new Set(
  ('the a an of to in on for and or is are was were be been being it this that these those with as at by from into over under about your you i we they he she his her its their our not no do does did have has had will would can could should what which who when where why how'
  ).split(' '),
);

const tokenize = (s: string): string[] => s.toLowerCase().match(/[a-z0-9]+/g) || [];

// Pick the chunks most relevant to `question`, capped to a char budget so the AI
// call stays small and cheap. If nothing matches (e.g. "summarize this"), fall back
// to a spread of chunks across the document so the model still sees the whole shape.
export function retrieve(chunks: Chunk[], question: string, k = 6, charBudget = 6000): Chunk[] {
  if (chunks.length <= k) return chunks;
  const terms = tokenize(question).filter((t) => !STOP.has(t) && t.length > 1);
  const tset = new Set(terms);

  const scored = chunks.map((c, idx) => {
    const toks = tokenize(c.text);
    let score = 0;
    for (const t of toks) if (tset.has(t)) score++;
    return { c, idx, score };
  });
  scored.sort((a, b) => b.score - a.score || a.idx - b.idx);

  if (!scored[0] || scored[0].score === 0) return sampleSpread(chunks, k);

  const picked: typeof scored = [];
  let used = 0;
  for (const s of scored) {
    if (s.score === 0 && picked.length >= 3) break;
    if (picked.length >= 3 && used + s.c.text.length > charBudget) break;
    picked.push(s);
    used += s.c.text.length;
    if (picked.length >= k) break;
  }
  // Read back in document order so citations flow front-to-back.
  return picked.sort((a, b) => a.idx - b.idx).map((s) => s.c);
}

// Evenly sample chunks across the document (always includes the first).
function sampleSpread(chunks: Chunk[], k: number): Chunk[] {
  const step = Math.max(1, Math.floor(chunks.length / k));
  const out: Chunk[] = [];
  for (let i = 0; i < chunks.length && out.length < k; i += step) out.push(chunks[i]);
  return out;
}
