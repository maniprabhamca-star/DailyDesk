import { describe, it, expect } from 'vitest';
import { clock, parseClock, encodeWav, shapePcm, MP3_BITRATES } from '@/lib/audio-convert';

// A stand-in for the AudioBuffer the browser hands back — only the parts
// shapePcm actually reads.
function fakeBuffer(channels: Float32Array[], sampleRate = 8000) {
  return {
    sampleRate,
    numberOfChannels: channels.length,
    length: channels[0].length,
    duration: channels[0].length / sampleRate,
    getChannelData: (i: number) => channels[i],
  } as unknown as AudioBuffer;
}

const ramp = (n: number, offset = 0) => Float32Array.from({ length: n }, (_, i) => (i + offset) / n);

describe('clock / parseClock', () => {
  it('reads durations the way people write them', () => {
    expect(clock(0)).toBe('0:00');
    expect(clock(9)).toBe('0:09');
    expect(clock(90)).toBe('1:30');
    expect(clock(3725)).toBe('1:02:05');
  });

  it('parses what people type', () => {
    expect(parseClock('90')).toBe(90);
    expect(parseClock('1:30')).toBe(90);
    expect(parseClock('1:02:05')).toBe(3725);
    expect(parseClock(' 2:00 ')).toBe(120);
  });

  it('treats nonsense as zero rather than throwing mid-type', () => {
    expect(parseClock('')).toBe(0);
    expect(parseClock('abc')).toBe(0);
    expect(parseClock(':')).toBe(0);
  });

  it('round-trips', () => {
    for (const s of [0, 7, 61, 599, 3600, 4001]) expect(parseClock(clock(s))).toBe(s);
  });
});

describe('shapePcm', () => {
  const opts = { format: 'mp3' as const, kbps: 192, mono: false, trimStart: 0, trimEnd: 0 };

  it('keeps the whole file when no trim is set', () => {
    const out = shapePcm(fakeBuffer([ramp(800), ramp(800)]), opts);
    expect(out.channels).toHaveLength(2);
    expect(out.channels[0]).toHaveLength(800);
    expect(out.seconds).toBeCloseTo(0.1, 5);
  });

  it('trims from a start time', () => {
    const out = shapePcm(fakeBuffer([ramp(800)]), { ...opts, trimStart: 0.05 });
    expect(out.channels[0]).toHaveLength(400);
    expect(out.channels[0][0]).toBeCloseTo(400 / 800, 5);
  });

  it('trims to an end time', () => {
    const out = shapePcm(fakeBuffer([ramp(800)]), { ...opts, trimEnd: 0.05 });
    expect(out.channels[0]).toHaveLength(400);
  });

  it('never returns an empty or reversed range', () => {
    const out = shapePcm(fakeBuffer([ramp(800)]), { ...opts, trimStart: 0.09, trimEnd: 0.01 });
    expect(out.channels[0].length).toBeGreaterThan(0);
  });

  it('clamps an end time past the real duration', () => {
    const out = shapePcm(fakeBuffer([ramp(800)]), { ...opts, trimEnd: 99 });
    expect(out.channels[0]).toHaveLength(800);
  });

  it('folds to mono by averaging the channels', () => {
    const left = Float32Array.from([1, 1, -1, 0]);
    const right = Float32Array.from([0, -1, -1, 0]);
    const out = shapePcm(fakeBuffer([left, right], 4), { ...opts, mono: true });
    expect(out.channels).toHaveLength(1);
    expect(Array.from(out.channels[0])).toEqual([0.5, 0, -1, 0]);
  });

  it('copies out of the source buffer so the caller owns the memory', () => {
    const src = ramp(100);
    const out = shapePcm(fakeBuffer([src], 100), opts);
    out.channels[0][0] = 0.42;
    expect(src[0]).not.toBe(0.42);
  });
});

describe('encodeWav', () => {
  it('writes a RIFF/WAVE header a decoder will accept', async () => {
    const blob = encodeWav([Float32Array.from([0, 0.5, -0.5, 1])], 44100);
    const view = new DataView(await blob.arrayBuffer());
    const tag = (off: number) => String.fromCharCode(view.getUint8(off), view.getUint8(off + 1), view.getUint8(off + 2), view.getUint8(off + 3));
    expect(tag(0)).toBe('RIFF');
    expect(tag(8)).toBe('WAVE');
    expect(tag(12)).toBe('fmt ');
    expect(tag(36)).toBe('data');
    expect(view.getUint16(20, true)).toBe(1);      // PCM
    expect(view.getUint16(22, true)).toBe(1);      // mono
    expect(view.getUint32(24, true)).toBe(44100);
    expect(view.getUint16(34, true)).toBe(16);     // bit depth
    expect(blob.type).toBe('audio/wav');
  });

  it('sizes the file from the samples, and interleaves stereo', async () => {
    const blob = encodeWav([Float32Array.from([0, 1]), Float32Array.from([0, -1])], 8000);
    const buf = await blob.arrayBuffer();
    expect(buf.byteLength).toBe(44 + 2 * 2 * 2);
    const view = new DataView(buf);
    expect(view.getUint32(4, true)).toBe(36 + 8);
    expect(view.getInt16(44 + 4, true)).toBe(32767);   // left of frame 2
    expect(view.getInt16(44 + 6, true)).toBe(-32768);  // right of frame 2
  });

  it('clips instead of wrapping around', async () => {
    const view = new DataView(await encodeWav([Float32Array.from([2, -2])], 8000).arrayBuffer());
    expect(view.getInt16(44, true)).toBe(32767);
    expect(view.getInt16(46, true)).toBe(-32768);
  });
});

describe('bitrates', () => {
  it('offers a sane ladder with 192 in it', () => {
    expect(MP3_BITRATES).toContain(192);
    expect([...MP3_BITRATES].sort((a, b) => a - b)).toEqual(MP3_BITRATES);
  });
});
