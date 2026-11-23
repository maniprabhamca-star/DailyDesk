// Guards the shared pdf-lib opener.
//
// The bug this protects against is the quiet kind. A PDF can carry an
// encryption wrapper while needing NO password to open — most high-volume
// USCIS forms do, and so do plenty of bank statements. Such a file looks
// completely ordinary. Every tool used to call
// `PDFDocument.load(bytes, { ignoreEncryption: true })`, and that flag does not
// decrypt: it only silences pdf-lib's refusal to open the file, leaving the
// objects unreadable. Merge/Split/Rotate/Watermark/Page-numbers then threw, and
// Fill PDF form reported a 450-field government form as having none.
//
// Nothing here caught it, because every fixture we had was an ordinary
// unlocked PDF — a build and the whole unit suite stay green through it. So
// this file does two jobs: keep the hand-written load from coming back, and
// pin the behaviour of the detection that decides when to call qpdf.
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { PDFDocument } from 'pdf-lib';
import { declaresEncryption } from '@/lib/pdf-open';

const ROOT = join(__dirname, '..', '..');

// Allowed to call PDFDocument.load directly, each for a stated reason.
const ALLOWED = new Set([
  // The opener itself.
  'lib/pdf-open.ts',
  // Runs inside lib/pdf-rewrite.worker.ts. qpdf's inline fallback builds a
  // <script> tag and needs a DOM, so this one cannot import the opener; its
  // callers decrypt on the main thread before posting (lib/pdf-rewrite.ts).
  'lib/pdf-rewrite-core.ts',
]);

function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.next' || name === 'public' || name === 'tests') continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) sourceFiles(p, out);
    else if (/\.tsx?$/.test(name)) out.push(p);
  }
  return out;
}

describe('shared pdf-lib opener', () => {
  it('is the only place that calls PDFDocument.load', () => {
    const offenders: string[] = [];
    for (const dir of ['lib', 'components', 'app'].map((d) => join(ROOT, d))) {
      for (const file of sourceFiles(dir)) {
        const rel = relative(ROOT, file).split(sep).join('/');
        if (ALLOWED.has(rel)) continue;
        const src = readFileSync(file, 'utf8');
        // Ignore the token inside comments — several files explain the history.
        const code = src
          .replace(/\/\*[\s\S]*?\*\//g, '')
          .split('\n')
          .filter((l) => !l.trim().startsWith('//'))
          .join('\n');
        if (/PDFDocument\.load\s*\(/.test(code)) offenders.push(rel);
      }
    }
    expect(
      offenders,
      'Call openPdfDoc() from lib/pdf-open.ts instead. A raw PDFDocument.load with ' +
        'ignoreEncryption does NOT decrypt — it just stops pdf-lib complaining, and the ' +
        'next operation dies on objects it cannot read.',
    ).toEqual([]);
  });

  it('never leaves ignoreEncryption in the codebase — it does not do what it reads like', () => {
    const offenders: string[] = [];
    for (const dir of ['lib', 'components', 'app'].map((d) => join(ROOT, d))) {
      for (const file of sourceFiles(dir)) {
        const rel = relative(ROOT, file).split(sep).join('/');
        if (ALLOWED.has(rel)) continue;
        const code = readFileSync(file, 'utf8')
          .replace(/\/\*[\s\S]*?\*\//g, '')
          .split('\n')
          .filter((l) => !l.trim().startsWith('//'))
          .join('\n');
        if (/ignoreEncryption/.test(code)) offenders.push(rel);
      }
    }
    expect(offenders).toEqual([]);
  });

  describe('declaresEncryption', () => {
    it('is false for an ordinary PDF we just built', async () => {
      const doc = await PDFDocument.create();
      doc.addPage([200, 200]);
      const bytes = await doc.save();
      expect(declaresEncryption(bytes)).toBe(false);
    });

    it('accepts an ArrayBuffer as well as a Uint8Array', async () => {
      const doc = await PDFDocument.create();
      doc.addPage([200, 200]);
      const bytes = await doc.save();
      const ab = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
      expect(declaresEncryption(ab as ArrayBuffer)).toBe(false);
    });

    it('spots /Encrypt in the trailer', async () => {
      const doc = await PDFDocument.create();
      doc.addPage([200, 200]);
      const clean = await doc.save();
      // Append a trailer that declares encryption, which is where a real
      // standard-security PDF carries it.
      const trailer = new TextEncoder().encode('\ntrailer\n<< /Encrypt 9 0 R /Root 1 0 R >>\n%%EOF\n');
      const faked = new Uint8Array(clean.length + trailer.length);
      faked.set(clean, 0);
      faked.set(trailer, clean.length);
      expect(declaresEncryption(faked)).toBe(true);
    });

    it('spots /Encrypt that sits far from the tail, as a cross-reference stream puts it', async () => {
      const doc = await PDFDocument.create();
      doc.addPage([200, 200]);
      const clean = await doc.save();
      const marker = new TextEncoder().encode('\n% /Encrypt 9 0 R\n');
      // pdf-lib builds very compact files (60 blank pages is barely 1 KB), so
      // pad deliberately: the declaration has to land outside the 8 KB tail
      // scan for this to be testing the whole-buffer fallback at all.
      const filler = new TextEncoder().encode('% ' + 'x'.repeat(20_000) + '\n');
      const faked = new Uint8Array(marker.length + filler.length + clean.length);
      faked.set(marker, 0);
      faked.set(filler, marker.length);
      faked.set(clean, marker.length + filler.length);
      expect(faked.length - marker.length).toBeGreaterThan(8192);
      expect(declaresEncryption(faked)).toBe(true);
    });
  });
});
