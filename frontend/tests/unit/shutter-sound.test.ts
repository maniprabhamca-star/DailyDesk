import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

/* The shutter click.
 *
 * There is no way to assert what something SOUNDS like in a test, and no
 * point pretending otherwise. What is worth holding is the promise the module
 * makes: it is a nicety bolted to the side of a camera, and it must never be
 * able to break the camera. Every browser below is one that exists — an old
 * one with no Web Audio, a locked-down one that throws on construction, a
 * mobile one that starts suspended — and in each of them the only acceptable
 * outcome is that capture carries on.
 *
 * The graph assertions are deliberately thin: two taps, routed to the output.
 * Anything finer would be a test of the tuning, and the tuning is a judgement
 * about how a camera sounds, not a fact.
 */

type Node = { connect: (n: unknown) => unknown; [k: string]: unknown };

function fakeAudio() {
  const started: number[] = [];
  const connectedToDestination: unknown[] = [];
  const destination = {};
  let closed = false;

  const node = (extra: Record<string, unknown> = {}): Node => {
    const n: Node = {
      ...extra,
      connect(target: unknown) {
        if (target === destination) connectedToDestination.push(n);
        return target;
      },
    };
    return n;
  };

  const ctx = {
    state: 'running' as string,
    currentTime: 0,
    sampleRate: 48000,
    destination,
    resume: vi.fn(() => { ctx.state = 'running'; return Promise.resolve(); }),
    close: vi.fn(() => { closed = true; ctx.state = 'closed'; return Promise.resolve(); }),
    createBuffer: (_ch: number, length: number) => ({
      sampleRate: 48000,
      getChannelData: () => new Float32Array(length),
    }),
    createBufferSource: () => node({
      buffer: null,
      start: (t: number) => started.push(t),
      stop: () => {},
    }),
    createBiquadFilter: () => node({ type: '', frequency: { value: 0 }, Q: { value: 0 } }),
    createGain: () => node({
      gain: {
        setValueAtTime: () => {},
        linearRampToValueAtTime: () => {},
        exponentialRampToValueAtTime: () => {},
      },
    }),
  };
  return { ctx, started, connectedToDestination, isClosed: () => closed };
}

const setWindow = (w: unknown) => {
  (globalThis as { window?: unknown }).window = w;
};

async function load() {
  vi.resetModules();                 // the module caches its AudioContext
  return import('@/lib/shutter-sound');
}

beforeEach(() => { setWindow(undefined); });
afterEach(() => { delete (globalThis as { window?: unknown }).window; });

describe('the shutter click', () => {
  it('makes a pair of taps, routed to the speakers', async () => {
    const audio = fakeAudio();
    setWindow({ AudioContext: function () { return audio.ctx; } });
    const { playShutter } = await load();

    playShutter();

    // Two mechanical events, not one — a single click reads as a UI beep.
    expect(audio.started.length, 'a shutter opens and closes').toBe(2);
    expect(audio.started[1], 'the second follows the first, it does not land on it')
      .toBeGreaterThan(audio.started[0]);
    expect(audio.started[1] - audio.started[0], 'close enough to be one mechanism')
      .toBeLessThan(0.15);
    expect(audio.connectedToDestination.length, 'both taps reach the output').toBe(2);
  });

  it('says nothing, and throws nothing, where there is no Web Audio', async () => {
    setWindow({});                                   // old browser: no constructor
    const { playShutter, primeShutter, releaseShutter } = await load();
    expect(() => { primeShutter(); playShutter(); releaseShutter(); }).not.toThrow();
  });

  it('survives a browser that refuses to build an AudioContext', async () => {
    // Locked-down and embedded browsers do this. A camera must not care.
    setWindow({ AudioContext: function () { throw new Error('blocked'); } });
    const { playShutter } = await load();
    expect(() => playShutter()).not.toThrow();
  });

  it('survives a server render, where there is no window at all', async () => {
    const { playShutter, primeShutter } = await load();
    expect(() => { primeShutter(); playShutter(); }).not.toThrow();
  });

  it('wakes a suspended device, which is how phones hand it over', async () => {
    const audio = fakeAudio();
    audio.ctx.state = 'suspended';
    setWindow({ AudioContext: function () { return audio.ctx; } });
    const { primeShutter } = await load();

    // Priming happens on the tap that opens the scanner, because an automatic
    // capture is not a user gesture and browsers will not start audio without
    // one — the silence would fall exactly where nobody is watching the screen.
    primeShutter();
    expect(audio.ctx.resume).toHaveBeenCalled();
  });

  it('accepts the webkit-prefixed constructor', async () => {
    const audio = fakeAudio();
    setWindow({ webkitAudioContext: function () { return audio.ctx; } });
    const { playShutter } = await load();
    playShutter();
    expect(audio.started.length).toBe(2);
  });

  it('hands the audio device back when the scanner closes', async () => {
    const audio = fakeAudio();
    setWindow({ AudioContext: function () { return audio.ctx; } });
    const { playShutter, releaseShutter } = await load();
    playShutter();
    releaseShutter();
    expect(audio.isClosed(), 'an open context keeps the phone’s audio awake').toBe(true);
    // And a click after closing must still not throw.
    expect(() => playShutter()).not.toThrow();
  });
});
