// Launches a Next dev server with the Pro upsell FORCED ON (NEXT_PUBLIC_PRO_UPSELL=1)
// so the owner can test the over-limit "upgrade" message locally as a free user
// (no ddadmin cookie on localhost = treated as free). Its own build dir keeps it
// clear of the other dev servers. Never used in production.
//
// Usage: node scripts/preview-upsell.mjs [port]
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const port = process.argv[2] || '3005';
const frontend = join(dirname(fileURLToPath(import.meta.url)), '..', 'frontend');

const child = spawn('npx', ['next', 'dev', '-p', port], {
  cwd: frontend,
  stdio: 'inherit',
  shell: true,
  env: {
    ...process.env,
    NEXT_PUBLIC_PRO_UPSELL: '1',
    NEXT_DIST_DIR: '.next-upsell',
  },
});

child.on('exit', (code) => process.exit(code ?? 0));
