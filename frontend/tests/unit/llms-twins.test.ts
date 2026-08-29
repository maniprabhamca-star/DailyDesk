import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

// The Markdown twins and /llms.txt are how an AI assistant reads this site.
// They are GENERATED from the built pages and deliberately git-ignored, which
// makes them easy to break silently: remove the postbuild hook and they simply
// stop being written, the files are not in the repo to notice their absence,
// and every .md URL starts 404ing while the site looks perfectly fine.
//
// So the wiring is what gets asserted here, plus the one content rule that
// actually matters — a gated tool must never be advertised.

const ROOT = path.resolve(__dirname, '..', '..');
const read = (p: string) => fs.readFileSync(path.join(ROOT, p), 'utf8');

describe('llms.txt + markdown twins', () => {
  it('is wired into the build, so twins regenerate on every deploy', () => {
    const pkg = JSON.parse(read('package.json'));
    expect(pkg.scripts.postbuild, 'package.json needs a postbuild that runs gen-llms').toMatch(/gen-llms/);
  });

  it('is generated from the BUILT pages, never from hand-written source', () => {
    const gen = read('scripts/gen-llms.mjs');
    // Reading .next means a twin is the published page by construction. Parsing
    // the .tsx instead would let the twin describe a page we do not actually
    // ship, which is worse than having no twin.
    expect(gen).toMatch(/\.next/);
    expect(gen).toMatch(/server['"\s,)]*,?\s*['"]app/);
  });

  it('keeps the generated files out of git so nobody hand-edits one', () => {
    const ignore = read('.gitignore');
    expect(ignore).toMatch(/^public\/llms\.txt$/m);
    expect(ignore).toMatch(/^public\/\*\.md$/m);
  });

  it('takes its route list from the sitemap, so gated tools cannot leak in', () => {
    const gen = read('scripts/gen-llms.mjs');
    expect(gen).toMatch(/sitemap\.ts/);
  });

  it('advertises the twins from every page', () => {
    const layout = read('app/layout.tsx');
    expect(layout).toMatch(/rel="help"[^>]*href="\/llms\.txt"/);
  });

  // Everything below only runs once a build has produced the files. Skipped
  // rather than failed on a clean checkout, so `vitest` alone stays green.
  const built = fs.existsSync(path.join(ROOT, 'public', 'llms.txt'));

  it.skipIf(!built)('lists a substantial catalogue, not a stub', () => {
    const txt = read('public/llms.txt');
    const links = txt.match(/^- \[/gm) || [];
    expect(links.length).toBeGreaterThan(50);
  });

  it.skipIf(!built)('never advertises a tool that is gated', () => {
    const flags = read('lib/tool-flags.tsx');
    const block = flags.match(/DEFAULT_TOOL_FLAGS: FlagMap = \{([\s\S]*?)\n\};/);
    const gated: string[] = [];
    for (const m of (block ? block[1] : '').matchAll(/'([^']+)':\s*'([a-z_]+)'/g)) {
      if (m[2] === 'coming_soon' || m[2] === 'disabled') gated.push(m[1]);
    }
    const txt = read('public/llms.txt');
    const leaked = gated.filter((href) => txt.includes(`https://diemdesk.com${href})`));
    expect(leaked, `gated routes advertised to assistants: ${leaked.join(', ')}`).toEqual([]);
  });

  it.skipIf(!built)('gives each twin a URL, a price and real prose', () => {
    const md = read('public/compress-pdf.md');
    expect(md).toMatch(/^# /);
    expect(md).toMatch(/URL: https:\/\/diemdesk\.com\/compress-pdf/);
    expect(md).toMatch(/Price: (Free|Pro)/);
    expect(md).toMatch(/## How to use it/);
    expect(md).toMatch(/## Frequently asked questions/);
    // No markup should survive into a file whose whole point is being plain.
    expect(md).not.toMatch(/<[a-z][^>]*>/i);
    expect(md).not.toMatch(/&(amp|lt|gt|quot|#\d+);/);
  });
});
