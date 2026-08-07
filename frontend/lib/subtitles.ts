// SRT ↔ VTT ↔ plain text.
//
// The two formats are close enough that most converters just swap the commas in
// the timestamps for full stops — and then the file fails to load, because SRT
// wants a numbered cue and WebVTT wants a WEBVTT header. Both are handled here,
// along with the things real subtitle files carry: a BOM, CRLF, cue settings
// after the timestamp, VTT NOTE and STYLE blocks, and italics.

export type Cue = { start: number; end: number; text: string; id?: string };

const clean = (s: string) => s.replace(/^﻿/, '').replace(/\r\n?/g, '\n');

/** "01:02:03,400" / "02:03.400" / "1:02:03.4" → seconds. */
export function parseTime(text: string): number | null {
  const m = text.trim().match(/^(?:(\d+):)?(\d{1,2}):(\d{1,2})[.,](\d{1,3})$/);
  if (!m) return null;
  const [, h, mm, ss, ms] = m;
  return Number(h || 0) * 3600 + Number(mm) * 60 + Number(ss) + Number(ms.padEnd(3, '0')) / 1000;
}

export function formatTime(seconds: number, style: 'srt' | 'vtt'): string {
  const s = Math.max(0, seconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = Math.floor(s % 60);
  const ms = Math.round((s - Math.floor(s)) * 1000);
  const two = (n: number) => String(n).padStart(2, '0');
  const three = String(ms).padStart(3, '0');
  return style === 'srt'
    ? `${two(h)}:${two(m)}:${two(sec)},${three}`
    : `${two(h)}:${two(m)}:${two(sec)}.${three}`;
}

const TIME_LINE = /^(.+?)\s*-->\s*([^\s]+)(?:\s+(.*))?$/;

/** Reads SRT and VTT with the same pass — the only real difference is the
 *  header and the decimal separator, and both are tolerated either way. */
export function parseSubtitles(input: string): Cue[] {
  const lines = clean(input).split('\n');
  const cues: Cue[] = [];
  let i = 0;
  // Skip a WEBVTT header and anything attached to it.
  if (lines[0]?.startsWith('WEBVTT')) {
    i = 1;
    while (i < lines.length && lines[i].trim()) i++;
  }

  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) { i++; continue; }

    // VTT metadata blocks carry no dialogue.
    if (/^(NOTE|STYLE|REGION)\b/.test(line)) {
      i++;
      while (i < lines.length && lines[i].trim()) i++;
      continue;
    }

    let id: string | undefined;
    let timeLine = line;
    // SRT puts a cue number on its own line; VTT allows an optional label.
    if (!TIME_LINE.test(line) && i + 1 < lines.length && TIME_LINE.test(lines[i + 1])) {
      id = line.trim();
      timeLine = lines[i + 1];
      i++;
    }

    const m = TIME_LINE.exec(timeLine);
    if (!m) { i++; continue; }
    const start = parseTime(m[1]);
    const end = parseTime(m[2]);
    i++;
    if (start === null || end === null) continue;

    const body: string[] = [];
    while (i < lines.length && lines[i].trim()) { body.push(lines[i]); i++; }
    const text = body.join('\n').trim();
    if (text) cues.push({ start, end: Math.max(end, start), text, id });
  }
  return cues;
}

/** Shift every cue, e.g. when the subtitles run ahead of the audio. Cues can't
 *  go negative, so a big negative shift clamps at zero rather than inverting. */
export function shiftCues(cues: Cue[], seconds: number): Cue[] {
  if (!seconds) return cues;
  return cues.map((c) => ({ ...c, start: Math.max(0, c.start + seconds), end: Math.max(0, c.end + seconds) }));
}

const stripTags = (s: string) => s.replace(/<[^>]+>/g, '').replace(/\{\\[^}]*\}/g, '');

export function toSrt(cues: Cue[]): string {
  return cues
    .map((c, n) => `${n + 1}\n${formatTime(c.start, 'srt')} --> ${formatTime(c.end, 'srt')}\n${c.text}`)
    .join('\n\n')
    .concat('\n');
}

export function toVtt(cues: Cue[]): string {
  const body = cues
    .map((c) => `${formatTime(c.start, 'vtt')} --> ${formatTime(c.end, 'vtt')}\n${c.text}`)
    .join('\n\n');
  return `WEBVTT\n\n${body}\n`;
}

/** Just the words — for a transcript, a summary, or feeding to something else.
 *  Consecutive cues are joined into paragraphs at sentence ends. */
export function toText(cues: Cue[]): string {
  const out: string[] = [];
  let para: string[] = [];
  for (const c of cues) {
    const text = stripTags(c.text).replace(/\s*\n\s*/g, ' ').trim();
    if (!text) continue;
    para.push(text);
    if (/[.!?]["')\]]?$/.test(text)) { out.push(para.join(' ')); para = []; }
  }
  if (para.length) out.push(para.join(' '));
  return out.join('\n\n');
}

export type SubtitleFormat = 'srt' | 'vtt' | 'txt';

export function detectFormat(input: string, filename = ''): SubtitleFormat {
  if (/^﻿?WEBVTT/.test(input)) return 'vtt';
  if (/\.vtt$/i.test(filename)) return 'vtt';
  return 'srt';
}

export function write(cues: Cue[], format: SubtitleFormat): string {
  return format === 'srt' ? toSrt(cues) : format === 'vtt' ? toVtt(cues) : toText(cues);
}

export const MIME: Record<SubtitleFormat, string> = {
  srt: 'application/x-subrip',
  vtt: 'text/vtt',
  txt: 'text/plain;charset=utf-8',
};
