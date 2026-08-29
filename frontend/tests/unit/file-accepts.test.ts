import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { ACCEPT } from '@/lib/accept';

/**
 * Two bugs, one habit.
 *
 * Every tool hand-wrote its own `accept=` string and its own image decoder. That
 * produced `.ppsx` missing from the presentation converter, and eleven image
 * inputs listing `image/jpeg,image/png,image/webp` while we shipped a HEIC
 * decoder — one of which told the user to go and convert their iPhone photo with
 * our own HEIC tool first.
 *
 * These assertions are about the habit, not the two instances.
 */

const ROOT = path.resolve(__dirname, '..', '..');
const read = (p: string) => fs.readFileSync(path.join(ROOT, p), 'utf8');

function walk(dir: string, out: string[] = []): string[] {
  for (const e of fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
    const rel = `${dir}/${e.name}`;
    if (e.isDirectory()) walk(rel, out);
    else if (/\.tsx?$/.test(e.name)) out.push(rel);
  }
  return out;
}
const SOURCES = [...walk('components'), ...walk('app'), ...walk('lib')];

describe('file accept lists', () => {
  // Tools whose entire purpose is ONE format. Narrow is correct here: /heic-to-jpg
  // exists to take a HEIC, and offering a PNG to an SVG converter would be a lie.
  const SINGLE_FORMAT = ['components/tools/heic-tool.tsx', 'components/tools/svg-convert-tool.tsx'];

  // Emptied 2026-08-29 (item 1b): the five PDF-embed tools now decode through
  // pickedImageForPdf, so their pickers are wide. The mechanism stays — any
  // future exemption must be listed here by name, with a reason, and leaves the
  // moment it is fixed rather than becoming permanent furniture.
  const KNOWN_NARROW: string[] = [];

  it('never narrows an image picker to a hand-written format list', () => {
    // A narrow image accept is a bug, not a safety feature: `accept` is a
    // convenience filter and every tool sniffs the real format from the bytes,
    // because Android reports a HEIF as image/jpeg. Narrowing only greys out
    // photos we can open.
    const offenders: string[] = [];
    for (const f of SOURCES) {
      if (SINGLE_FORMAT.includes(f) || KNOWN_NARROW.includes(f)) continue;
      for (const m of read(f).matchAll(/accept="([^"]*image\/[^"]*)"/g)) {
        if (m[1].includes('image/*')) continue; // permissive — fine
        offenders.push(`${f}: ${m[1]}`);
      }
    }
    expect(offenders, `use ACCEPT.image from lib/accept.ts instead:\n${offenders.join('\n')}`).toEqual([]);
  });

  it('keeps the known-narrow list honest — every entry is still narrow', () => {
    // Guards the exemption itself. If one of these is fixed, it must leave the
    // list, or the list quietly grants permission nobody is using any more.
    const stale = KNOWN_NARROW.filter((f) => {
      const src = read(f);
      const narrow = [...src.matchAll(/accept="([^"]*image\/[^"]*)"/g)].some((m) => !m[1].includes('image/*'));
      return !narrow;
    });
    expect(stale, `fixed — remove from KNOWN_NARROW:\n${stale.join('\n')}`).toEqual([]);
  });

  it('decodes a USER-PICKED image in one place, so HEIC cannot be forgotten again', () => {
    // createImageBitmap alone cannot open a HEIC, and several separate decoders
    // had grown with that same hole. The rule is about user files: a tool that
    // takes a photo from a person must go through the shared decoder.
    //
    // Decoding a blob WE just produced — a pdf.js page render, a canvas we
    // encoded a line ago — is a different thing and stays exempt, because the
    // format is ours and is never HEIC.
    const INTERNAL_BLOBS = [
      'lib/image-for-pdf.ts',                       // the shared decoder itself
      'lib/hero-compress.ts',                       // JPEG bytes lifted out of a PDF
      'lib/passport-photo.ts',                      // a PNG this module just encoded
      'components/pdf/edit-tool.tsx',               // rendered PDF page
      'components/pdf/compress-tool.tsx',           // rendered PDF page
      'components/pdf/redact-tool.tsx',             // rendered PDF page
      'components/pdf/delete-pages-tool.tsx',       // rendered PDF page
      'components/pdf/clean-scanned-pdf-tool.tsx',  // rendered PDF page
      'components/pdf/share-safe-check-tool.tsx',   // rendered PDF page
      'components/tools/scan-to-pdf-tool.tsx',      // has its own HEIC branch already
      'lib/accept.ts',                              // names it in a comment only
      'tests/unit/file-accepts.test.ts',
    ];
    const offenders = SOURCES.filter(
      (f) => !INTERNAL_BLOBS.includes(f) && /createImageBitmap\s*\(/.test(read(f)),
    );
    expect(
      offenders,
      `these decode a user file directly — route through decodeToBitmap in lib/image-for-pdf.ts, ` +
      `or add to INTERNAL_BLOBS with a reason if the blob is one we produced:\n${offenders.join('\n')}`,
    ).toEqual([]);
  });

  it('accepts PowerPoint show files, in the picker AND the gate that follows it', () => {
    // Widening only the picker lets the file be chosen and then rejected, which
    // is a worse experience than not offering it.
    expect(ACCEPT.presentations).toMatch(/\.ppsx/);
    expect(ACCEPT.presentations).toMatch(/\.pps\b/);
    const tool = read('components/tools/office-to-pdf-tool.tsx');
    const gate = tool.match(/extRe:\s*(\/[^/]+\/i)[\s,]/g)?.join(' ') ?? '';
    expect(gate, 'the powerpoint extRe must admit .pps/.ppsx').toMatch(/ppsx\?/);
  });

  it('accepts PowerPoint show files on the server too', () => {
    // The frontend gate is a courtesy; the upload filter is the real one.
    const convert = fs.readFileSync(
      path.resolve(ROOT, '..', 'backend', 'src', 'routes', 'convert.js'), 'utf8',
    );
    const officeRe = convert.match(/const OFFICE_RE = (\/.+\/i);/)?.[1] ?? '';
    expect(officeRe, 'backend OFFICE_RE must admit .pps/.ppsx').toMatch(/ppsx\?/);
    // and it must route to the PowerPoint tool, not fall through to a default
    expect(convert).toMatch(/pptx\?\|ppsx\?[^)]*\)\$\/i\.test\(name\)/);
  });

  it('takes every image placed INTO a PDF through the shared decoder', () => {
    // These tools hand picked images to pdf-lib or composite them onto a page
    // canvas — both only speak JPEG/PNG, and `new Image()` cannot open a HEIC.
    // pickedImageForPdf normalises at pick time; going around it brings the
    // iPhone-photo refusal straight back.
    const EMBED_TOOLS = [
      'components/pdf/annotate-tool.tsx',
      'components/pdf/edit-tool.tsx',
      'components/pdf/sign-tool.tsx',
      'components/pdf/signature-maker.tsx',
      'components/pdf/watermark-tool.tsx',
    ];
    for (const f of EMBED_TOOLS) {
      expect(read(f), `${f} must decode picked images via pickedImageForPdf`).toMatch(/pickedImageForPdf/);
    }
    // The workflows signature pad stores a canvas PNG, not pdf-lib bytes, so it
    // uses the bitmap decoder — same shared HEIC path.
    expect(read('components/tools/signature-pad.tsx')).toMatch(/decodeToBitmap/);
  });

  it('offers HEIC everywhere an image is taken', () => {
    expect(ACCEPT.image).toMatch(/image\/\*/);
    expect(ACCEPT.image).toMatch(/\.heic/);
    expect(ACCEPT.image).toMatch(/\.heif/);
    expect(ACCEPT.pdfOrImage).toMatch(/\.heic/);
  });
});
