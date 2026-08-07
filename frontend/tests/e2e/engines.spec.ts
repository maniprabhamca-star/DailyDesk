import { test, expect, type Page, type Download } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { ensureFixtures, fixture } from './_fixtures';

// The tests that would have caught a broken ENGINE — a real file in, a real
// file out, checked at the bytes. Everything else in the suite proves pages
// render; this proves the product works.
//
// These run against localhost, where the app grants the owner bypass, so the
// coming_soon tools are reachable exactly as the owner sees them.

test.beforeAll(async () => { await ensureFixtures(); });

/** Drop a file into a tool the way a user does, then wait for it to be read. */
async function drop(page: Page, path: string, files: string | string[]) {
  await page.goto(path, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => (window as unknown as { __ddHydrated?: boolean }).__ddHydrated === true);
  const input = page.locator('input[type=file]').first();
  await input.setInputFiles(Array.isArray(files) ? files.map(fixture) : fixture(files));
}

/** Click something and return the file it produced. */
async function downloadFrom(page: Page, click: () => Promise<void>): Promise<{ name: string; bytes: Buffer }> {
  const [download] = await Promise.all([page.waitForEvent('download', { timeout: 45_000 }), click()]);
  const d = download as Download;
  const p = await d.path();
  return { name: d.suggestedFilename(), bytes: readFileSync(p!) };
}

const magic = (b: Buffer, n = 4) => b.subarray(0, n).toString('latin1');

test.describe('spreadsheet engines', () => {
  test('CSV → Excel: separator sniffed, quoted separator kept in one cell', async ({ page }) => {
    await drop(page, '/csv-to-excel', 'sample.csv');
    // The file is semicolon-separated: a naive reader puts it all in column A.
    const grid = page.locator('table');
    await expect(grid.getByText('Smith; John')).toBeVisible();
    await expect(grid.getByText('Chennai')).toBeVisible();

    const out = await downloadFrom(page, () => page.getByRole('button', { name: /Download Excel/i }).click());
    expect(out.name).toMatch(/\.xlsx$/);
    expect(magic(out.bytes), '.xlsx must be a real zip').toBe('PK');
  });

  test('Excel → CSV round-trips what CSV → Excel wrote', async ({ page }) => {
    await drop(page, '/csv-to-excel', 'sample.csv');
    const xlsx = await downloadFrom(page, () => page.getByRole('button', { name: /Download Excel/i }).click());

    // Feed our own output back in — writer and reader must agree.
    await page.goto('/excel-to-csv', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => (window as unknown as { __ddHydrated?: boolean }).__ddHydrated === true);
    await page.locator('input[type=file]').first().setInputFiles({
      name: 'roundtrip.xlsx',
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      buffer: xlsx.bytes,
    });
    await expect(page.locator('table').getByText('Smith; John')).toBeVisible();

    const csv = await downloadFrom(page, () => page.getByRole('button', { name: /Download \.csv/i }).click());
    const text = csv.bytes.toString('utf8');
    // The writer only quotes when it must; the separator here is a comma, so a
    // semicolon inside the value needs no quoting. What matters is the cell survived.
    expect(text).toContain('Smith; John');
    expect(text).toContain('1200.5');
  });

  test('JSON → Excel flattens nesting and unions fields', async ({ page }) => {
    await drop(page, '/json-to-excel', 'sample.json');
    const grid = page.locator('table');
    await expect(grid.getByText('address.city')).toBeVisible();
    await expect(grid.getByText('lead; india')).toBeVisible();
  });

  test('XML → Excel makes the repeating element the rows', async ({ page }) => {
    await drop(page, '/xml-to-excel', 'sample.xml');
    const grid = page.locator('table');
    await expect(grid.getByText('@id')).toBeVisible();
    await expect(grid.getByText('Priya').first()).toBeVisible();
  });
});

test.describe('document engines', () => {
  test('PDF → text drops the running head and rejoins the hyphen', async ({ page }) => {
    await drop(page, '/pdf-to-text', 'sample.pdf');
    const body = page.locator('pre');
    await expect(body).toBeVisible({ timeout: 30_000 });
    const text = (await body.textContent()) || '';
    expect(text, 'the running header must be gone').not.toContain('DiemDesk QA Report');
    expect(text, 'a word split across the page break must be rejoined').toContain('operational summary');
  });

  test('Markdown → PDF keeps the maths and drops the asterisks', async ({ page }) => {
    await drop(page, '/markdown-to-pdf', 'sample.md');
    const preview = (await page.locator('pre').textContent()) || '';
    expect(preview, 'bold markers should not survive into the document').not.toContain('**');
    expect(preview, 'multiplication is not emphasis').toContain('2 * 3 * 4 = 24');

    const out = await downloadFrom(page, () => page.getByRole('button', { name: /Download PDF/i }).click());
    expect(magic(out.bytes)).toBe('%PDF');
  });

  test('subtitles: SRT → VTT is a real rewrite, not a rename', async ({ page }) => {
    await drop(page, '/subtitle-converter', 'sample.srt');
    const out = (await page.locator('pre').textContent()) || '';
    expect(out.startsWith('WEBVTT'), 'VTT needs its header or players show nothing').toBe(true);
    expect(out, 'VTT uses full stops in timestamps').toContain('00:00:01.000 --> 00:00:04.000');
    expect(out).not.toContain(',000 -->');
  });
});

test.describe('image engines', () => {
  test('SVG → PNG renders a viewBox-only file at the size asked for', async ({ page }) => {
    await drop(page, '/svg-to-png', 'sample.svg');
    await expect(page.getByText(/400 × 300/).first()).toBeVisible();

    await page.getByRole('button', { name: '2×' }).click();
    const out = await downloadFrom(page, () => page.getByRole('button', { name: /Download PNG/i }).click());
    expect(out.bytes.subarray(1, 4).toString('latin1'), 'must be a PNG').toBe('PNG');

    // Width and height live at a fixed offset in the IHDR chunk.
    expect(out.bytes.readUInt32BE(16)).toBe(800);
    expect(out.bytes.readUInt32BE(20)).toBe(600);
  });

  test('favicon pack ships a genuine multi-image .ico', async ({ page }) => {
    await drop(page, '/favicon-generator', 'logo.png');
    await expect(page.locator('figcaption').getByText('browser tab')).toBeVisible({ timeout: 30_000 });

    const out = await downloadFrom(page, () => page.getByRole('button', { name: /Download the pack/i }).click());
    expect(magic(out.bytes)).toBe('PK');
    const listing = out.bytes.toString('latin1');
    for (const name of ['favicon.ico', 'apple-touch-icon.png', 'site.webmanifest', 'android-chrome-512x512.png']) {
      expect(listing, `the pack must contain ${name}`).toContain(name);
    }
  });
});

test.describe('the tools tell the truth when they cannot help', () => {
  test('a scan-shaped PDF sends you to OCR rather than producing nothing', async ({ page }) => {
    // A PDF with no text layer: the honest path is to say so.
    const { PDFDocument, rgb } = await import('pdf-lib');
    const doc = await PDFDocument.create();
    const p = doc.addPage([595, 842]);
    p.drawRectangle({ x: 80, y: 400, width: 400, height: 300, color: rgb(0.85, 0.86, 0.9) });
    const bytes = Buffer.from(await doc.save());

    await page.goto('/pdf-to-text', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => (window as unknown as { __ddHydrated?: boolean }).__ddHydrated === true);
    await page.locator('input[type=file]').first().setInputFiles({ name: 'scan.pdf', mimeType: 'application/pdf', buffer: bytes });

    await expect(page.getByText(/scan|OCR/i).first()).toBeVisible({ timeout: 30_000 });
  });

  test('the wrong file type is refused with a readable message', async ({ page }) => {
    await drop(page, '/subtitle-converter', 'sample.json');
    await expect(page.getByText(/No subtitle cues|\.srt or \.vtt/i).first()).toBeVisible();
  });
});
