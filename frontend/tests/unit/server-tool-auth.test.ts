import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

// Every server-side tool meters the free tier and lets Pro through. The server
// can only see a plan it is TOLD about, so a request without the session token
// is anonymous — and a paying subscriber gets capped at three a day on the
// exact tools whose pages promise "unlimited on Pro".
//
// This has now been shipped three separate times: OCR, the Office converters,
// and Webpage to PDF. It is invisible in review (the tool works, it just quietly
// bills the wrong tier), invisible in typecheck, and invisible in E2E because
// the suite browses signed out. So it gets a source-level check instead.

const ROOT = path.join(process.cwd(), 'components');

/** Every .tsx under components/ that talks to a metered server endpoint. */
function callersOfMeteredEndpoints(): Array<{ file: string; src: string }> {
  const out: Array<{ file: string; src: string }> = [];
  (function walk(dir: string) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.name.endsWith('.tsx')) {
        const src = fs.readFileSync(p, 'utf8');
        // The metered routers: /api/convert/* (3/day free) and /api/ocr (Pro).
        if (/['"`]\/api\/(convert\/|ocr)/.test(src)) {
          out.push({ file: path.relative(process.cwd(), p), src });
        }
      }
    }
  })(ROOT);
  return out;
}

describe('server tools send the session token', () => {
  const callers = callersOfMeteredEndpoints();

  it('finds the components that call a metered endpoint', () => {
    // If this drops to zero the check has stopped checking anything — most
    // likely because an endpoint moved or the path is now built from a variable.
    expect(callers.length, 'no components call /api/convert or /api/ocr — has the check gone stale?').toBeGreaterThanOrEqual(3);
  });

  it('every one of them attaches the Bearer token', () => {
    const missing = callers
      .filter(({ src }) => !(/Authorization/.test(src) && /dd_token/.test(src)))
      .map(({ file }) => `${file} — calls a metered endpoint without an Authorization header, so Pro users are billed as anonymous`);

    expect(missing, missing.join('\n')).toEqual([]);
  });

  it('reads the token from the same place the rest of the app does', () => {
    // One key name. `dd_token` is what lib/api.ts and the AI client use; a
    // typo here fails silently and looks exactly like a logged-out user.
    for (const { file, src } of callers) {
      const keys = [...src.matchAll(/localStorage\.getItem\((['"`])([^'"`]+)\1\)/g)].map((m) => m[2]);
      for (const k of keys) {
        expect(k, `${file} reads localStorage key "${k}" — the session token is "dd_token"`).toBe('dd_token');
      }
    }
  });
});
