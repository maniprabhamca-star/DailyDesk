import { describe, it, expect } from 'vitest';
import { detectFormat, formatTime, parseSubtitles, parseTime, shiftCues, toSrt, toText, toVtt } from '@/lib/subtitles';

const SRT = `1
00:00:01,000 --> 00:00:04,000
The first caption.

2
00:00:05,500 --> 00:00:08,250
A second one, split
across two lines.
`;

const VTT = `WEBVTT
Kind: captions

NOTE this block is metadata, not dialogue

00:00:01.000 --> 00:00:04.000 line:90%
The first caption.

00:00:05.500 --> 00:00:08.250
A second one.
`;

describe('parseTime / formatTime', () => {
  it('reads both separators and optional hours', () => {
    expect(parseTime('00:00:01,000')).toBe(1);
    expect(parseTime('00:00:01.500')).toBe(1.5);
    expect(parseTime('01:02:03,400')).toBe(3723.4);
    expect(parseTime('02:03.400')).toBe(123.4);
  });

  it('rejects nonsense rather than guessing', () => {
    expect(parseTime('not a time')).toBeNull();
    expect(parseTime('')).toBeNull();
  });

  it('writes the separator each format expects', () => {
    expect(formatTime(3723.4, 'srt')).toBe('01:02:03,400');
    expect(formatTime(3723.4, 'vtt')).toBe('01:02:03.400');
    expect(formatTime(0, 'srt')).toBe('00:00:00,000');
  });

  it('round-trips', () => {
    for (const t of [0, 1, 61.25, 3723.4]) expect(parseTime(formatTime(t, 'srt'))).toBeCloseTo(t, 3);
  });
});

describe('parseSubtitles', () => {
  it('reads SRT, keeping multi-line captions together', () => {
    const cues = parseSubtitles(SRT);
    expect(cues).toHaveLength(2);
    expect(cues[0]).toMatchObject({ start: 1, end: 4, text: 'The first caption.' });
    expect(cues[1].text).toBe('A second one, split\nacross two lines.');
  });

  it('reads VTT, skipping the header, NOTE blocks and cue settings', () => {
    const cues = parseSubtitles(VTT);
    expect(cues).toHaveLength(2);
    expect(cues[0].text).toBe('The first caption.');
    expect(cues[1].start).toBe(5.5);
  });

  it('survives CRLF and a BOM', () => {
    expect(parseSubtitles('﻿' + SRT.replace(/\n/g, '\r\n'))).toHaveLength(2);
  });

  it('returns nothing for a file with no cues, instead of inventing one', () => {
    expect(parseSubtitles('just some prose\n\nand more prose')).toEqual([]);
  });

  it('never lets a cue end before it starts', () => {
    const [cue] = parseSubtitles('1\n00:00:05,000 --> 00:00:02,000\nBackwards.');
    expect(cue.end).toBeGreaterThanOrEqual(cue.start);
  });
});

describe('writers', () => {
  it('renumbers SRT cues from one', () => {
    const out = toSrt(parseSubtitles(VTT));
    expect(out.startsWith('1\n')).toBe(true);
    expect(out).toContain('\n2\n');
    expect(out).toContain('00:00:01,000 --> 00:00:04,000');
  });

  it('writes a WEBVTT header — the reason a renamed .srt fails', () => {
    const out = toVtt(parseSubtitles(SRT));
    expect(out.startsWith('WEBVTT\n')).toBe(true);
    expect(out).toContain('00:00:01.000 --> 00:00:04.000');
    expect(out).not.toContain(',000 -->');
  });

  it('makes a transcript: no timings, tags stripped, sentences joined', () => {
    const cues = parseSubtitles('1\n00:00:01,000 --> 00:00:02,000\n<i>Half a</i>\n\n2\n00:00:02,000 --> 00:00:03,000\nsentence.\n\n3\n00:00:04,000 --> 00:00:05,000\nAnother one.');
    const text = toText(cues);
    expect(text).toContain('Half a sentence.');
    expect(text).not.toContain('<i>');
    expect(text).not.toContain('00:00');
    expect(text.split('\n\n')).toHaveLength(2);
  });
});

describe('shiftCues', () => {
  it('moves every cue', () => {
    const out = shiftCues(parseSubtitles(SRT), 2.5);
    expect(out[0].start).toBe(3.5);
    expect(out[0].end).toBe(6.5);
  });

  it('clamps at zero instead of going negative', () => {
    const out = shiftCues(parseSubtitles(SRT), -10);
    expect(out[0].start).toBe(0);
    expect(out[0].end).toBe(0);
  });

  it('is a no-op at zero', () => {
    const cues = parseSubtitles(SRT);
    expect(shiftCues(cues, 0)).toBe(cues);
  });
});

describe('detectFormat', () => {
  it('spots VTT by its header or extension', () => {
    expect(detectFormat(VTT)).toBe('vtt');
    expect(detectFormat(SRT, 'movie.vtt')).toBe('vtt');
    expect(detectFormat(SRT, 'movie.srt')).toBe('srt');
  });
});
