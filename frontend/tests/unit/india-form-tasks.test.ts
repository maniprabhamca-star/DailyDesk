import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { FORM_TASKS, US_TASKS, formFor, type FormTask } from '@/lib/form-tasks';
import { INDIA_TASKS } from '@/lib/india-form-tasks';
import { INDIA_FORMS } from '@/lib/india-forms';
import { adviceBreaches } from './_advice-vocabulary';

// The India half of the form finder (Phase 3 ship 3).
//
// Everything in tests/unit/form-tasks.test.ts already covers these tasks —
// that is the whole reason both halves live in one FORM_TASKS array. This file
// is only the rules that are true of India and not of the US, and there are
// three that matter:
//
//  1. NO HARD DATES. Indian filing dates move every year and are extended more
//     often than not. lib/india-forms.ts has refused to state one since it was
//     written; a task page composed from those forms that then states one in
//     its own copy would undo it.
//  2. NO PACKET. The Pro packet pre-fills fillable PDFs. These are portal
//     filings. Both the route and the CTA have to be absent, and both are
//     checked here, because the failure mode is a paid upgrade wall in front
//     of something that could not work if it were bought.
//  3. EVERY ROW SAYS HOW IT IS FILED. It is the column that replaces the US
//     rows' measured revision strip, and it carries the fact that makes these
//     pages worth having: whether the reader fills this in at all.

const src = (p: string) => readFileSync(join(process.cwd(), p), 'utf8');

const INDIA_ROWS = INDIA_TASKS.flatMap((t) => t.forms.map((f) => ({ task: t.slug, f })));

describe('India tasks — shape', () => {
  it('is a non-empty set, all marked india, and all inside FORM_TASKS', () => {
    expect(INDIA_TASKS.length).toBeGreaterThan(0);
    for (const t of INDIA_TASKS) expect(t.region, t.slug).toBe('india');
    for (const t of INDIA_TASKS) expect(FORM_TASKS).toContain(t);
  });

  it('the two halves are disjoint and together make the whole', () => {
    expect(US_TASKS.length + INDIA_TASKS.length).toBe(FORM_TASKS.length);
    const us = new Set(US_TASKS.map((t) => t.slug));
    for (const t of INDIA_TASKS) expect(us.has(t.slug), t.slug).toBe(false);
  });

  it('every US task is marked us — the region is never left to a default', () => {
    for (const t of US_TASKS) expect(t.region, t.slug).toBe('us');
  });

  it('every row in an India task names the india library and resolves', () => {
    for (const { task, f } of INDIA_ROWS) {
      expect(f.library, `${task} → ${f.slug}`).toBe('india');
      const resolved = formFor(f);
      expect(resolved?.slug, `${task} → ${f.slug}`).toBe(f.slug);
      expect(resolved?.href, `${task} → ${f.slug}`).toBe(`/india-forms/${f.slug}`);
    }
  });
});

describe('India tasks — ⚠ how it is filed', () => {
  // The whole point of the column. "Issued to you", "built about you", "filed
  // by you on the portal" are three different answers to the question somebody
  // actually arrived with, and an India row without one is a row that has
  // quietly become a US row with its revision strip missing.
  it('every India row says how it is filed', () => {
    for (const { task, f } of INDIA_ROWS) {
      expect(f.howFiled, `${task} → ${f.slug} has no howFiled`).toBeTruthy();
      expect((f.howFiled ?? '').length, `${task} → ${f.slug}`).toBeGreaterThan(20);
    }
  });

  it('no US row carries one — it would print nowhere and mean nothing', () => {
    for (const t of US_TASKS) {
      for (const f of t.forms) expect(f.howFiled, `${t.slug} → ${f.slug}`).toBeUndefined();
    }
  });

  // The resolver is what the page branches on, and these are the two facts it
  // must get right for the branch to be honest.
  it('no India form is treated as fetchable, and none carries a measured version', () => {
    for (const { task, f } of INDIA_ROWS) {
      const r = formFor(f)!;
      expect(r.fillable, `${task} → ${f.slug}`).toBe(false);
      expect(r.version, `${task} → ${f.slug}`).toBeUndefined();
    }
  });

  it('every US form stays fetchable and keeps its version strip', () => {
    for (const t of US_TASKS) {
      for (const f of t.forms) {
        const r = formFor(f)!;
        expect(r.fillable, `${t.slug} → ${f.slug}`).toBe(true);
        expect(r.version?.value, `${t.slug} → ${f.slug}`).toBeTruthy();
      }
    }
  });
});

describe('India tasks — ⚠⚠ no hard dates', () => {
  // The same rule india-forms.test.ts applies to the form pages, applied to the
  // task copy composed from them. Both date orders, because the US no-advice
  // guard already taught us that a regex covering one phrasing is not a guard:
  // "15 April" and "April 15" are the same claim.
  const HARD_DATE =
    /\b(\d{1,2})(st|nd|rd|th)?\s+(january|february|march|april|may|june|july|august|september|october|november|december)\b|\b(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{1,2})(st|nd|rd|th)?\b/i;

  const copyOf = (t: FormTask) => {
    const parts = [t.title, t.audience, t.what, t.order, t.notCovered, t.gotcha, ...t.aka];
    if (t.seoTitle) parts.push(t.seoTitle);
    for (const f of t.forms) {
      parts.push(f.role, f.filedBy, f.goesTo);
      if (f.condition) parts.push(f.condition);
      if (f.howFiled) parts.push(f.howFiled);
    }
    return parts;
  };

  it('no India task copy names a calendar date', () => {
    for (const t of INDIA_TASKS) {
      for (const s of copyOf(t)) {
        expect(HARD_DATE.test(s), `${t.slug}: "${s.slice(0, 80)}…" names a date`).toBe(false);
      }
    }
  });

  // Proof the regex bites, in both orders. A date guard nobody has watched fail
  // is a comment.
  it('the date guard catches both orders', () => {
    expect(HARD_DATE.test('due by 31 July each year')).toBe(true);
    expect(HARD_DATE.test('due by July 31 each year')).toBe(true);
    expect(HARD_DATE.test('on dates notified each year')).toBe(false);
  });

  it('no India task copy uses the vocabulary of a requirement', () => {
    const hits = adviceBreaches(INDIA_TASKS.flatMap(copyOf));
    expect(hits, `\n  ${hits.join('\n  ')}\n`).toEqual([]);
  });
});

describe('India tasks — ⚠ no packet', () => {
  // Two halves of the same promise, checked from two directions: the route is
  // not generated, and the button is not rendered. Either one alone leaves the
  // other free to drift back.
  it('the packet route is generated for US tasks only', () => {
    const page = src('app/forms/[task]/packet/page.tsx');
    expect(page).toContain("FORM_TASKS.filter((t) => t.region === 'us')");
    expect(page).toContain('PACKET_TASKS.map');
    // And it refuses an India slug at runtime too, because dynamicParams would
    // otherwise render the route on demand for one.
    expect(page).toContain("t.region !== 'us'");
  });

  it('the task page only offers the packet to a US task', () => {
    const page = src('app/forms/[task]/page.tsx');
    expect(page).toContain("t.region === 'us' && t.forms.length > 1");
  });

  it('no India task is in the packet map table', async () => {
    const { PACKET_MAPS } = await import('@/lib/form-packet');
    const indiaSlugs = new Set(INDIA_TASKS.map((t) => t.slug));
    for (const m of PACKET_MAPS) expect(indiaSlugs.has(m.taskSlug), m.taskSlug).toBe(false);
  });
});

describe('India tasks — reachable', () => {
  it('each one is in the sitemap, via the shared task list', () => {
    const sitemap = src('app/sitemap.ts');
    expect(sitemap).toMatch(/FORM_TASKS/);
  });

  it('each one is in the ⌘K / search index', () => {
    const route = src('app/forms-api/index/route.ts');
    expect(route).toMatch(/FORM_TASKS/);
  });

  it('the hub lists both halves separately rather than interleaved', () => {
    const hub = src('app/forms/page.tsx');
    expect(hub).toContain("t.region === 'india'");
    expect(hub).toContain('TASK_GROUPS');
  });

  it('an India form page links back to the tasks it appears in', () => {
    const page = src('app/india-forms/[form]/page.tsx');
    expect(page).toContain("tasksForForm(f.slug, 'india')");
  });
});

describe('India tasks — coverage', () => {
  // Same gate as the US half: adding a form to the India library without
  // placing it in a task fails here, with the form named.
  it('every India form appears in at least one India task', () => {
    const placed = new Set(INDIA_ROWS.map((r) => r.f.slug));
    const orphans = INDIA_FORMS.filter((f) => !placed.has(f.slug)).map((f) => f.short);
    expect(orphans, `India forms in no task: ${orphans.join(', ')}`).toEqual([]);
  });

  it('the sets are the sizes they claim, derived not typed', () => {
    for (const t of INDIA_TASKS) {
      expect(t.forms.length, t.slug).toBeGreaterThan(0);
      const slugs = t.forms.map((f) => f.slug);
      expect(new Set(slugs).size, t.slug).toBe(slugs.length);
    }
  });
});
