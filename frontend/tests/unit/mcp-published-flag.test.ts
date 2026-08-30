import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const SRC = readFileSync(join(process.cwd(), 'app/mcp-server/page.tsx'), 'utf8');
const published = /const PUBLISHED = (true|false);/.exec(SRC)?.[1];

// The page tells developers to run `npx -y diemdesk-mcp`. Until that package is
// on the registry those commands 404, and a broken instruction reads as a
// broken product rather than an unreleased one. One flag controls both notices,
// so this only checks the flag and the notices cannot drift apart.
describe('mcp-server page: the coming-shortly flag', () => {
  it('declares the flag exactly once', () => {
    expect(published, 'PUBLISHED must be a literal true/false').toBeDefined();
    expect(SRC.match(/const PUBLISHED =/g)).toHaveLength(1);
  });

  it('warns on both the hero and the setup steps while unpublished', () => {
    if (published !== 'false') return; // published — the notices are meant to be gone
    const guards = SRC.match(/\{!PUBLISHED && \(/g) ?? [];
    expect(guards.length, 'expected a notice in the hero AND above the commands').toBe(2);
    expect(SRC).toContain('Coming shortly.');
    expect(SRC).toContain('not published yet');
  });

  it('leaves no notice behind once the flag flips', () => {
    if (published !== 'true') return;
    expect(SRC).not.toContain('Coming shortly.');
    expect(SRC).not.toContain('not published yet');
  });
});
