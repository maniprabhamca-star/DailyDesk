// Real files for the end-to-end runs. Generated once per run into
// tests/.fixtures/ (gitignored) rather than committed, so they can't rot and
// nobody has to hunt for a sample PDF to reproduce a failure.

import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { deflateSync } from 'node:zlib';

export const FIXTURE_DIR = path.join(process.cwd(), 'tests', '.fixtures');

const file = (name: string) => path.join(FIXTURE_DIR, name);

/** A minimal PNG encoder — a real logo image without adding a dependency. */
function png(width: number, height: number, paint: (x: number, y: number) => [number, number, number]): Buffer {
  const raw = Buffer.alloc((width * 3 + 1) * height);
  let p = 0;
  for (let y = 0; y < height; y++) {
    raw[p++] = 0;
    for (let x = 0; x < width; x++) {
      const [r, g, b] = paint(x, y);
      raw[p++] = r; raw[p++] = g; raw[p++] = b;
    }
  }
  const table: number[] = [];
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  const crc = (buf: Buffer) => {
    let c = 0xffffffff;
    for (const b of buf) c = table[(c ^ b) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
  const chunk = (type: string, data: Buffer) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type, 'latin1'), data]);
    const c = Buffer.alloc(4); c.writeUInt32BE(crc(body));
    return Buffer.concat([len, body, c]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0); ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; ihdr[9] = 2;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/** A multi-page PDF with a running header, a page number and a word hyphenated
 *  across a page break — so the tidy-up pass has something real to do. */
async function makePdf(pages = 4): Promise<Buffer> {
  const { PDFDocument, StandardFonts, rgb } = await import('pdf-lib');
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  for (let i = 0; i < pages; i++) {
    const page = doc.addPage([595, 842]);
    page.drawText('DiemDesk QA Report', { x: 60, y: 800, size: 9, font, color: rgb(0.5, 0.5, 0.5) });
    page.drawText(String(i + 1), { x: 297, y: 32, size: 9, font, color: rgb(0.5, 0.5, 0.5) });
    let y = 730;
    if (i === 0) { page.drawText('Quarterly Review', { x: 60, y, size: 24, font: bold }); y -= 46; }
    const lines = [
      'The board met and reviewed the numbers for the period.',
      'Each division reported separately and the totals were agreed.',
    ];
    if (i === 1) lines.push('Every division supplied its own opera-');
    if (i === 2) lines.unshift('tional summary before the deadline passed.');
    for (const l of lines) { page.drawText(l, { x: 60, y, size: 11, font }); y -= 20; }
  }
  doc.setTitle('Quarterly Review');
  doc.setAuthor('QA Suite');
  return Buffer.from(await doc.save());
}

let built = false;

/** Idempotent: the first spec that needs fixtures builds them all. */
export async function ensureFixtures(): Promise<void> {
  if (built && existsSync(file('sample.pdf'))) return;
  mkdirSync(FIXTURE_DIR, { recursive: true });

  writeFileSync(file('sample.pdf'), await makePdf());

  writeFileSync(file('sample.csv'),
    'name;city;amount\n"Smith; John";Chennai;1200.5\nSam;Leeds;98\nPriya;Madurai;44\n');

  writeFileSync(file('sample.json'), JSON.stringify({
    page: 1,
    results: [
      { id: 1, name: 'Priya', address: { city: 'Chennai' }, tags: ['lead', 'india'], active: true },
      { id: 2, name: 'Sam', address: { city: 'Leeds' }, active: false },
    ],
  }, null, 2));

  writeFileSync(file('sample.xml'),
    `<orders>\n  <order id="1001"><customer>Priya</customer><total>420.50</total></order>\n` +
    `  <order id="1002"><customer>Sam</customer><total>98.00</total></order>\n</orders>\n`);

  writeFileSync(file('sample.srt'),
    '1\n00:00:01,000 --> 00:00:04,000\nThe first caption.\n\n2\n00:00:05,500 --> 00:00:08,250\nAnd the second one.\n');

  writeFileSync(file('sample.md'),
    '# QA Report\n\nRevenue held **steady**, with 2 * 3 * 4 = 24 units shipped.\n\n' +
    '- First finding\n- Second finding\n\n| Region | Q1 |\n| --- | --- |\n| India | 1400 |\n\n> A quoted remark.\n');

  // viewBox only, no width/height — the case that exports blank elsewhere.
  writeFileSync(file('sample.svg'),
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300">' +
    '<rect width="400" height="300" fill="#0ea5e9"/><circle cx="200" cy="150" r="90" fill="#fff"/></svg>');

  writeFileSync(file('logo.png'), png(300, 120, (x, y) => [217, 119, 6 + ((x + y) % 40)]));
  writeFileSync(file('photo.jpg'), png(640, 480, (x, y) => [(x % 255), (y % 255), 180])); // PNG bytes, .jpg name: the wrong-type path

  built = true;
}

export const fixture = (name: string) => file(name);

/**
 * A folder holding one file of every render kind, for Folder Preview.
 *
 * Generated like everything else here rather than committed. The first version
 * of this WAS committed by hand into tests/.fixtures/ — which is gitignored, so
 * it existed on my machine and nowhere else, and every browser job in CI failed
 * with ENOENT while the local run stayed green. Fixtures belong in code.
 */
export async function demoFolder(): Promise<string> {
  const dir = path.join(FIXTURE_DIR, 'demo-folder');
  mkdirSync(dir, { recursive: true });
  const put = (name: string, body: string | Buffer) => writeFileSync(path.join(dir, name), body);

  put('notes.md', '# Q3 handover\n\nLiving log of decisions.\n\n| Date | Change |\n| --- | --- |\n| 1 Jul | shipped |\n');
  put('statement.csv', 'Date,Ref,Amount,Balance\n01 Jul,DD-4471,-82.10,4118\n02 Jul,SO-1180,-1250.00,2868\n04 Jul,CR-0092,+3400.00,6268\n');
  put('config.json', '{"name":"diemdesk","tools":67,"private":true}\n');
  put('pricing.ts', 'export function tier(n) {\n  if (n < 5) return "free";\n  return "pro";\n}\n');
  put('logo.svg', '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect width="100" height="100" rx="12" fill="#4f46e5"/></svg>');
  put('readme.txt', 'plain text file\nsecond line\n');
  // Listed with a reason, never rendered — the honesty case.
  put('artwork.psd', 'not really a psd, and it never gets parsed');
  put('page.html', '<!doctype html><meta charset="utf-8"><h1>Hello</h1><p>A tiny page.</p>');
  // A real multi-page PDF: page-one canvas rendering is the preview path most
  // likely to break, so it must be in the folder the suite actually opens.
  put('contract.pdf', await makePdf(3));

  return dir;
}
