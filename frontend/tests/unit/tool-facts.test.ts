import { describe, it, expect } from 'vitest';
import { TOOL_FACTS, factsFor } from '@/lib/tool-facts';

// Example unit test (docs/qa/qa-master-plan.md §2, archetype seed). The facts
// data drives the "what this does to your file" / "where this won't help" blocks;
// if a link or shape is wrong, 67 pages render wrong text.

describe('tool-facts data integrity', () => {
  it('factsFor returns null for an unknown route', () => {
    expect(factsFor('/not-a-real-tool')).toBeNull();
  });

  it('every effect has a valid tone and non-empty labels', () => {
    for (const [route, facts] of Object.entries(TOOL_FACTS)) {
      for (const e of facts.effects ?? []) {
        expect(e.what, route).toBeTruthy();
        expect(e.value, route).toBeTruthy();
        expect(['good', 'warn'], `${route} ${e.what}`).toContain(e.tone);
      }
    }
  });

  it('every limit with an href points somewhere real and has a label', () => {
    for (const [route, facts] of Object.entries(TOOL_FACTS)) {
      for (const l of facts.limits ?? []) {
        expect(l.title, route).toBeTruthy();
        expect(l.detail, route).toBeTruthy();
        if (l.href) {
          expect(l.href, `${route} ${l.title}`).toMatch(/^(\/|https?:)/);
          expect(l.hrefLabel, `${route} ${l.title}`).toBeTruthy();
        }
      }
    }
  });

  it('compress-pdf tells the truth about signatures (promise-guard)', () => {
    const f = factsFor('/compress-pdf');
    const sig = f?.effects?.find((e) => /signature/i.test(e.what));
    expect(sig?.value).toMatch(/invalidat/i);
    expect(sig?.tone).toBe('warn');
  });
});
