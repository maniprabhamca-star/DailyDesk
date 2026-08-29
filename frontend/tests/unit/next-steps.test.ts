import { readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { NEXT_STEPS, nextStepsFor } from '@/lib/next-steps';
import { catalog } from '@/components/app/catalog';

// The dock only works if every link lands somewhere and every reason is a
// reason. A dead link here is worse than no dock: the reader trusted a
// suggestion and got a 404 in the middle of a job.

const APP = join(process.cwd(), 'app');
const routeExists = (href: string) => {
  const seg = href.replace(/^\//, '').split('/')[0];
  return existsSync(join(APP, seg, 'page.tsx'));
};
const TOOL_HREFS = new Set(
  catalog.flatMap((g) => g.tools).map((t) => t.href).filter(Boolean) as string[],
);

const entries = Object.entries(NEXT_STEPS);

describe('what comes next', () => {
  it('keys off routes that exist', () => {
    for (const [from] of entries) {
      expect(routeExists(from), `NEXT_STEPS has "${from}" but there is no such route`).toBe(true);
    }
  });

  it('only suggests tools that exist', () => {
    for (const [from, steps] of entries) {
      for (const s of steps) {
        expect(routeExists(s.href), `${from} → ${s.href} has no route`).toBe(true);
        expect(TOOL_HREFS.has(s.href), `${from} → ${s.href} is not a catalogue tool`).toBe(true);
      }
    }
  });

  it('never suggests the page you are already on', () => {
    for (const [from, steps] of entries) {
      for (const s of steps) {
        expect(s.href, `${from} suggests itself`).not.toBe(from);
      }
    }
  });

  it('has no duplicate suggestion within one step', () => {
    for (const [from, steps] of entries) {
      const seen = new Set<string>();
      for (const s of steps) {
        expect(seen.has(s.href), `${from} suggests ${s.href} twice`).toBe(false);
        seen.add(s.href);
      }
    }
  });

  it('gives a real reason, not a description', () => {
    // "Merge PDF combines files" is what the tool does — the reader can read
    // that on the card. The dock has to say why it follows THIS step.
    for (const [from, steps] of entries) {
      for (const s of steps) {
        const words = s.why.trim().split(/\s+/).length;
        expect(words, `${from} → ${s.label}: "${s.why}" is only ${words} words`).toBeGreaterThanOrEqual(6);
        expect(s.why.trim().endsWith('.'), `${from} → ${s.label}: reason should end with a full stop`).toBe(true);
      }
    }
  });

  it('shows at most two, so it stays a next step and not a menu', () => {
    for (const [from, steps] of entries) {
      expect(steps.length, `${from} has ${steps.length} suggestions`).toBeGreaterThanOrEqual(1);
      expect(steps.length, `${from} has ${steps.length} — more than two reads as a related-links block`).toBeLessThanOrEqual(2);
    }
  });

  it('returns nothing for a tool with no genuine next step', () => {
    // Deliberate: an empty dock beats an invented one.
    expect(nextStepsFor('/word-counter')).toEqual([]);
    expect(nextStepsFor('/not-a-route')).toEqual([]);
  });

  it('covers the tools people actually finish a job on', () => {
    // If these lose their entry, the feature has quietly stopped working where
    // it matters most.
    for (const key of ['/compress-pdf', '/merge-pdf', '/sign-pdf', '/redact-pdf', '/scan-to-pdf']) {
      expect(nextStepsFor(key).length, `${key} has no next step`).toBeGreaterThan(0);
    }
  });
});
