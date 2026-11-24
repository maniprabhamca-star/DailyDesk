// The Pro packet: fetch every form a task needs, in order, with the details
// that repeat across them already in the boxes.
//
// ── Why the maps are keyed by TASK AND FORM, not by form ─────────────────────
// The same form means different things in different jobs. On the W-4 inside
// "hire your first employee", the name and the social security number belong to
// the person being hired — writing the employer's own number there would be a
// materially wrong filing. The employer block at the bottom of that same page
// IS the employer's. So a map is authored for a (task, form) pair, and a pair
// nobody authored gets no pre-fill at all. The safe direction is the default.
//
// ── Why every box carries an expected length ─────────────────────────────────
// IRS field names are opaque — f1_01, f1_11 — and these PDFs carry no tooltips,
// so there is nothing in the file that says what a box is for. Every entry below
// was authored by rendering the form with each box stamped with its own id and
// reading which box the stamp landed in. That evidence is a snapshot: the IRS
// re-issues forms without notice, and a renumbered box would silently receive
// somebody's social security number. So each entry also pins what the real PDF
// must report, and the filler SKIPS a box that does not match and says so,
// rather than writing into whatever moved there. tests/unit/form-packet.test.ts
// re-checks all of it against the live files.
//
// ── Why nothing here is stored ───────────────────────────────────────────────
// The shared details exist for the life of one packet, in the page's own memory.
// There is no database row, no local storage key and no request carrying them:
// the forms are fetched blank and filled in the browser, which is the same path
// every other tool on the site takes.

import { US_FORMS } from '@/lib/us-forms';
import { FORM_TASKS } from '@/lib/form-tasks';

/** The details a person would otherwise copy from form to form. */
export type SharedKey =
  | 'firstName'
  | 'lastName'
  | 'businessName'
  | 'street'
  | 'cityStateZip'
  | 'ssn'
  | 'ein';

export type SharedDetails = Partial<Record<SharedKey, string>>;

/** A value a box can take: either a detail as given, or one built from several. */
export type PacketSource = SharedKey | 'fullName' | 'addressOneLine' | 'businessBlock';

export type PacketField = {
  /** The exact, fully-qualified field name in the agency's own PDF. */
  readonly name: string;
  /** What the form calls this line, in the form's own numbering. */
  readonly line: string;
  /** The label printed beside the box, as the reader will see it. */
  readonly label: string;
  readonly source: PacketSource;
  /** How the raw value is rendered into this box. */
  readonly as?: 'ssn-dashed' | 'ein-dashed';
  /** For comb boxes — one digit per printed cell — which digits land here. */
  readonly digits?: readonly [number, number];
  /** What the real PDF must report for this box. `null` means "no limit set".
   *  A mismatch is treated as a re-issued form and the box is left alone. */
  readonly maxLength: number | null;
  /** Boxes in the same group are alternatives on the form itself. A W-9 takes a
   *  social security number or an employer number, never both; if the user has
   *  given both, the form cannot be filled for them and none are written. */
  readonly oneOf?: string;
  /** Printed beside the value, where the box is right for the common case but
   *  the reader has to confirm it is right for theirs. */
  readonly note?: string;
};

export type PacketMap = {
  readonly taskSlug: string;
  readonly formSlug: string;
  /** The day a person last rendered this form and read the boxes. Separate from
   *  the weekly robot check, which can see that a form changed but not that a
   *  box now means something else. */
  readonly verifiedOn: string;
  readonly fields: readonly PacketField[];
  /** Boxes deliberately left for the reader, and why. Printed on the page: a
   *  packet that quietly skips something looks broken. */
  readonly unmapped?: readonly { readonly line: string; readonly label: string; readonly why: string }[];
};

const VERIFIED = '2026-11-24';

// ─────────────────────────────────────────────────────────────────────────────
// Form W-9 — the contractor's own copy.
// ─────────────────────────────────────────────────────────────────────────────
const W9_SELF: readonly PacketField[] = [
  { name: 'topmostSubform[0].Page1[0].f1_01[0]', line: '1', label: 'Name of entity/individual', source: 'fullName', maxLength: null },
  { name: 'topmostSubform[0].Page1[0].f1_02[0]', line: '2', label: 'Business name/disregarded entity name, if different from above', source: 'businessName', maxLength: null },
  { name: 'topmostSubform[0].Page1[0].Address_ReadOrder[0].f1_07[0]', line: '5', label: 'Address (number, street, and apt. or suite no.)', source: 'street', maxLength: null },
  { name: 'topmostSubform[0].Page1[0].Address_ReadOrder[0].f1_08[0]', line: '6', label: 'City, state, and ZIP code', source: 'cityStateZip', maxLength: null },
  // Part I is a row of printed cells, one digit each, so the number is written
  // in pieces rather than as one string.
  { name: 'topmostSubform[0].Page1[0].f1_11[0]', line: 'Part I', label: 'Social security number', source: 'ssn', digits: [0, 3], maxLength: 3, oneOf: 'tin' },
  { name: 'topmostSubform[0].Page1[0].f1_12[0]', line: 'Part I', label: 'Social security number', source: 'ssn', digits: [3, 5], maxLength: 2, oneOf: 'tin' },
  { name: 'topmostSubform[0].Page1[0].f1_13[0]', line: 'Part I', label: 'Social security number', source: 'ssn', digits: [5, 9], maxLength: 4, oneOf: 'tin' },
  { name: 'topmostSubform[0].Page1[0].f1_14[0]', line: 'Part I', label: 'Employer identification number', source: 'ein', digits: [0, 2], maxLength: 2, oneOf: 'tin' },
  { name: 'topmostSubform[0].Page1[0].f1_15[0]', line: 'Part I', label: 'Employer identification number', source: 'ein', digits: [2, 9], maxLength: 7, oneOf: 'tin' },
];

// ─────────────────────────────────────────────────────────────────────────────
// Form W-4 — only the block the employer fills. Everything above it is the new
// employee's, and the person running this packet is not that person.
// ─────────────────────────────────────────────────────────────────────────────
const W4_EMPLOYER: readonly PacketField[] = [
  { name: 'topmostSubform[0].Page1[0].f1_12[0]', line: 'Employers Only', label: "Employer's name and address", source: 'businessBlock', maxLength: null },
  { name: 'topmostSubform[0].Page1[0].f1_14[0]', line: 'Employers Only', label: 'Employer identification number (EIN)', source: 'ein', as: 'ein-dashed', maxLength: 10 },
];

// ─────────────────────────────────────────────────────────────────────────────
// Form SS-4 — applying for the employer number.
// ─────────────────────────────────────────────────────────────────────────────
const SS4_SELF: readonly PacketField[] = [
  {
    name: 'topmostSubform[0].Page1[0].f1_2[0]',
    line: '1',
    label: 'Legal name of entity (or individual) for whom the EIN is being requested',
    source: 'fullName',
    maxLength: null,
    note: 'This is your own name, which is what line 1 takes from a sole proprietor. If the number is for a company, put the company’s legal name here instead.',
  },
  { name: 'topmostSubform[0].Page1[0].f1_3[0]', line: '2', label: 'Trade name of business (if different from name on line 1)', source: 'businessName', maxLength: null },
  { name: 'topmostSubform[0].Page1[0].Line4ReadOrder[0].f1_5[0]', line: '4a', label: 'Mailing address (room, apt., suite no. and street, or P.O. box)', source: 'street', maxLength: null },
  { name: 'topmostSubform[0].Page1[0].Line4ReadOrder[0].f1_6[0]', line: '4b', label: 'City, state, and ZIP code', source: 'cityStateZip', maxLength: null },
  { name: 'topmostSubform[0].Page1[0].f1_10[0]', line: '7a', label: 'Name of responsible party', source: 'fullName', maxLength: null },
  { name: 'topmostSubform[0].Page1[0].f1_11[0]', line: '7b', label: 'SSN, ITIN, or EIN', source: 'ssn', as: 'ssn-dashed', maxLength: 11 },
];

// ─────────────────────────────────────────────────────────────────────────────
// Form 9465 — asking for a payment plan.
// ─────────────────────────────────────────────────────────────────────────────
const F9465_SELF: readonly PacketField[] = [
  { name: 'topmostSubform[0].Page1[0].f1_03[0]', line: '1a', label: 'Your first name and middle initial', source: 'firstName', maxLength: null },
  { name: 'topmostSubform[0].Page1[0].f1_04[0]', line: '1a', label: 'Last name', source: 'lastName', maxLength: null },
  { name: 'topmostSubform[0].Page1[0].f1_05[0]', line: '1a', label: 'Your social security number', source: 'ssn', as: 'ssn-dashed', maxLength: 11 },
  { name: 'topmostSubform[0].Page1[0].f1_09[0]', line: '2', label: 'Current address (number and street)', source: 'street', maxLength: null },
  { name: 'topmostSubform[0].Page1[0].f1_11[0]', line: '2', label: 'City, town or post office, state, and ZIP code', source: 'cityStateZip', maxLength: null },
];

// ─────────────────────────────────────────────────────────────────────────────
// Form 8822 — telling the IRS you moved.
// ─────────────────────────────────────────────────────────────────────────────
const F8822_SELF: readonly PacketField[] = [
  { name: 'topmostSubform[0].Page1[0].f1_3[0]', line: '3a', label: 'Your name (first name, initial, and last name)', source: 'fullName', maxLength: null },
  { name: 'topmostSubform[0].Page1[0].f1_4[0]', line: '3b', label: 'Your social security number', source: 'ssn', as: 'ssn-dashed', maxLength: 11 },
];

export const PACKET_MAPS: readonly PacketMap[] = [
  { taskSlug: 'get-paid-as-a-contractor', formSlug: 'form-w-9', verifiedOn: VERIFIED, fields: W9_SELF },
  { taskSlug: 'get-paid-as-a-contractor', formSlug: 'form-ss-4', verifiedOn: VERIFIED, fields: SS4_SELF },
  {
    taskSlug: 'hire-your-first-employee',
    formSlug: 'form-w-4',
    verifiedOn: VERIFIED,
    fields: W4_EMPLOYER,
    unmapped: [
      {
        line: 'Steps 1 to 4',
        label: 'Name, address, social security number and withholding',
        why: 'These are the new employee’s, not yours. Hand the form over with only the employer block filled.',
      },
    ],
  },
  { taskSlug: 'hire-your-first-employee', formSlug: 'form-ss-4', verifiedOn: VERIFIED, fields: SS4_SELF },
  { taskSlug: 'get-a-us-taxpayer-number', formSlug: 'form-ss-4', verifiedOn: VERIFIED, fields: SS4_SELF },
  {
    taskSlug: 'set-up-an-irs-payment-plan',
    formSlug: 'form-9465',
    verifiedOn: VERIFIED,
    fields: F9465_SELF,
    unmapped: [
      {
        line: '3',
        label: 'Your business name and employer identification number',
        why: 'Line 3 is for a sole proprietorship that has closed, which is a different thing from the business name you gave us.',
      },
    ],
  },
  {
    taskSlug: 'change-your-address-with-the-irs',
    formSlug: 'form-8822',
    verifiedOn: VERIFIED,
    fields: F8822_SELF,
    unmapped: [
      {
        line: '6a and 7',
        label: 'Your old address, and your new address',
        why: 'This form has two address boxes and only you know which one your address belongs in: 6a is where you used to live, 7 is where you live now.',
      },
    ],
  },
];

export function mapFor(taskSlug: string, formSlug: string): PacketMap | undefined {
  return PACKET_MAPS.find((m) => m.taskSlug === taskSlug && m.formSlug === formSlug);
}

/** Every form in a task, in the task's own order, with its map where one exists. */
export function packetFor(taskSlug: string): { formSlug: string; map?: PacketMap }[] {
  const task = FORM_TASKS.find((t) => t.slug === taskSlug);
  if (!task) return [];
  return task.forms.map((f) => ({ formSlug: f.slug, map: mapFor(taskSlug, f.slug) }));
}

/** Tasks that pre-fill at least one box. The rest still fetch in order. */
export function tasksWithPrefill(): string[] {
  return [...new Set(PACKET_MAPS.map((m) => m.taskSlug))];
}

// ── Filling ──────────────────────────────────────────────────────────────────

export const SHARED_LABELS: Record<SharedKey, string> = {
  firstName: 'First name and middle initial',
  lastName: 'Last name',
  businessName: 'Business or trade name',
  street: 'Street address',
  cityStateZip: 'City, state and ZIP',
  ssn: 'Social security number',
  ein: 'Employer identification number (EIN)',
};

/** Which of the shared details this packet would actually use. Asking for a
 *  social security number that no form in the set wants would be indefensible. */
export function keysUsedBy(taskSlug: string): SharedKey[] {
  const used = new Set<SharedKey>();
  for (const { map } of packetFor(taskSlug)) {
    for (const f of map?.fields ?? []) {
      for (const k of sourceKeys(f.source)) used.add(k);
    }
  }
  return (Object.keys(SHARED_LABELS) as SharedKey[]).filter((k) => used.has(k));
}

function sourceKeys(source: PacketSource): SharedKey[] {
  if (source === 'fullName') return ['firstName', 'lastName'];
  if (source === 'addressOneLine') return ['street', 'cityStateZip'];
  if (source === 'businessBlock') return ['businessName', 'firstName', 'lastName', 'street', 'cityStateZip'];
  return [source];
}

const digitsOnly = (s: string) => s.replace(/\D+/g, '');

/** A nine-digit number, or null. Both kinds of taxpayer number are nine digits;
 *  anything else is a typo and is not written into a federal form. */
function nineDigits(raw: string | undefined): string | null {
  if (!raw) return null;
  const d = digitsOnly(raw);
  return d.length === 9 ? d : null;
}

function rawValue(source: PacketSource, d: SharedDetails): string | null {
  const join = (parts: (string | undefined)[], sep: string) => {
    const kept = parts.map((p) => (p ?? '').trim()).filter(Boolean);
    return kept.length ? kept.join(sep) : null;
  };
  switch (source) {
    case 'fullName':
      return join([d.firstName, d.lastName], ' ');
    case 'addressOneLine':
      return join([d.street, d.cityStateZip], ', ');
    case 'businessBlock':
      return join([d.businessName || join([d.firstName, d.lastName], ' ') || undefined, d.street, d.cityStateZip], ', ');
    case 'ssn':
    case 'ein':
      return nineDigits(d[source]);
    default:
      return (d[source] ?? '').trim() || null;
  }
}

function render(field: PacketField, raw: string): string {
  if (field.digits) return digitsOnly(raw).slice(field.digits[0], field.digits[1]);
  if (field.as === 'ssn-dashed') {
    const n = digitsOnly(raw);
    return `${n.slice(0, 3)}-${n.slice(3, 5)}-${n.slice(5, 9)}`;
  }
  if (field.as === 'ein-dashed') {
    const n = digitsOnly(raw);
    return `${n.slice(0, 2)}-${n.slice(2, 9)}`;
  }
  return raw;
}

export type ActualField = { readonly maxLength: number | null };
export type PlannedWrite = { name: string; value: string; line: string; label: string; note?: string };
export type SkippedWrite = { name: string; line: string; label: string; why: string };
export type FillPlan = { writes: PlannedWrite[]; skipped: SkippedWrite[] };

/** Reasons a box is left alone. Each one is shown to the reader as written. */
export const SKIP = {
  missing: 'This box is not on the copy the agency is publishing today, so it was left blank.',
  resized: 'This box is a different size than when we checked it, so it was left blank.',
  empty: 'You did not give us this one.',
  tooLong: 'What you gave us is longer than the box holds.',
  badNumber: 'That is not a nine-digit number, so it was left for you to correct.',
  conflict: 'This form takes one taxpayer number and you gave two. Pick one on the form.',
} as const;

/**
 * Work out what would be written, without writing anything.
 *
 * Pure, so the whole fail-safe is testable without a PDF: hand it what the real
 * file reports and it decides. `actual` is the field table read from the PDF
 * that is about to be filled — the one the agency served a moment ago, not the
 * one the map was authored against.
 */
export function planFill(
  map: PacketMap,
  details: SharedDetails,
  actual: ReadonlyMap<string, ActualField>,
): FillPlan {
  const writes: PlannedWrite[] = [];
  const skipped: SkippedWrite[] = [];

  // A group whose members draw on more than one detail is unresolvable: the
  // form asks for one of them and we are not the ones to choose.
  const conflicted = new Set<string>();
  for (const group of new Set(map.fields.map((f) => f.oneOf).filter(Boolean) as string[])) {
    const sources = new Set(
      map.fields.filter((f) => f.oneOf === group && rawValue(f.source, details) !== null).map((f) => f.source),
    );
    if (sources.size > 1) conflicted.add(group);
  }

  for (const field of map.fields) {
    const stop = (why: string) => skipped.push({ name: field.name, line: field.line, label: field.label, why });

    if (field.oneOf && conflicted.has(field.oneOf)) {
      stop(SKIP.conflict);
      continue;
    }
    const found = actual.get(field.name);
    if (!found) {
      stop(SKIP.missing);
      continue;
    }
    if ((found.maxLength ?? null) !== field.maxLength) {
      stop(SKIP.resized);
      continue;
    }
    const raw = rawValue(field.source, details);
    if (raw === null) {
      const given = (field.source === 'ssn' || field.source === 'ein') && (details[field.source] ?? '').trim();
      stop(given ? SKIP.badNumber : SKIP.empty);
      continue;
    }
    const value = render(field, raw);
    if (!value) {
      stop(SKIP.empty);
      continue;
    }
    if (field.maxLength !== null && value.length > field.maxLength) {
      stop(SKIP.tooLong);
      continue;
    }
    writes.push({ name: field.name, value, line: field.line, label: field.label, note: field.note });
  }

  return { writes, skipped };
}

// ── Presenting a plan to a person ───────────────────────────────────────────
// A taxpayer number is three boxes on a W-9 and one on an SS-4. Listing the
// boxes is how the PDF sees it; the reader sees one number. Both of these
// collapse a per-box plan into per-line rows, because the raw version put
// "Social security number — this form takes one number and you gave two" on
// the page five times in a row, and would have shown a filled number as the
// fragments "123", "45", "6789".

export type WriteRow = {
  key: string;
  line: string;
  label: string;
  /** The pieces rejoined: for a row of printed cells, the number itself. */
  value: string;
  /** How many boxes this row covers. 1 for an ordinary field. */
  boxes: number;
  note?: string;
};

export function groupWrites(writes: readonly PlannedWrite[]): WriteRow[] {
  const rows: WriteRow[] = [];
  const at = new Map<string, number>();
  for (const w of writes) {
    const key = `${w.line}|${w.label}`;
    const i = at.get(key);
    if (i === undefined) {
      at.set(key, rows.length);
      rows.push({ key, line: w.line, label: w.label, value: w.value, boxes: 1, note: w.note });
    } else {
      rows[i].value += w.value;
      rows[i].boxes += 1;
      if (!rows[i].note && w.note) rows[i].note = w.note;
    }
  }
  return rows;
}

export type SkipRow = { key: string; line: string; label: string; why: string };

/** One line per distinct (line, label, reason). */
export function groupSkipped(skipped: readonly SkippedWrite[]): SkipRow[] {
  const rows: SkipRow[] = [];
  const seen = new Set<string>();
  for (const s of skipped) {
    const key = `${s.line}|${s.label}|${s.why}`;
    if (seen.has(key)) continue;
    seen.add(key);
    rows.push({ key, line: s.line, label: s.label, why: s.why });
  }
  return rows;
}

/** The agency file for a form, fetched blank through our own proxy. */
export function blankFormUrl(formSlug: string): string {
  return `/forms-api/file/${formSlug}`;
}

/** "Line 4a", but "Part I" and "Employers Only" — the form's own wording.
 *  Prefixing everything with "Line" produced "Line Employers Only" on the
 *  page, which is nobody's idea of a line. */
export function lineLabel(line: string): string {
  return /^\d/.test(line) ? `Line ${line}` : line;
}

export function formTitle(slug: string): string {
  return US_FORMS.find((f) => f.slug === slug)?.short ?? slug;
}
