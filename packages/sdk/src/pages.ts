/** Errors this library throws are all this one, so callers can catch narrowly. */
export class PdfError extends Error {
  code: 'bad-input' | 'bad-selection' | 'encrypted' | 'empty-result';
  constructor(code: PdfError['code'], message: string) {
    super(message);
    this.name = 'PdfError';
    this.code = code;
  }
}

/**
 * Turn what a person types into page indices.
 *
 * Accepts "1-3, 7, 12-" and "all". One-based going in, because that is what is
 * printed on the page and what your user means; zero-based coming out, because
 * that is what pdf-lib wants. Getting this boundary wrong by one is the single
 * most common bug in page-range code, so it lives in one function with tests
 * rather than being re-derived at each call site.
 *
 * @param spec  e.g. "1-3, 7, 12-" — an open-ended range runs to the last page
 * @param pageCount total pages in the document
 * @returns sorted, de-duplicated ZERO-based indices
 */
export function parsePageSelection(spec: string, pageCount: number): number[] {
  if (!Number.isInteger(pageCount) || pageCount < 1) {
    throw new PdfError('bad-input', 'pageCount must be a positive integer.');
  }
  const text = String(spec ?? '').trim().toLowerCase();
  if (!text || text === 'all') return Array.from({ length: pageCount }, (_, i) => i);

  const out = new Set<number>();
  for (const rawPart of text.split(',')) {
    const part = rawPart.trim();
    if (!part) continue;

    const range = part.match(/^(\d+)?\s*-\s*(\d+)?$/);
    if (range) {
      const from = range[1] ? parseInt(range[1], 10) : 1;
      const to = range[2] ? parseInt(range[2], 10) : pageCount;
      if (from < 1 || to > pageCount || from > to) {
        throw new PdfError('bad-selection', `"${part}" is not a range this ${pageCount}-page document has.`);
      }
      for (let p = from; p <= to; p += 1) out.add(p - 1);
      continue;
    }

    if (!/^\d+$/.test(part)) {
      throw new PdfError('bad-selection', `"${part}" isn't a page number or a range.`);
    }
    const n = parseInt(part, 10);
    if (n < 1 || n > pageCount) {
      throw new PdfError('bad-selection', `Page ${n} is outside this ${pageCount}-page document.`);
    }
    out.add(n - 1);
  }

  if (out.size === 0) throw new PdfError('bad-selection', 'That selection matches no pages.');
  return [...out].sort((a, b) => a - b);
}
