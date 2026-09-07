// Keep public/pdf.worker.min.mjs in step with the installed pdfjs-dist.
//
// pdf.js refuses to run when the API and the worker are different versions —
// "The API version X does not match the Worker version Y" — and every tool that
// reads a PDF then does nothing at all.
//
// The worker had been copied into public/ by hand, so nothing refreshed it. The
// 6.1.200 → 6.3.289 security upgrade left the old worker in place and shipped
// that way: on production, every pdf.js tool was broken and the build, the unit
// tests and the type-check were all green. Only an end-to-end test that opened
// a real PDF could have caught it, and the one that did was itself failing for
// an unrelated reason.
//
// So it is copied by a script now, run before every build, and a test asserts
// the two versions match.
import { copyFileSync, mkdirSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';

const require = createRequire(import.meta.url);
const version = JSON.parse(readFileSync(require.resolve('pdfjs-dist/package.json'), 'utf8')).version;

// The .mjs build, which is what the app loads.
const src = require.resolve('pdfjs-dist/build/pdf.worker.min.mjs');
const destDir = path.join(process.cwd(), 'public');
const dest = path.join(destDir, 'pdf.worker.min.mjs');

mkdirSync(destDir, { recursive: true });
copyFileSync(src, dest);
console.log(`pdf.worker.min.mjs synced from pdfjs-dist@${version}`);
