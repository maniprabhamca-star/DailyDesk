// Launches a Next dev server for one brand-mark candidate on its own port + build
// dir, so all four review servers can run concurrently without clobbering .next
// or each other's inlined NEXT_PUBLIC_BRAND_VARIANT.
//
// Usage: node scripts/preview-brand.mjs <A|B|C|D|E> <port>
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const variant = (process.argv[2] || 'A').toUpperCase();
const port = process.argv[3] || '3001';

const frontend = join(dirname(fileURLToPath(import.meta.url)), '..', 'frontend');

const child = spawn('npx', ['next', 'dev', '-p', port], {
  cwd: frontend,
  stdio: 'inherit',
  shell: true,
  env: {
    ...process.env,
    NEXT_PUBLIC_BRAND_VARIANT: variant,
    NEXT_DIST_DIR: `.next-brand-${variant}`,
  },
});

child.on('exit', (code) => process.exit(code ?? 0));
