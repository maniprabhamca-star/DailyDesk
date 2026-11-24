import { describe, it, expect } from 'vitest';
import { adviceBreaches } from './_advice-vocabulary';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import {
  FORM_TASKS,
  TASK_COUNT,
  getFormTask,
  formFor,
  tasksForForm,
  authoritiesFor,
  reviewedOnLabel,
  APPLIES_LABEL,
  listJoin,
} from '@/lib/form-tasks';
import { US_FORMS } from '@/lib/us-forms';

// The contract for the form finder (Phase 3 ship 1).
//
// Three of these are not style checks. They are the only thing standing between
// a useful page and a page that practises law and tax without a licence:
//
//  1. the advice vocabulary cannot appear in task copy;
//  2. anything not marked 'always' must say when it applies;
//  3. what the page leaves out is mandatory, not optional.
//
// Everything a task page prints is composed from facts already verified at
// source per form. These tests make that composition the only thing possible.
// See docs/designs/forms-finder-phase3.md §3.

const ALL_COPY = (() => {
  // Every reader-facing string on a task page, in one haystack. Field names and
  // slugs are excluded on purpose — `applies: 'always'` is machine vocabulary,
  // not prose, and a slug is a URL.
  const parts: string[] = [];
  for (const t of FORM_TASKS) {
    parts.push(t.title, t.audience, t.what, t.order, t.notCovered, t.gotcha, ...t.aka);
    if (t.seoTitle) parts.push(t.seoTitle);
    for (const tf of t.forms) {
      parts.push(tf.role, tf.filedBy, tf.goesTo);
      if (tf.condition) parts.push(tf.condition);
    }
  }
  return parts;
})();

describe('form tasks — shape', () => {
  it('has tasks, and TASK_COUNT is derived rather than typed', () => {
    expect(FORM_TASKS.length).toBeGreaterThan(0);
    expect(TASK_COUNT).toBe(FORM_TASKS.length);
  });

  it('every slug is unique, lower-case and URL-safe', () => {
    const slugs = FORM_TASKS.map((t) => t.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const s of slugs) expect(s).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
  });

  it('getFormTask resolves every slug and rejects an unknown one', () => {
    for (const t of FORM_TASKS) expect(getFormTask(t.slug)?.title).toBe(t.title);
    expect(getFormTask('not-a-task')).toBeUndefined();
  });

  it('every task has at least one form, and no form repeats inside a task', () => {
    for (const t of FORM_TASKS) {
      expect(t.forms.length, t.slug).toBeGreaterThan(0);
      const slugs = t.forms.map((f) => f.slug);
      expect(new Set(slugs).size, t.slug).toBe(slugs.length);
    }
  });
});

describe('form tasks — references resolve', () => {
  // The cheap guard that makes deleting a form a build failure rather than a
  // dead row on a page nobody is looking at.
  it('every referenced form exists in US_FORMS', () => {
    const known = new Set(US_FORMS.map((f) => f.slug));
    for (const t of FORM_TASKS) {
      for (const tf of t.forms) {
        expect(known.has(tf.slug), `${t.slug} → ${tf.slug}`).toBe(true);
      }
    }
  });

  it('formFor returns the real form for every reference', () => {
    for (const t of FORM_TASKS) {
      for (const tf of t.forms) expect(formFor(tf)?.slug, `${t.slug} → ${tf.slug}`).toBe(tf.slug);
    }
  });

  // ⭐ This turns "is the library reachable from the UI" from an opinion into a
  // gate. Adding a form without placing it in a task fails here, with the form
  // named — which is the moment to decide whether it belongs in an existing
  // task or needs a new one.
  it('every US form appears in at least one task', () => {
    const placed = new Set(FORM_TASKS.flatMap((t) => t.forms.map((f) => f.slug)));
    const orphans = US_FORMS.filter((f) => !placed.has(f.slug)).map((f) => f.short);
    expect(orphans, `forms in no task: ${orphans.join(', ')}`).toEqual([]);
  });

  it('tasksForForm is the inverse of the task → form mapping', () => {
    for (const f of US_FORMS) {
      const back = tasksForForm(f.slug).map((t) => t.slug).sort();
      const forward = FORM_TASKS.filter((t) => t.forms.some((tf) => tf.slug === f.slug))
        .map((t) => t.slug)
        .sort();
      expect(back).toEqual(forward);
    }
    expect(tasksForForm('not-a-form')).toEqual([]);
  });

  // The page renders this list inside two sentences, so a bare comma join
  // reads as a truncated list in one and a verbless sentence in the other.
  // That shipped to the local preview before being caught by reading it.
  it('listJoin produces a sentence, not a comma-separated list', () => {
    expect(listJoin([])).toBe('');
    expect(listJoin(['IRS'])).toBe('IRS');
    expect(listJoin(['IRS', 'USCIS'])).toBe('IRS and USCIS');
    expect(listJoin(['IRS', 'USCIS', 'SSA'])).toBe('IRS, USCIS and SSA');
    expect(listJoin(['IRS', 'USCIS'], 'or')).toBe('IRS or USCIS');
  });

  it('authoritiesFor lists each authority once, in form order', () => {
    for (const t of FORM_TASKS) {
      const a = authoritiesFor(t);
      expect(a.length, t.slug).toBeGreaterThan(0);
      expect(new Set(a).size, t.slug).toBe(a.length);
    }
  });
});

describe('form tasks — ⚠ the advice boundary', () => {
  // A task page states which forms are involved and who fills them in. It never
  // tells a reader what they have to do, because that depends on facts a page
  // cannot see — and because we are a tool, not a preparer.
  //
  // The list itself moved to _advice-vocabulary.ts when the Pro packet began
  // putting its own copy in front of readers: two suites, one rule, one list.

  it('no task copy uses the vocabulary of a requirement or an instruction', () => {
    const hits = adviceBreaches(ALL_COPY);
    expect(hits, `\n  ${hits.join('\n  ')}\n`).toEqual([]);
  });

  // The union itself cannot express "required", so this guards against someone
  // widening it rather than against the data.
  it('the applies vocabulary is exactly the three observational values', () => {
    expect(Object.keys(APPLIES_LABEL).sort()).toEqual(['always', 'sometimes', 'usually']);
    for (const t of FORM_TASKS) {
      for (const tf of t.forms) {
        expect(['always', 'usually', 'sometimes'], `${t.slug} → ${tf.slug}`).toContain(tf.applies);
      }
    }
  });

  it('anything not "always" says when it applies', () => {
    for (const t of FORM_TASKS) {
      for (const tf of t.forms) {
        if (tf.applies === 'always') continue;
        expect(tf.condition, `${t.slug} → ${tf.slug} is "${tf.applies}" with no condition`).toBeTruthy();
        expect((tf.condition ?? '').length, `${t.slug} → ${tf.slug}`).toBeGreaterThan(25);
      }
    }
  });

  it('an "always" form carries no condition, which would contradict it', () => {
    for (const t of FORM_TASKS) {
      for (const tf of t.forms) {
        if (tf.applies === 'always') expect(tf.condition, `${t.slug} → ${tf.slug}`).toBeUndefined();
      }
    }
  });

  it('every task says what it does not cover, and disclaims advice', () => {
    for (const t of FORM_TASKS) {
      expect(t.notCovered.length, t.slug).toBeGreaterThan(120);
      expect(t.notCovered.toLowerCase(), t.slug).toMatch(/advice/);
    }
  });

  it('every task names the mistake the set produces', () => {
    for (const t of FORM_TASKS) expect(t.gotcha.length, t.slug).toBeGreaterThan(80);
  });
});

describe('form tasks — ⚠ two clocks', () => {
  // The weekly job moves the forms' CHECKED_ON. It cannot see whether a SET is
  // still right, so a task carries its own human-moved date. If these ever
  // merge, a clean drifts=0 run starts implying something it never checked.
  it('reviewedOn is a real date, not in the future', () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    for (const t of FORM_TASKS) {
      expect(t.reviewedOn, t.slug).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      const [y, m, d] = t.reviewedOn.split('-').map(Number);
      const when = new Date(y, m - 1, d);
      expect(when.getFullYear(), t.slug).toBe(y);
      expect(when.getMonth(), t.slug).toBe(m - 1);
      expect(when.getDate(), t.slug).toBe(d);
      expect(when.getTime(), `${t.slug} reviewedOn is in the future`).toBeLessThanOrEqual(today.getTime());
    }
  });

  // The timezone trap that already shipped once on CHECKED_ON: a bare
  // YYYY-MM-DD parses as UTC midnight and formats as the day before for anyone
  // west of UTC. reviewedOnLabel builds from the parts for that reason.
  it('reviewedOnLabel does not drift a day west of UTC', () => {
    expect(reviewedOnLabel('2026-11-24')).toBe('November 24, 2026');
    expect(reviewedOnLabel('2026-01-01')).toBe('January 1, 2026');
    expect(reviewedOnLabel('2026-12-31')).toBe('December 31, 2026');
  });
});

describe('form tasks — ⚠ route namespace', () => {
  // /forms/<task> shares a segment with nothing today, but two pages competing
  // for one URL is resolved silently by the router and the loser is invisible.
  const RESERVED = ['us-forms', 'india-forms', 'forms', 'forms-api', 'api', 'packet', 'index'];

  it('no task slug collides with a reserved segment', () => {
    for (const t of FORM_TASKS) expect(RESERVED, t.slug).not.toContain(t.slug);
  });

  it('no task slug collides with a form slug', () => {
    const forms = new Set(US_FORMS.map((f) => f.slug));
    for (const t of FORM_TASKS) expect(forms.has(t.slug), t.slug).toBe(false);
  });

  it('no task slug collides with a real child route under app/forms', () => {
    const dir = join(process.cwd(), 'app', 'forms');
    const children = readdirSync(dir)
      .filter((n) => statSync(join(dir, n)).isDirectory())
      .filter((n) => !n.startsWith('[')); // the dynamic segment itself
    for (const t of FORM_TASKS) expect(children, t.slug).not.toContain(t.slug);
  });

  it('is in the sitemap', () => {
    const src = readFileSync(join(process.cwd(), 'app', 'sitemap.ts'), 'utf8');
    expect(src).toMatch(/FORM_TASKS/);
    expect(src).toMatch(/formTaskRoutes/);
    // Generated AND spread. A route list built and never returned is the
    // quietest way to leave pages out of the sitemap.
    expect(src).toMatch(/return \[[^\]]*\.\.\.formTaskRoutes/);
  });

  it('is in the ⌘K search index', () => {
    const src = readFileSync(join(process.cwd(), 'app', 'forms-api', 'index', 'route.ts'), 'utf8');
    expect(src).toMatch(/FORM_TASKS/);
  });
});

describe('form tasks — metadata budget', () => {
  it('every title fits the 60-character budget, with seoTitle where it does not', () => {
    const SUFFIX = ' — the forms involved | DiemDesk'.length;
    for (const t of FORM_TASKS) {
      const used = (t.seoTitle ?? t.title).length + SUFFIX;
      expect(used, `${t.slug}: title is ${used} chars — add a shorter seoTitle`).toBeLessThanOrEqual(72);
    }
  });

  it('seoTitle, where present, is shorter than the title it replaces', () => {
    for (const t of FORM_TASKS) {
      if (t.seoTitle) expect(t.seoTitle.length, t.slug).toBeLessThan(t.title.length);
    }
  });

  it('every task has search phrasings for the palette', () => {
    for (const t of FORM_TASKS) {
      expect(t.aka.length, t.slug).toBeGreaterThanOrEqual(3);
      for (const a of t.aka) expect(a, t.slug).toBe(a.toLowerCase());
    }
  });
});
