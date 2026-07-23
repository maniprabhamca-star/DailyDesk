// Pure text-segmentation for read-aloud — NO pdf.js/React, unit-testable. Splits a
// document's text into short "segments" (roughly sentences) so the player can speak
// one at a time and highlight the one being read. Speaking sentence-by-sentence is
// far more reliable across browsers than depending on word-boundary events.

const HARD_CAP = 240; // a very long run gets broken so a segment isn't unwieldy

export function splitSegments(text: string): string[] {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (!clean) return [];

  // Split on sentence terminators followed by a space (keep the terminator).
  const sentences = clean.split(/(?<=[.!?…])\s+/);
  const out: string[] = [];

  for (const s of sentences) {
    const t = s.trim();
    if (!t) continue;
    if (t.length <= HARD_CAP) { out.push(t); continue; }

    // Break an over-long run on commas/semicolons/colons first, then on spaces.
    let rest = t;
    while (rest.length > HARD_CAP) {
      let cut = -1;
      const softStop = rest.slice(0, HARD_CAP).lastIndexOf(', ');
      const space = rest.slice(0, HARD_CAP).lastIndexOf(' ');
      cut = softStop > HARD_CAP * 0.5 ? softStop + 1 : space > 0 ? space : HARD_CAP;
      out.push(rest.slice(0, cut).trim());
      rest = rest.slice(cut).trim();
    }
    if (rest) out.push(rest);
  }
  return out.filter(Boolean);
}
