import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

// A receipt for a redaction.
//
// The point is not decoration. When you hand a redacted PDF to the other side,
// to a regulator or to a patient, the questions that follow are always the same:
// is this the file you say it is, was the text actually removed or just covered,
// and did the document go anywhere while you worked on it. A cloud tool can
// answer the first two and cannot honestly answer the third — the file was on
// their servers by definition. We can answer all three.
//
// What makes this verifiable rather than decorative is the hash pair. Anyone
// holding the redacted PDF can compute its SHA-256 and compare; if it matches,
// this certificate describes that exact file and no other. The original's hash
// lets you prove which source it came from without ever revealing the source.
//
// What it deliberately does NOT claim: this is not a trusted timestamp and not a
// third-party attestation. The time is your device's clock and the certificate
// is generated locally, which is precisely why nothing had to be uploaded to
// produce it. Saying so plainly is the difference between a document a lawyer
// can use and one they cannot.

export const CERT_VERSION = 1;

export type RedactionEvidence = {
  /** Original file, as chosen. */
  sourceName: string;
  sourceBytes: number;
  /** Pages that carried at least one redaction (1-based, for humans). */
  redactedPages: number[];
  /** Total boxes applied. */
  areas: number;
  /** Selectable characters on the redacted pages, before and after. */
  beforeChars?: number;
  afterChars?: number;
};

export type RedactionCertificate = {
  format: 'diemdesk-redaction-certificate';
  version: number;
  issuedAt: string;
  processing: 'on-device';
  source: { name: string; bytes: number; sha256: string };
  output: { name: string; bytes: number; sha256: string };
  redaction: {
    pages: number[];
    areas: number;
    textLayer?: { beforeChars: number; afterChars: number; removed: boolean };
  };
  notes: string[];
};

export async function sha256(data: ArrayBuffer | Uint8Array): Promise<string> {
  const buf = data instanceof Uint8Array
    ? data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength)
    : data;
  const digest = await crypto.subtle.digest('SHA-256', buf as ArrayBuffer);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Group consecutive page numbers so "1–4, 9" beats "1, 2, 3, 4, 9". */
export function pageRanges(pages: number[]): string {
  if (!pages.length) return '—';
  const sorted = [...pages].sort((a, b) => a - b);
  const out: string[] = [];
  let start = sorted[0];
  let prev = sorted[0];
  for (let i = 1; i <= sorted.length; i += 1) {
    const n = sorted[i];
    if (n !== prev + 1) {
      out.push(start === prev ? `${start}` : `${start}–${prev}`);
      start = n;
    }
    prev = n;
  }
  return out.join(', ');
}

export async function buildCertificate(
  originalBytes: ArrayBuffer | Uint8Array,
  outputBytes: Uint8Array,
  outputName: string,
  ev: RedactionEvidence,
  now: Date,
): Promise<RedactionCertificate> {
  const [srcHash, outHash] = await Promise.all([sha256(originalBytes), sha256(outputBytes)]);
  const hasText = typeof ev.beforeChars === 'number' && typeof ev.afterChars === 'number';
  return {
    format: 'diemdesk-redaction-certificate',
    version: CERT_VERSION,
    issuedAt: now.toISOString(),
    processing: 'on-device',
    source: { name: ev.sourceName, bytes: ev.sourceBytes, sha256: srcHash },
    output: { name: outputName, bytes: outputBytes.byteLength, sha256: outHash },
    redaction: {
      pages: [...ev.redactedPages].sort((a, b) => a - b),
      areas: ev.areas,
      ...(hasText
        ? { textLayer: { beforeChars: ev.beforeChars!, afterChars: ev.afterChars!, removed: ev.afterChars === 0 } }
        : {}),
    },
    notes: [
      'The redacted pages were rasterised, so the text underneath each box was removed rather than covered.',
      'Both files were processed entirely in the browser on the device that produced this certificate. Neither file was uploaded.',
      'This certificate records the device clock at the time of issue. It is not a trusted timestamp and not a third-party attestation.',
      'To verify: compute the SHA-256 of the redacted PDF and compare it with the output hash above.',
    ],
  };
}

/** The human-readable half — one page, printable, hashes in full. */
export async function certificateToPdf(cert: RedactionCertificate): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([595, 842]); // A4
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const body = await doc.embedFont(StandardFonts.Helvetica);
  const mono = await doc.embedFont(StandardFonts.Courier);

  const ink = rgb(0.06, 0.09, 0.16);
  const grey = rgb(0.42, 0.45, 0.5);
  const line = rgb(0.85, 0.86, 0.89);
  const M = 56;
  let y = 786;

  const text = (s: string, opts: { font?: typeof body; size?: number; color?: typeof ink; gap?: number } = {}) => {
    const f = opts.font ?? body;
    const size = opts.size ?? 10.5;
    page.drawText(s, { x: M, y, size, font: f, color: opts.color ?? ink });
    y -= (opts.gap ?? size + 6);
  };
  const rule = (gap = 14) => {
    page.drawLine({ start: { x: M, y: y + 4 }, end: { x: 595 - M, y: y + 4 }, thickness: 0.75, color: line });
    y -= gap;
  };
  const field = (label: string, value: string) => {
    page.drawText(label, { x: M, y, size: 8.5, font: bold, color: grey });
    page.drawText(value, { x: M + 132, y, size: 9.5, font: body, color: ink });
    y -= 17;
  };

  text('Redaction certificate', { font: bold, size: 19, gap: 26 });
  text('A record of what was removed, from which file, and where it was done.', { color: grey, size: 10, gap: 20 });
  rule(20);

  text('The files', { font: bold, size: 11.5, gap: 16 });
  field('Original', cert.source.name);
  field('Redacted', cert.output.name);
  y -= 4;

  text('SHA-256 of the original', { font: bold, size: 8.5, color: grey, gap: 13 });
  // Split so a 64-character hash never runs off the page.
  page.drawText(cert.source.sha256.slice(0, 32), { x: M, y, size: 8.5, font: mono, color: ink }); y -= 12;
  page.drawText(cert.source.sha256.slice(32), { x: M, y, size: 8.5, font: mono, color: ink }); y -= 18;
  text('SHA-256 of the redacted file', { font: bold, size: 8.5, color: grey, gap: 13 });
  page.drawText(cert.output.sha256.slice(0, 32), { x: M, y, size: 8.5, font: mono, color: ink }); y -= 12;
  page.drawText(cert.output.sha256.slice(32), { x: M, y, size: 8.5, font: mono, color: ink }); y -= 22;
  rule(20);

  text('What was removed', { font: bold, size: 11.5, gap: 16 });
  field('Pages affected', pageRanges(cert.redaction.pages));
  field('Areas redacted', String(cert.redaction.areas));
  if (cert.redaction.textLayer) {
    const t = cert.redaction.textLayer;
    field('Selectable text', `${t.beforeChars} characters before, ${t.afterChars} after`);
    field('Result', t.removed
      ? 'No selectable text remains on the redacted pages.'
      : 'Text still present — review before releasing this file.');
  }
  y -= 6;
  rule(20);

  text('Where it happened', { font: bold, size: 11.5, gap: 16 });
  field('Processing', 'On this device, in the browser');
  field('Uploaded', 'Nothing. Neither file left the machine.');
  field('Issued', new Date(cert.issuedAt).toLocaleString());
  y -= 8;
  rule(18);

  text('Notes', { font: bold, size: 9.5, color: grey, gap: 14 });
  for (const n of cert.notes) {
    // Wrap by hand: pdf-lib has no text box, and a certificate that runs off the
    // page is worse than no certificate.
    const words = n.split(' ');
    let lineText = '';
    for (const w of words) {
      const next = lineText ? `${lineText} ${w}` : w;
      if (body.widthOfTextAtSize(next, 8.5) > 595 - M * 2) {
        page.drawText(lineText, { x: M, y, size: 8.5, font: body, color: grey }); y -= 11;
        lineText = w;
      } else lineText = next;
    }
    if (lineText) { page.drawText(lineText, { x: M, y, size: 8.5, font: body, color: grey }); y -= 15; }
  }

  page.drawText(`DiemDesk · certificate format v${cert.version} · verify at diemdesk.com/verify-redaction`, {
    x: M, y: 44, size: 8, font: body, color: grey,
  });

  doc.setTitle('Redaction certificate');
  doc.setProducer('DiemDesk');
  doc.setCreator('DiemDesk');
  return doc.save();
}

/** What a verifier concludes when given a certificate and a candidate file. */
export type VerifyResult =
  | { status: 'match'; cert: RedactionCertificate }
  | { status: 'mismatch'; cert: RedactionCertificate; actual: string }
  | { status: 'unreadable'; reason: string };

export async function verifyAgainst(certJson: string, fileBytes: ArrayBuffer): Promise<VerifyResult> {
  let cert: RedactionCertificate;
  try {
    cert = JSON.parse(certJson) as RedactionCertificate;
  } catch {
    return { status: 'unreadable', reason: 'That file isn’t a certificate we can read — it should be the .json we generated.' };
  }
  if (cert?.format !== 'diemdesk-redaction-certificate' || !cert.output?.sha256) {
    return { status: 'unreadable', reason: 'That JSON isn’t a DiemDesk redaction certificate.' };
  }
  const actual = await sha256(fileBytes);
  return actual === cert.output.sha256 ? { status: 'match', cert } : { status: 'mismatch', cert, actual };
}
