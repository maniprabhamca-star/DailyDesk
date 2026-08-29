import { describe, expect, it } from 'vitest';
import { catalog } from '@/components/app/catalog';

// 67 of 114 tools shipped with no card description at all, and nobody noticed
// for months. The cause was structural, not careless: the blurbs lived in
// all-tools-directory.tsx, a file about how the grid LOOKS, so someone adding a
// tool row to catalog.tsx was never asked the question. They live on the tool
// now, and these tests make the omission impossible rather than unlikely.

const TOOLS = catalog.flatMap((g) => g.tools.map((t) => ({ ...t, group: g.label })));

// The tool's own name, in the words most likely to be echoed back at the reader.
const nameWords = (name: string) =>
  name
    .toLowerCase()
    .replace(/[&.]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2 && !['pdf', 'the', 'and', 'to', 'from', 'your'].includes(w));

describe('tool card blurbs', () => {
  it('covers every tool in the catalogue', () => {
    for (const t of TOOLS) {
      expect(t.desc, `${t.group} / ${t.name} has no desc`).toBeTruthy();
    }
  });

  it('says enough to be worth a line of vertical space', () => {
    // Under five words it is a label, not a description, and the card is better
    // off without the row.
    for (const t of TOOLS) {
      const words = t.desc.trim().split(/\s+/).length;
      expect(words, `${t.name}: "${t.desc}" is only ${words} words`).toBeGreaterThanOrEqual(5);
    }
  });

  it('stays within two lines at card width', () => {
    // ~62 characters is two lines in the card's 12px type. Past that the grid
    // rows go ragged, which is what we were fixing.
    for (const t of TOOLS) {
      expect(t.desc.length, `${t.name}: "${t.desc}" is ${t.desc.length} chars`).toBeLessThanOrEqual(64);
    }
  });

  it('never just restates the tool name', () => {
    // "Word into a PDF" under "Word to PDF" is the failure this whole change is
    // about. Counting echoed words was the obvious check and it was wrong: a
    // one-word name like Merge cannot be described without saying "merge", and
    // "Reorder before you merge" is plainly not a restatement. What matters is
    // what is LEFT once the name is taken out — that remainder is the entire
    // reason the line is on the card.
    const FILLER = ['pdf', 'the', 'and', 'into', 'your', 'you', 'for', 'with', 'from'];
    for (const t of TOOLS) {
      const words = nameWords(t.name);
      const remainder = t.desc
        .toLowerCase()
        .replace(/[.,—-]/g, ' ')
        .split(/\s+/)
        .filter((w) => w.length > 2 && !words.includes(w) && !FILLER.includes(w));
      expect(
        remainder.length,
        `${t.name}: "${t.desc}" says almost nothing the title did not (${remainder.join(' ')})`,
      ).toBeGreaterThanOrEqual(4);
    }
  });

  it('has no duplicate blurbs', () => {
    const seen = new Map<string, string>();
    for (const t of TOOLS) {
      const prev = seen.get(t.desc);
      expect(prev, `${t.name} and ${prev} share a blurb: "${t.desc}"`).toBeUndefined();
      seen.set(t.desc, t.name);
    }
  });

  it('reads as a sentence, not a fragment shouting', () => {
    for (const t of TOOLS) {
      // iPhone, eBook and camelCase open lowercase on purpose; a lowercase run followed
      // by a capital is a brand, not a slip.
      const startsProperly = t.desc[0] === t.desc[0].toUpperCase() || /^[a-z]+[A-Z]/.test(t.desc);
      expect(startsProperly, `${t.name}: blurb should start with a capital`).toBe(true);
      expect(t.desc.trim().endsWith('.'), `${t.name}: blurb should end with a full stop`).toBe(true);
    }
  });
});
