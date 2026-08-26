import { describe, it, expect } from 'vitest';
import { catalog, isNewTool, NEW_FOR_DAYS, type CatTool } from '@/components/app/catalog';
import { CHANGELOG } from '@/lib/changelog';

// The "New" chip went missing in the most embarrassing way available: ten tools
// shipped over three days, the chip is driven by a per-tool date, and nobody set
// one — so the site advertised no new tools at all during the exact week it had
// the most. The old field was an EXPIRY date, which asked the shipper to decide
// when the chip should die; the field is now the ship date, and this file makes
// forgetting it a failing test rather than something a human has to notice.

const DAY = 24 * 60 * 60 * 1000;
const tools = (): CatTool[] => catalog.flatMap((g) => g.tools);
const isoDay = (t: number) => new Date(t).toISOString().slice(0, 10);

describe('the "New" chip', () => {
  it('shows for a tool that shipped today, and for one shipped a day short of the window', () => {
    expect(isNewTool({ name: 'x', icon: null as never, badge: 'device', since: isoDay(Date.now()) })).toBe(true);
    expect(isNewTool({ name: 'x', icon: null as never, badge: 'device', since: isoDay(Date.now() - (NEW_FOR_DAYS - 1) * DAY) })).toBe(true);
  });

  it('retires itself once the window passes', () => {
    expect(isNewTool({ name: 'x', icon: null as never, badge: 'device', since: isoDay(Date.now() - (NEW_FOR_DAYS + 1) * DAY) })).toBe(false);
  });

  it('lasts at least a month — the point of the chip', () => {
    expect(NEW_FOR_DAYS).toBeGreaterThanOrEqual(30);
  });

  it('ignores a tool with no ship date, and does not throw on a malformed one', () => {
    expect(isNewTool({ name: 'x', icon: null as never, badge: 'device' })).toBe(false);
    expect(isNewTool({ name: 'x', icon: null as never, badge: 'device', since: 'last Tuesday' })).toBe(false);
  });

  it('never claims a tool dated in the future is new', () => {
    expect(isNewTool({ name: 'x', icon: null as never, badge: 'device', since: isoDay(Date.now() + 5 * DAY) })).toBe(false);
  });

  it('every ship date is a real yyyy-mm-dd', () => {
    for (const t of tools()) {
      if (!t.since) continue;
      expect(t.since, t.name).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(Number.isNaN(Date.parse(`${t.since}T00:00:00Z`)), t.name).toBe(false);
    }
  });

  // The one that would have caught the original miss. Every meaningful ship gets
  // a changelog entry — that rule already exists — so the changelog is the
  // honest record of what is recent, and the catalogue must agree with it.
  it('any tool announced in the changelog within the window is flagged new', () => {
    const cutoff = Date.now() - NEW_FOR_DAYS * DAY;
    // Only kind 'new'. An 'improved' entry means an existing tool got better,
    // which is not what this chip says — the passport pages were rewritten on
    // the 23rd and flagging them "New" would have been a small lie.
    const recentHrefs = new Set(
      CHANGELOG
        .filter((e) => e.kind === 'new' && e.href && Date.parse(`${e.date}T00:00:00Z`) >= cutoff)
        .map((e) => e.href as string),
    );

    const missing = tools()
      .filter((t) => t.href && recentHrefs.has(t.href) && !isNewTool(t))
      .map((t) => `${t.name} (${t.href}) — announced recently but has no live "since" date`);

    expect(missing, missing.join('\n')).toEqual([]);
  });
});
