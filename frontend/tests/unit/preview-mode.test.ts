import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';

/* Which renderer the scanner uses, remembered per device.
 *
 * Small enough to look not worth testing, and it is the thing standing
 * between one phone and a usable scanner — so the cases that matter are the
 * ones where storage misbehaves. A browser in private mode throws on both
 * reading and writing, and if that took the scanner down with it, the setting
 * meant to rescue a broken device would break a working one.
 */

function fakeStorage(behaviour: 'works' | 'throws' = 'works') {
  const map = new Map<string, string>();
  return {
    getItem: (k: string) => {
      if (behaviour === 'throws') throw new DOMException('blocked');
      return map.has(k) ? map.get(k)! : null;
    },
    setItem: (k: string, v: string) => {
      if (behaviour === 'throws') throw new DOMException('blocked');
      map.set(k, v);
    },
    removeItem: (k: string) => { map.delete(k); },
    clear: () => map.clear(),
    key: () => null,
    length: 0,
  } as unknown as Storage;
}

const setStorage = (s: Storage | undefined) => {
  (globalThis as { localStorage?: Storage }).localStorage = s as Storage;
};

async function load() {
  vi.resetModules();
  return import('@/lib/preview-mode');
}

beforeEach(() => setStorage(fakeStorage()));
afterEach(() => { delete (globalThis as { localStorage?: Storage }).localStorage; });

describe('the scanner preview mode', () => {
  it('defaults to the video element, and to nobody having chosen', async () => {
    const m = await load();
    // The default has to be `video`: every phone but one works that way, and
    // the canvas path is the one with the bad history.
    expect(m.readPreviewMode()).toBe('video');
    expect(m.hasChosenPreviewMode(), 'an untouched device has not answered').toBe(false);
  });

  it('remembers a switch to canvas', async () => {
    const m = await load();
    m.writePreviewMode('canvas');
    expect(m.readPreviewMode()).toBe('canvas');
    expect(m.hasChosenPreviewMode()).toBe(true);
  });

  it('remembers being told the video path is fine', async () => {
    // Written when a capture comes out clean, which is proof the person can
    // see what they are aiming at — so the offer stops being made.
    const m = await load();
    m.writePreviewMode('video');
    expect(m.readPreviewMode()).toBe('video');
    expect(m.hasChosenPreviewMode(), 'answered, even though the answer is the default').toBe(true);
  });

  it('survives storage that throws, which is private mode', async () => {
    setStorage(fakeStorage('throws'));
    const m = await load();
    expect(() => m.writePreviewMode('canvas')).not.toThrow();
    expect(m.readPreviewMode(), 'falls back to the working default').toBe('video');
    expect(m.hasChosenPreviewMode(), 'and offers the choice rather than assuming').toBe(false);
  });

  it('survives there being no storage at all', async () => {
    setStorage(undefined);
    const m = await load();
    expect(() => m.writePreviewMode('canvas')).not.toThrow();
    expect(m.readPreviewMode()).toBe('video');
  });

  it('treats anything unrecognised as unanswered', async () => {
    const store = fakeStorage();
    store.setItem('dd-scanner-preview', 'gl');     // a value from some future us
    setStorage(store);
    const m = await load();
    expect(m.readPreviewMode()).toBe('video');
    expect(m.hasChosenPreviewMode()).toBe(false);
  });
});
