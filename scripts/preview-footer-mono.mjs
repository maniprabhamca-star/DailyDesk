// Launches a Next dev server that renders the footer watermark in MONOCHROME
// (NEXT_PUBLIC_FOOTER_WM=mono) so it can be compared side-by-side with the
// colorful version on the default dev server. Preview-only, never production.
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const port = process.argv[2] || '3001';
const frontend = join(dirname(fileURLToPath(import.meta.url)), '..', 'frontend');

const child = spawn('npx', ['next', 'dev', '-p', port], {
  cwd: frontend,
  stdio: 'inherit',
  shell: true,
  env: { ...process.env, NEXT_PUBLIC_FOOTER_WM: 'mono', NEXT_DIST_DIR: '.next-footermono' },
});

child.on('exit', (code) => process.exit(code ?? 0));
