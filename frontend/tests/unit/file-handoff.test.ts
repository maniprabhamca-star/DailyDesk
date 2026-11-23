// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setHandoff, takeHandoff, handoffInFlight } from '@/lib/file-handoff';

// Two owner-reported failures, both on the "get this form and fill it" button,
// both invisible to every other test:
//
//   1. Clicking it landed on an EMPTY dropzone. The hand-off expired after 12
//      seconds measured from before the navigation started, and the target
//      route's code-split chunk had not finished downloading.
//   2. Clicking it opened the WRONG form — the one from an earlier session —
//      because the session restore fires on a timer and a hand-off that is
//      still parsing has not set the tool's file yet.
//
// Neither is reachable from a render test and neither throws, so they are
// pinned here instead.

const pdf = (name: string) => new File([new Uint8Array([0x25, 0x50, 0x44, 0x46])], name, { type: 'application/pdf' });
const goTo = (path: string) => window.history.replaceState({}, '', path);

beforeEach(() => {
  vi.useFakeTimers();
  setHandoff(null);
  goTo('/fill-pdf-form');
});
afterEach(() => vi.useRealTimers());

describe('file hand-off', () => {
  it('survives a navigation far slower than the old 12-second window', () => {
    setHandoff(pdf('form-1040-x.pdf'), '/fill-pdf-form');
    vi.advanceTimersByTime(30_000); // a cold-cache chunk fetch on a bad connection
    expect(takeHandoff()?.name, 'the file was thrown away mid-navigation').toBe('form-1040-x.pdf');
  });

  it('still expires, so it cannot outlive the journey it belongs to', () => {
    setHandoff(pdf('form-w-9.pdf'), '/fill-pdf-form');
    vi.advanceTimersByTime(121_000);
    expect(takeHandoff()).toBeNull();
  });

  it('is only claimable by the page it was addressed to', () => {
    setHandoff(pdf('form-i-485.pdf'), '/fill-pdf-form');
    goTo('/compress-pdf');
    expect(takeHandoff(), 'another tool claimed a file meant for the fill tool').toBeNull();
    // …and it is still there for the page it was meant for.
    goTo('/fill-pdf-form');
    expect(takeHandoff()?.name).toBe('form-i-485.pdf');
  });

  it('can only be claimed once', () => {
    setHandoff(pdf('form-941.pdf'), '/fill-pdf-form');
    expect(takeHandoff()).not.toBeNull();
    expect(takeHandoff()).toBeNull();
  });

  it('reports itself in flight while waiting and just after being claimed', () => {
    expect(handoffInFlight()).toBe(false);
    setHandoff(pdf('form-i-130.pdf'), '/fill-pdf-form');
    expect(handoffInFlight(), 'a waiting hand-off must hold off the session restore').toBe(true);
    takeHandoff();
    expect(handoffInFlight(), 'a file still being parsed must hold off the session restore').toBe(true);
  });

  it('is not in flight for a page it was not addressed to', () => {
    setHandoff(pdf('form-n-400.pdf'), '/fill-pdf-form');
    goTo('/rotate-pdf');
    expect(handoffInFlight(), 'an unrelated tool would have blocked its own session restore').toBe(false);
  });

  it('clears on an explicit null, so a gated target leaves nothing behind', () => {
    setHandoff(pdf('form-ss-5.pdf'), '/fill-pdf-form');
    setHandoff(null);
    expect(takeHandoff()).toBeNull();
  });
});
