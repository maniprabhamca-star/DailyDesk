import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';

const require = createRequire(import.meta.url);

// pdf.js refuses to run when the API and worker versions differ, and every tool
// that reads a PDF then silently does nothing. That shipped to production once:
// the 6.1.200 → 6.3.289 security upgrade left a hand-copied worker in public/
// untouched, and the build, the unit tests and the type-check were all green
// while every PDF tool was broken.
describe('the pdf.js worker matches the installed library', () => {
  const installed = JSON.parse(
    readFileSync(require.resolve('pdfjs-dist/package.json'), 'utf8'),
  ).version as string;

  it('reports the same version as pdfjs-dist', () => {
    const worker = readFileSync(
      path.join(process.cwd(), 'public', 'pdf.worker.min.mjs'),
      'utf8',
    );
    // The build stamps its own version into the bundle.
    expect(
      worker.includes(installed),
      `public/pdf.worker.min.mjs does not contain ${installed}. ` +
        'Run `npm run sync:pdf-worker` — it is copied from node_modules, and an ' +
        'upgrade leaves the old file behind otherwise.',
    ).toBe(true);
  });

  it('is a real worker build, not a stub', () => {
    const bytes = readFileSync(path.join(process.cwd(), 'public', 'pdf.worker.min.mjs'));
    expect(bytes.length).toBeGreaterThan(500_000);
  });
});
