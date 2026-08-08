import { describe, it, expect } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import { info, merge, extractPages, deletePages, rotate, removeMetadata, splitEvery } from '../src/pdf.js';
import { parsePageSelection, PdfError } from '../src/pages.js';

/** A real PDF with n pages, each a different width so we can tell them apart. */
async function makePdf(n: number, title?: string): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  for (let i = 0; i < n; i += 1) doc.addPage([200 + i, 400]);
  if (title) doc.setTitle(title);
  return doc.save();
}
const widths = async (bytes: Uint8Array) => (await info(bytes)).sizes.map((s) => Math.round(s.width));

describe('page selection', () => {
  it('reads what a person types, one-based in and zero-based out', () => {
    expect(parsePageSelection('1-3, 7', 10)).toEqual([0, 1, 2, 6]);
    expect(parsePageSelection('12-', 14)).toEqual([11, 12, 13]);
    expect(parsePageSelection('-3', 10)).toEqual([0, 1, 2]);
    expect(parsePageSelection('all', 3)).toEqual([0, 1, 2]);
    expect(parsePageSelection('3, 1, 3', 5)).toEqual([0, 2]); // sorted, de-duped
  });

  it('refuses selections the document cannot honour', () => {
    expect(() => parsePageSelection('0', 5)).toThrow(PdfError);
    expect(() => parsePageSelection('6', 5)).toThrow(/outside/);
    expect(() => parsePageSelection('4-2', 5)).toThrow(/not a range/);
    expect(() => parsePageSelection('abc', 5)).toThrow(/isn't a page number/);
  });
});

describe('pdf operations', () => {
  it('reports what is in a document', async () => {
    const i = await info(await makePdf(3, 'Hello'));
    expect(i.pages).toBe(3);
    expect(i.title).toBe('Hello');
    expect(Math.round(i.sizes[1].width)).toBe(201);
  });

  it('merges in the order given', async () => {
    const out = await merge([await makePdf(2), await makePdf(1)]);
    expect(await widths(out)).toEqual([200, 201, 200]);
  });

  it('extracts and deletes the right pages', async () => {
    const src = await makePdf(5); // widths 200..204
    expect(await widths(await extractPages(src, '2-3'))).toEqual([201, 202]);
    expect(await widths(await extractPages(src, [1, 5]))).toEqual([200, 204]);
    expect(await widths(await deletePages(src, '1, 5'))).toEqual([201, 202, 203]);
  });

  it('will not delete every page', async () => {
    await expect(deletePages(await makePdf(2), 'all')).rejects.toThrow(/at least one/);
  });

  it('rotates relative to what the page already had, normalising the angle', async () => {
    const src = await makePdf(2);
    const once = await rotate(src, { degrees: 90 });
    const twice = await rotate(once, { degrees: -90 });
    const doc = await PDFDocument.load(twice);
    expect(doc.getPage(0).getRotation().angle).toBe(0);
    const over = await rotate(src, { degrees: 450 });
    expect((await PDFDocument.load(over)).getPage(0).getRotation().angle).toBe(90);
  });

  it('rejects a rotation that is not a multiple of 90', async () => {
    await expect(rotate(await makePdf(1), { degrees: 45 })).rejects.toThrow(/multiple of 90/);
  });

  it('strips metadata', async () => {
    const out = await removeMetadata(await makePdf(1, 'Confidential draft'));
    expect((await info(out)).title).toBeUndefined();
  });

  it('splits into fixed-size chunks, last one short', async () => {
    const parts = await splitEvery(await makePdf(5), 2);
    expect(parts.length).toBe(3);
    expect((await info(parts[2])).pages).toBe(1);
  });

  it('says what is wrong with input that is not a PDF', async () => {
    await expect(info(new TextEncoder().encode('not a pdf'))).rejects.toThrow(/could not be read/);
  });
});
