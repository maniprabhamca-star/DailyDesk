// Matching a form number typed into the ⌘K palette.
//
// Its own module, and tested, because the obvious version of this is wrong and
// fails silently: someone types "w9", the form is called "W-9", and splitting
// the haystack on punctuation gives the words "w" and "9" — neither of which
// starts with "w9". The palette then says "No matches" for the single most
// common way anyone writes that form's name, while the build and every test
// stay green. So both sides get their separators removed, not just the query.

/** One row of /forms-api/index: short, name, aka, group label, href. */
export type FormHit = { s: string; n: string; a: string; g: string; h: string };

export function matchesForm(f: FormHit, query: string): boolean {
  const q = query.trim().toLowerCase();
  // Two characters minimum. A single one is never a form search and would be a
  // substring of most form numbers — typing "-" would list three dozen forms.
  if (q.length < 2) return false;
  const hay = `${f.s} ${f.n} ${f.a}`.toLowerCase();
  if (hay.includes(q)) return true;
  // "w9" → "W-9", "form16" → "Form 16", "1099nec" → "1099-NEC".
  const bare = q.replace(/[^a-z0-9]/g, '');
  return bare.length >= 2 && hay.replace(/[^a-z0-9]/g, '').includes(bare);
}
