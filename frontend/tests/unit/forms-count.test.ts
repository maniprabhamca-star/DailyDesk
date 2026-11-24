import { describe, it, expect } from 'vitest';
import { US_FORMS } from '@/lib/us-forms';
import { INDIA_FORMS } from '@/lib/india-forms';
import { US_FORM_COUNT, INDIA_FORM_COUNT, FORM_COUNT, FORM_AUTHORITY_COUNT } from '@/lib/forms-count';

// lib/forms-count.ts holds the library sizes as plain numbers so that /pricing
// — a client component — can state "62 forms" without shipping ~1,300 lines of
// form data to every visitor comparing plans.
//
// Typed numbers go stale silently, and a stale number on a pricing page is a
// claim we cannot support. So this file IS the derivation: it recomputes each
// one from the real catalogues. Adding a form without updating forms-count.ts
// fails here, loudly, with the right answer in the message.

describe('forms-count stays equal to the catalogues it describes', () => {
  it('counts the US library', () => {
    expect(
      US_FORM_COUNT,
      `US_FORM_COUNT is ${US_FORM_COUNT} but lib/us-forms.ts has ${US_FORMS.length}. Set it to ${US_FORMS.length}.`,
    ).toBe(US_FORMS.length);
  });

  it('counts the India library', () => {
    expect(
      INDIA_FORM_COUNT,
      `INDIA_FORM_COUNT is ${INDIA_FORM_COUNT} but lib/india-forms.ts has ${INDIA_FORMS.length}. Set it to ${INDIA_FORMS.length}.`,
    ).toBe(INDIA_FORMS.length);
  });

  it('counts the distinct issuing authorities across both', () => {
    // Derived the same way app/forms/page.tsx derives it, so the hub and the
    // pricing page can never print two different numbers for one thing.
    const authorities = new Set([
      ...US_FORMS.map((f) => f.authority),
      ...INDIA_FORMS.map((f) => f.authority),
    ]);
    expect(
      FORM_AUTHORITY_COUNT,
      `FORM_AUTHORITY_COUNT is ${FORM_AUTHORITY_COUNT} but the libraries name ${authorities.size} authorities. Set it to ${authorities.size}.`,
    ).toBe(authorities.size);
  });

  it('adds up', () => {
    expect(FORM_COUNT).toBe(US_FORMS.length + INDIA_FORMS.length);
  });
});
