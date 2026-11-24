import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { adviceBreaches } from './_advice-vocabulary';
import {
  PACKET_MAPS,
  lineLabel,
  SHARED_LABELS,
  SKIP,
  type ActualField,
  type PacketMap,
  type SharedDetails,
  type SharedKey,
  blankFormUrl,
  groupSkipped,
  groupWrites,
  keysUsedBy,
  mapFor,
  packetFor,
  planFill,
  tasksWithPrefill,
} from '@/lib/form-packet';
import { FORM_TASKS } from '@/lib/form-tasks';
import { US_FORMS } from '@/lib/us-forms';

/** The field table a real PDF would report, built from a map so the happy path
 *  is "the form is exactly what we authored against". */
function actualFor(map: PacketMap): Map<string, ActualField> {
  return new Map(map.fields.map((f) => [f.name, { maxLength: f.maxLength }]));
}

const W9 = mapFor('get-paid-as-a-contractor', 'form-w-9')!;
const SS4 = mapFor('get-paid-as-a-contractor', 'form-ss-4')!;
const W4 = mapFor('hire-your-first-employee', 'form-w-4')!;
const F8822 = mapFor('change-your-address-with-the-irs', 'form-8822')!;

const ME: SharedDetails = {
  firstName: 'Ada M',
  lastName: 'Lovelace',
  businessName: 'Analytical Engines',
  street: '12 Dover Street',
  cityStateZip: 'Austin, TX 78701',
  ssn: '123-45-6789',
};

describe('packet maps — shape', () => {
  it('every map points at a task that exists', () => {
    const slugs = new Set(FORM_TASKS.map((t) => t.slug));
    for (const m of PACKET_MAPS) expect(slugs, m.taskSlug).toContain(m.taskSlug);
  });

  it('every map points at a form that exists', () => {
    const slugs = new Set(US_FORMS.map((f) => f.slug));
    for (const m of PACKET_MAPS) expect(slugs, m.formSlug).toContain(m.formSlug);
  });

  // The strong one: a map for a form the task does not list would pre-fill a
  // document the reader was never shown.
  it('every map points at a form that is actually in that task', () => {
    for (const m of PACKET_MAPS) {
      const task = FORM_TASKS.find((t) => t.slug === m.taskSlug)!;
      expect(task.forms.map((f) => f.slug), `${m.taskSlug} → ${m.formSlug}`).toContain(m.formSlug);
    }
  });

  it('no task/form pair is mapped twice', () => {
    const keys = PACKET_MAPS.map((m) => `${m.taskSlug}:${m.formSlug}`);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('no box is written twice within one map', () => {
    for (const m of PACKET_MAPS) {
      const names = m.fields.map((f) => f.name);
      expect(new Set(names).size, `${m.taskSlug} → ${m.formSlug}`).toBe(names.length);
    }
  });

  it('every map writes at least one box', () => {
    for (const m of PACKET_MAPS) expect(m.fields.length, `${m.taskSlug} → ${m.formSlug}`).toBeGreaterThan(0);
  });

  it('every field name is fully qualified, the way the agency PDF names it', () => {
    for (const m of PACKET_MAPS) {
      for (const f of m.fields) {
        expect(f.name, `${m.formSlug} ${f.line}`).toMatch(/^topmostSubform\[0\]\.Page\d+\[0\]\./);
      }
    }
  });

  it('every unmapped note says which line and why', () => {
    for (const m of PACKET_MAPS) {
      for (const u of m.unmapped ?? []) {
        expect(u.line.length).toBeGreaterThan(0);
        expect(u.label.length).toBeGreaterThan(0);
        expect(u.why.length, `${m.formSlug} ${u.line}`).toBeGreaterThan(20);
      }
    }
  });
});

describe('packet maps — ⚠ the shape of a taxpayer number', () => {
  // A comb box holds one digit per printed cell. If a slice is wider than the
  // box, the number is silently truncated into a federal form.
  it('a sliced box is exactly as wide as its slice', () => {
    for (const m of PACKET_MAPS) {
      for (const f of m.fields) {
        if (!f.digits) continue;
        expect(f.maxLength, `${m.formSlug} ${f.name}`).toBe(f.digits[1] - f.digits[0]);
      }
    }
  });

  it('the slices of one number cover all nine digits exactly once, in order', () => {
    for (const m of PACKET_MAPS) {
      for (const source of ['ssn', 'ein'] as const) {
        const parts = m.fields.filter((f) => f.source === source && f.digits);
        if (parts.length === 0) continue;
        const covered: number[] = [];
        for (const p of parts) for (let i = p.digits![0]; i < p.digits![1]; i++) covered.push(i);
        expect(covered, `${m.formSlug} ${source}`).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8]);
      }
    }
  });

  it('a dashed box is wide enough for the dashes', () => {
    for (const m of PACKET_MAPS) {
      for (const f of m.fields) {
        if (f.as === 'ssn-dashed') expect(f.maxLength, `${m.formSlug} ${f.name}`).toBeGreaterThanOrEqual(11);
        if (f.as === 'ein-dashed') expect(f.maxLength, `${m.formSlug} ${f.name}`).toBeGreaterThanOrEqual(10);
      }
    }
  });
});

describe('packet maps — ⚠ whose details these are', () => {
  // The safety property of the whole feature, pinned as data.
  //
  // A map is authored for a (task, form) PAIR, never for a form, because the
  // same form means different things in different jobs: on the W-4 inside
  // "hire your first employee" the name and the taxpayer number belong to the
  // person being hired, and only the block at the bottom is the employer's.
  //
  // So the safe default is no pre-fill, and this list is the deliberate
  // exception. Adding a line here means someone read `filedBy` on that entry
  // and confirmed the details in those boxes are the reader's own.
  it('exactly these task/form pairs pre-fill anything', () => {
    const pairs = PACKET_MAPS.map((m) => `${m.taskSlug}:${m.formSlug}`).sort();
    expect(pairs).toEqual(
      [
        'change-your-address-with-the-irs:form-8822',
        'get-a-us-taxpayer-number:form-ss-4',
        'get-paid-as-a-contractor:form-ss-4',
        'get-paid-as-a-contractor:form-w-9',
        'hire-your-first-employee:form-ss-4',
        'hire-your-first-employee:form-w-4',
        'set-up-an-irs-payment-plan:form-9465',
      ].sort(),
    );
  });

  // The specific trap this feature could most plausibly fall into.
  it('the W-4 in "hire your first employee" writes nothing personal', () => {
    for (const f of W4.fields) {
      expect(f.source, `${f.name} ${f.label}`).not.toBe('ssn');
      expect(f.source, `${f.name} ${f.label}`).not.toBe('firstName');
      expect(f.source, `${f.name} ${f.label}`).not.toBe('lastName');
      expect(f.line, `${f.name}`).toContain('Employers Only');
    }
  });

  // 8822 has two address boxes — 6a is where you used to live, 7 is where you
  // live now — and a packet cannot know which the reader meant.
  it('the 8822 writes no address at all', () => {
    for (const f of F8822.fields) {
      expect(['street', 'cityStateZip', 'addressOneLine', 'businessBlock'], f.name).not.toContain(f.source);
    }
    expect(F8822.unmapped?.some((u) => /6a/.test(u.line))).toBe(true);
  });
});

describe('packet maps — ⚠ two clocks', () => {
  // The weekly robot can see that a form changed. It cannot see that a box now
  // means something else, because that is a fact about ink beside a rectangle.
  // Only a person who rendered the form and looked moves this date.
  it('every map records the day a person last read the form', () => {
    const today = new Date().toISOString().slice(0, 10);
    for (const m of PACKET_MAPS) {
      expect(m.verifiedOn, m.formSlug).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(Number.isNaN(Date.parse(m.verifiedOn)), m.formSlug).toBe(false);
      expect(m.verifiedOn <= today, `${m.formSlug} is verified in the future`).toBe(true);
    }
  });

  it('the live verifier exists and is wired to a script', () => {
    const root = join(__dirname, '..', '..');
    const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
    expect(Object.keys(pkg.scripts)).toContain('verify:packet-maps');
    expect(() => readFileSync(join(root, 'scripts', 'verify-packet-maps.mjs'), 'utf8')).not.toThrow();
  });

  // A verifier nobody runs is a verifier nobody has.
  it('the weekly job runs it, and re-runs it when the maps change', () => {
    const wf = readFileSync(join(__dirname, '..', '..', '..', '.github', 'workflows', 'forms-sync.yml'), 'utf8');
    expect(wf).toContain('verify:packet-maps');
    expect(wf).toContain('frontend/lib/form-packet.ts');
  });
});

describe('packet maps — ⚠ the advice boundary', () => {
  it('no packet copy uses the vocabulary of a requirement or an instruction', () => {
    const copy: string[] = [...Object.values(SKIP), ...Object.values(SHARED_LABELS)];
    for (const m of PACKET_MAPS) {
      for (const f of m.fields) copy.push(f.label, f.line, f.note ?? '');
      for (const u of m.unmapped ?? []) copy.push(u.label, u.why);
    }
    const hits = adviceBreaches(copy.filter(Boolean));
    expect(hits, `\n  ${hits.join('\n  ')}\n`).toEqual([]);
  });
});

describe('planFill — the happy path', () => {
  it('fills the W-9 from one set of details', () => {
    const plan = planFill(W9, ME, actualFor(W9));
    const byName = new Map(plan.writes.map((w) => [w.name, w.value]));
    expect(byName.get('topmostSubform[0].Page1[0].f1_01[0]')).toBe('Ada M Lovelace');
    expect(byName.get('topmostSubform[0].Page1[0].f1_02[0]')).toBe('Analytical Engines');
    expect(byName.get('topmostSubform[0].Page1[0].Address_ReadOrder[0].f1_07[0]')).toBe('12 Dover Street');
    expect(byName.get('topmostSubform[0].Page1[0].Address_ReadOrder[0].f1_08[0]')).toBe('Austin, TX 78701');
  });

  it('slices a social security number across the printed cells', () => {
    const plan = planFill(W9, ME, actualFor(W9));
    const byName = new Map(plan.writes.map((w) => [w.name, w.value]));
    expect(byName.get('topmostSubform[0].Page1[0].f1_11[0]')).toBe('123');
    expect(byName.get('topmostSubform[0].Page1[0].f1_12[0]')).toBe('45');
    expect(byName.get('topmostSubform[0].Page1[0].f1_13[0]')).toBe('6789');
  });

  it('slices an employer number two-then-seven', () => {
    const plan = planFill(W9, { ein: '12-3456789' }, actualFor(W9));
    const byName = new Map(plan.writes.map((w) => [w.name, w.value]));
    expect(byName.get('topmostSubform[0].Page1[0].f1_14[0]')).toBe('12');
    expect(byName.get('topmostSubform[0].Page1[0].f1_15[0]')).toBe('3456789');
  });

  it('writes a dashed number where the box takes one string', () => {
    const plan = planFill(SS4, ME, actualFor(SS4));
    const byName = new Map(plan.writes.map((w) => [w.name, w.value]));
    expect(byName.get('topmostSubform[0].Page1[0].f1_11[0]')).toBe('123-45-6789');
  });

  it('builds the employer block from the business name and address', () => {
    const plan = planFill(W4, { ...ME, ein: '98-7654321' }, actualFor(W4));
    const byName = new Map(plan.writes.map((w) => [w.name, w.value]));
    expect(byName.get('topmostSubform[0].Page1[0].f1_12[0]')).toBe('Analytical Engines, 12 Dover Street, Austin, TX 78701');
    expect(byName.get('topmostSubform[0].Page1[0].f1_14[0]')).toBe('98-7654321');
  });

  it('falls back to the person’s own name when there is no business name', () => {
    const plan = planFill(W4, { firstName: 'Ada M', lastName: 'Lovelace', street: '12 Dover Street', cityStateZip: 'Austin, TX 78701' }, actualFor(W4));
    const block = plan.writes.find((w) => w.name.endsWith('f1_12[0]'));
    expect(block?.value).toBe('Ada M Lovelace, 12 Dover Street, Austin, TX 78701');
  });

  it('carries the note through to whoever is reading the page', () => {
    const plan = planFill(SS4, ME, actualFor(SS4));
    const line1 = plan.writes.find((w) => w.line === '1');
    expect(line1?.note).toMatch(/sole proprietor/);
  });
});

describe('planFill — ⚠ it refuses rather than guesses', () => {
  it('writes nothing into a box the agency no longer publishes', () => {
    const actual = actualFor(W9);
    actual.delete('topmostSubform[0].Page1[0].f1_01[0]');
    const plan = planFill(W9, ME, actual);
    expect(plan.writes.some((w) => w.name.endsWith('f1_01[0]'))).toBe(false);
    expect(plan.skipped.find((s) => s.name.endsWith('f1_01[0]'))?.why).toBe(SKIP.missing);
  });

  it('writes nothing into a box that changed size', () => {
    const actual = actualFor(W9);
    actual.set('topmostSubform[0].Page1[0].f1_12[0]', { maxLength: 9 });
    const plan = planFill(W9, ME, actual);
    expect(plan.writes.some((w) => w.name.endsWith('f1_12[0]'))).toBe(false);
    expect(plan.skipped.find((s) => s.name.endsWith('f1_12[0]'))?.why).toBe(SKIP.resized);
  });

  // A box with no length limit and a box limited to 11 are different boxes.
  it('treats "no limit" and "some limit" as a mismatch, both ways round', () => {
    const loosened = actualFor(SS4);
    loosened.set('topmostSubform[0].Page1[0].f1_11[0]', { maxLength: null });
    expect(planFill(SS4, ME, loosened).skipped.find((s) => s.name.endsWith('f1_11[0]'))?.why).toBe(SKIP.resized);

    const tightened = actualFor(SS4);
    tightened.set('topmostSubform[0].Page1[0].f1_3[0]', { maxLength: 20 });
    expect(planFill(SS4, ME, tightened).skipped.find((s) => s.name.endsWith('f1_3[0]'))?.why).toBe(SKIP.resized);
  });

  it('refuses a taxpayer number that is not nine digits', () => {
    const plan = planFill(W9, { ...ME, ssn: '123-45-678' }, actualFor(W9));
    const tin = plan.skipped.filter((s) => s.name.match(/f1_1[123]\[0\]$/));
    expect(tin).toHaveLength(3);
    for (const s of tin) expect(s.why).toBe(SKIP.badNumber);
  });

  it('does not call an empty detail a bad number', () => {
    const plan = planFill(W9, { firstName: 'Ada' }, actualFor(W9));
    expect(plan.skipped.find((s) => s.name.endsWith('f1_11[0]'))?.why).toBe(SKIP.empty);
  });

  // The W-9 takes a social security number OR an employer number. Writing both
  // produces an invalid form; choosing between them is a tax judgement.
  it('writes neither number when the reader has given both', () => {
    const plan = planFill(W9, { ...ME, ein: '98-7654321' }, actualFor(W9));
    const tin = plan.skipped.filter((s) => s.line === 'Part I');
    expect(tin).toHaveLength(5);
    for (const s of tin) expect(s.why).toBe(SKIP.conflict);
    expect(plan.writes.some((w) => w.line === 'Part I')).toBe(false);
    // and the rest of the form is still filled
    expect(plan.writes.some((w) => w.line === '1')).toBe(true);
  });

  it('writes one number happily when only one was given', () => {
    const ssnOnly = planFill(W9, ME, actualFor(W9));
    expect(ssnOnly.writes.filter((w) => w.line === 'Part I')).toHaveLength(3);
    const einOnly = planFill(W9, { ein: '98-7654321' }, actualFor(W9));
    expect(einOnly.writes.filter((w) => w.line === 'Part I')).toHaveLength(2);
  });

  it('leaves a box alone when the value is longer than it holds', () => {
    const long = { ...ME, businessName: 'x'.repeat(40) };
    const actual = actualFor(SS4);
    actual.set('topmostSubform[0].Page1[0].f1_3[0]', { maxLength: 12 });
    // size mismatch fires first, so pin the map's own expectation instead
    const tight: PacketMap = {
      ...SS4,
      fields: SS4.fields.map((f) => (f.name.endsWith('f1_3[0]') ? { ...f, maxLength: 12 } : f)),
    };
    const plan = planFill(tight, long, actual);
    expect(plan.skipped.find((s) => s.name.endsWith('f1_3[0]'))?.why).toBe(SKIP.tooLong);
  });

  it('accounts for every box: each one is either written or explained', () => {
    for (const m of PACKET_MAPS) {
      for (const details of [ME, {}, { ...ME, ein: '98-7654321' }]) {
        const plan = planFill(m, details, actualFor(m));
        expect(plan.writes.length + plan.skipped.length, `${m.taskSlug} → ${m.formSlug}`).toBe(m.fields.length);
      }
    }
  });

  it('never writes an empty string into a box', () => {
    for (const m of PACKET_MAPS) {
      for (const w of planFill(m, ME, actualFor(m)).writes) expect(w.value.length).toBeGreaterThan(0);
    }
  });

  it('never writes more than the box holds, for any map', () => {
    const big: SharedDetails = {
      firstName: 'A'.repeat(60), lastName: 'B'.repeat(60), businessName: 'C'.repeat(60),
      street: 'D'.repeat(60), cityStateZip: 'E'.repeat(60), ssn: '123456789', ein: '987654321',
    };
    for (const m of PACKET_MAPS) {
      for (const w of planFill(m, big, actualFor(m)).writes) {
        const field = m.fields.find((f) => f.name === w.name)!;
        if (field.maxLength !== null) expect(w.value.length, w.name).toBeLessThanOrEqual(field.maxLength);
      }
    }
  });
});

describe('what a person sees, not what the PDF sees', () => {
  // The W-9 writes a taxpayer number into three printed cells. Listing three
  // rows showed the reader "123", "45", "6789" and called it a form.
  it('rejoins a number split across printed cells into one row', () => {
    const rows = groupWrites(planFill(W9, ME, actualFor(W9)).writes);
    const tin = rows.filter((r) => r.line === 'Part I');
    expect(tin).toHaveLength(1);
    expect(tin[0].value).toBe('123456789');
    expect(tin[0].boxes).toBe(3);
  });

  it('leaves an ordinary field as one row covering one box', () => {
    const rows = groupWrites(planFill(W9, ME, actualFor(W9)).writes);
    const name = rows.find((r) => r.line === '1')!;
    expect(name.value).toBe('Ada M Lovelace');
    expect(name.boxes).toBe(1);
  });

  it('keeps a note when the row covers several boxes', () => {
    const rows = groupWrites(planFill(SS4, ME, actualFor(SS4)).writes);
    expect(rows.find((r) => r.line === '1')?.note).toMatch(/sole proprietor/);
  });

  // The same refusal was printed five times, once per box.
  it('says a refusal once per line, not once per box', () => {
    const plan = planFill(W9, { ...ME, ein: '98-7654321' }, actualFor(W9));
    expect(plan.skipped.filter((s) => s.why === SKIP.conflict)).toHaveLength(5);
    const rows = groupSkipped(plan.skipped.filter((s) => s.why === SKIP.conflict));
    expect(rows).toHaveLength(2);
    expect(rows.map((r) => r.label).sort()).toEqual([
      'Employer identification number',
      'Social security number',
    ]);
  });

  it('gives every row a key of its own', () => {
    for (const m of PACKET_MAPS) {
      const plan = planFill(m, ME, actualFor(m));
      const wk = groupWrites(plan.writes).map((r) => r.key);
      const sk = groupSkipped(plan.skipped).map((r) => r.key);
      expect(new Set(wk).size).toBe(wk.length);
      expect(new Set(sk).size).toBe(sk.length);
    }
  });
});

describe('line labels', () => {
  // "Line Employers Only" was on the rendered page. A line number takes the
  // word "Line"; the form’s own section names do not.
  it('prefixes a number and leaves a name alone', () => {
    expect(lineLabel('1')).toBe('Line 1');
    expect(lineLabel('4a')).toBe('Line 4a');
    expect(lineLabel('6a and 7')).toBe('Line 6a and 7');
    expect(lineLabel('Part I')).toBe('Part I');
    expect(lineLabel('Employers Only')).toBe('Employers Only');
    expect(lineLabel('Steps 1 to 4')).toBe('Steps 1 to 4');
  });

  it('every line in every map reads correctly either way', () => {
    for (const m of PACKET_MAPS) {
      for (const f of m.fields) expect(lineLabel(f.line)).not.toMatch(/^Line [A-Z]/);
      for (const u of m.unmapped ?? []) expect(lineLabel(u.line)).not.toMatch(/^Line [A-Z]/);
    }
  });
});

describe('the packet as the reader meets it', () => {
  it('a packet lists every form in the task, in the task’s order', () => {
    for (const task of FORM_TASKS) {
      expect(packetFor(task.slug).map((p) => p.formSlug)).toEqual(task.forms.map((f) => f.slug));
    }
  });

  it('a task nobody mapped still hands over every form, just unfilled', () => {
    const unmapped = FORM_TASKS.find((t) => !tasksWithPrefill().includes(t.slug))!;
    const packet = packetFor(unmapped.slug);
    expect(packet.length).toBeGreaterThan(0);
    expect(packet.every((p) => p.map === undefined)).toBe(true);
  });

  it('an unknown task is empty rather than an exception', () => {
    expect(packetFor('no-such-task')).toEqual([]);
  });

  // Asking for a social security number that nothing in the set wants would be
  // indefensible on a page whose argument is that we do not keep anything.
  it('only asks for details the forms in that set actually use', () => {
    expect(keysUsedBy('change-your-address-with-the-irs').sort()).toEqual(['firstName', 'lastName', 'ssn'].sort());
    expect(keysUsedBy('get-paid-as-a-contractor')).toContain('ein');
    expect(keysUsedBy('no-such-task')).toEqual([]);
  });

  it('asks for nothing at all where nothing is mapped', () => {
    const unmapped = FORM_TASKS.find((t) => !tasksWithPrefill().includes(t.slug))!;
    expect(keysUsedBy(unmapped.slug)).toEqual([]);
  });

  it('every detail it can ask for has a label a person would recognise', () => {
    for (const k of Object.keys(SHARED_LABELS) as SharedKey[]) {
      expect(SHARED_LABELS[k].length).toBeGreaterThan(3);
      expect(SHARED_LABELS[k]).not.toMatch(/[_[\]]/);
    }
  });

  // Blank forms come through our own proxy, which is deliberately NOT under
  // /api/ — nginx proxies that whole prefix to Express on :4000 in production,
  // so a Next route handler there 404s on the server and nowhere else.
  it('fetches blank forms through the existing proxy, not from the agency directly', () => {
    const url = blankFormUrl('form-w-9');
    expect(url).toBe('/forms-api/file/form-w-9');
    expect(url.startsWith('/api/')).toBe(false);
  });
});

describe('where the packet lives', () => {
  const root = join(__dirname, '..', '..');
  const page = () => readFileSync(join(root, 'app', 'forms', '[task]', 'packet', 'page.tsx'), 'utf8');

  // Every US task, and deliberately no India one — an India set is portal
  // filings, so there is nothing to pre-fill. See india-form-tasks.test.ts,
  // which pins the other half of that from the data side.
  it('there is a packet page for every US task', () => {
    expect(() => page()).not.toThrow();
    expect(page()).toContain("FORM_TASKS.filter((t) => t.region === 'us')");
    expect(page()).toContain('PACKET_TASKS.map');
  });

  // A signed-in tool is not a page for a search engine, and an indexed page
  // that shows a stranger a locked panel is a worse result than no result.
  it('the packet page is noindex', () => {
    expect(page()).toMatch(/robots:\s*\{\s*index:\s*false/);
  });

  it('the packet is not in the sitemap, but the task page still is', () => {
    const sitemap = readFileSync(join(root, 'app', 'sitemap.ts'), 'utf8');
    expect(sitemap).not.toContain('/packet');
    expect(sitemap).toContain('formTaskRoutes');
  });

  // Not under /api/: nginx proxies that whole prefix to Express on :4000 in
  // production, so a Next route handler there 404s on the server and nowhere
  // else. The packet adds no route of its own — it reuses the proxy.
  it('the packet adds no new server route', () => {
    const runner = readFileSync(join(root, 'components', 'forms', 'packet-runner.tsx'), 'utf8');
    const fetches = runner.match(/fetch\((.*?)\)/g) ?? [];
    expect(fetches.length).toBeGreaterThan(0);
    for (const f of fetches) expect(f).toContain('blankFormUrl');
  });

  it('only a task with something to batch gets the button', () => {
    const taskPage = readFileSync(join(root, 'app', 'forms', '[task]', 'page.tsx'), 'utf8');
    expect(taskPage).toContain('/packet');
    expect(taskPage).toContain('t.forms.length > 1 && (');
  });
});

describe('the packet never keeps anything', () => {
  // The claim on the page is that the details live for one packet and nowhere
  // else. That is only true if nothing in the feature reaches for storage.
  it('nothing in the packet code writes to storage or posts the details', () => {
    const src = readFileSync(join(__dirname, '..', '..', 'lib', 'form-packet.ts'), 'utf8');
    for (const forbidden of ['localStorage', 'sessionStorage', 'indexedDB', 'document.cookie']) {
      expect(src, `lib/form-packet.ts reaches for ${forbidden}`).not.toContain(forbidden);
    }
  });

  it('the page that collects the details does not keep them either', () => {
    const runner = readFileSync(join(__dirname, '..', '..', 'components', 'forms', 'packet-runner.tsx'), 'utf8');
    for (const forbidden of ['localStorage', 'sessionStorage', 'indexedDB', 'document.cookie']) {
      expect(runner, `the packet runner reaches for ${forbidden}`).not.toContain(forbidden);
    }
  });

  // Everything the reader types is sent nowhere. The only request the packet
  // makes is a GET for a blank public form.
  it('nothing the reader types leaves the device', () => {
    const runner = readFileSync(join(__dirname, '..', '..', 'components', 'forms', 'packet-runner.tsx'), 'utf8');
    expect(runner).not.toMatch(/method:\s*'POST'/);
    expect(runner).not.toContain('navigator.sendBeacon');
    expect(runner).not.toContain('JSON.stringify(details');
  });
});
