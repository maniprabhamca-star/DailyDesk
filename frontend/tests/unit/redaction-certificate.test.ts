import { describe, it, expect } from 'vitest';
import { buildCertificate, verifyAgainst, pageRanges, sha256 } from '@/lib/redaction-certificate';

// The certificate is only worth anything if the hash actually pins the file.
// These test the claim, not the rendering.
const bytes = (s: string) => new TextEncoder().encode(s);

describe('redaction certificate', () => {
  it('pins the output file by hash', async () => {
    const out = bytes('redacted-pdf-contents');
    const cert = await buildCertificate(bytes('original'), out, 'x-redacted.pdf', {
      sourceName: 'x.pdf', sourceBytes: 8, redactedPages: [2, 1], areas: 3, beforeChars: 500, afterChars: 0,
    }, new Date('2026-08-08T12:00:00Z'));

    expect(cert.output.sha256).toBe(await sha256(out));
    expect(cert.source.sha256).toBe(await sha256(bytes('original')));
    expect(cert.redaction.pages).toEqual([1, 2]); // sorted for humans
    expect(cert.redaction.textLayer).toEqual({ beforeChars: 500, afterChars: 0, removed: true });
  });

  it('records when text SURVIVED, rather than quietly claiming success', async () => {
    const cert = await buildCertificate(bytes('a'), bytes('b'), 'o.pdf', {
      sourceName: 'a.pdf', sourceBytes: 1, redactedPages: [1], areas: 1, beforeChars: 100, afterChars: 42,
    }, new Date());
    expect(cert.redaction.textLayer?.removed).toBe(false);
  });

  it('verifies a matching file and rejects a different one', async () => {
    const out = bytes('the-real-output');
    const cert = await buildCertificate(bytes('src'), out, 'o.pdf', {
      sourceName: 's.pdf', sourceBytes: 3, redactedPages: [1], areas: 1,
    }, new Date());
    const json = JSON.stringify(cert);

    const good = await verifyAgainst(json, bytes('the-real-output').buffer as ArrayBuffer);
    expect(good.status).toBe('match');

    const bad = await verifyAgainst(json, bytes('a-different-file').buffer as ArrayBuffer);
    expect(bad.status).toBe('mismatch');
    if (bad.status === 'mismatch') expect(bad.actual).not.toBe(cert.output.sha256);
  });

  it('refuses anything that is not one of our certificates', async () => {
    expect((await verifyAgainst('not json', bytes('x').buffer as ArrayBuffer)).status).toBe('unreadable');
    expect((await verifyAgainst('{"format":"something-else"}', bytes('x').buffer as ArrayBuffer)).status).toBe('unreadable');
  });

  it('collapses page runs the way a person would read them', () => {
    expect(pageRanges([1, 2, 3, 4, 9])).toBe('1–4, 9');
    expect(pageRanges([7])).toBe('7');
    expect(pageRanges([])).toBe('—');
    expect(pageRanges([5, 1, 2])).toBe('1–2, 5');
  });
});
