// The one list of words the forms copy may not use.
//
// It lives here rather than inside a test file because two suites now enforce
// it — the task pages and the Pro packet — and two copies of a safety rule is
// one copy that quietly falls behind. Anything new that puts forms copy in
// front of a reader imports this.
//
// ── What the rule is ────────────────────────────────────────────────────────
// A page that says "you must file Form SS-4" has told the reader what the law
// requires of them, which is the practice of tax advice. A page that says
// "Form SS-4 is how an employer identification number is requested" has told
// them a fact about a document. Both get the reader where they are going; only
// one of them is a claim we are in a position to make.
//
// Making the vocabulary itself unable to express the claim is stronger than
// intending not to make it, because intent does not survive the fortieth entry
// written at the end of a long day.
export const ADVICE_VOCABULARY: [RegExp, string][] = [
  [/\brequired\b/i, '"required" — say which forms are involved, not that one is required'],
  // Deliberately the bare word, not "you must". The first version of this
  // test only caught the second-person form, so "employers who must take on
  // their first employee" sailed straight through a guard written to stop
  // exactly that claim. No forms copy needs "must" in any person, so the
  // broad version costs nothing and catches the paraphrase.
  [/\bmust\b/i, '"must" — in any person. State what a form is, not what anyone has to do'],
  [/\byou need to file\b/i, '"you need to file" — an instruction, not a fact about a form'],
  [/\byou (?:will )?need to (?:submit|complete|send|get|apply)\b/i, '"you need to …" — same'],
  [/\bmandatory\b/i, '"mandatory" — a conclusion about the reader'],
  [/\bobligated\b|\bobliged\b/i, '"obligated"/"obliged" — same'],
  [/\bbe sure to\b|\bdon.t forget\b/i, 'an instruction dressed as a reminder'],
  [/\bhave to file\b|\bhas to file\b/i, '"has to file" — a conclusion about the reader'],
  [/\bmake sure (?:you|to)\b/i, '"make sure you" — advice'],
  [/\bwe recommend\b/i, '"we recommend" — advice'],
  [/\byou should\b/i, '"you should" — advice'],
];

/** Every breach in `strings`, formatted for an assertion message. */
export function adviceBreaches(strings: readonly string[]): string[] {
  const hits: string[] = [];
  for (const s of strings) {
    for (const [re, why] of ADVICE_VOCABULARY) {
      if (re.test(s)) hits.push(`${why}\n    in: ${s.slice(0, 90)}…`);
    }
  }
  return hits;
}
