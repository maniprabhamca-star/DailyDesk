// The size of the forms libraries, as numbers — for the pages that want to
// state the figure without loading the libraries themselves.
//
// Why this file exists rather than `US_FORMS.length` at the call site:
// `lib/us-forms.ts` and `lib/india-forms.ts` are ~1,300 lines of form data
// between them, and `.length` cannot be tree-shaken away — reading it drags the
// whole catalogue in. That is correct on /forms and the form pages, which are
// server components and need the data anyway. It is not correct on /pricing,
// which is a client component: nobody comparing plans should download every
// revision date in the IRS library to be told the number 62.
//
// The standing rule is that counts are derived, never typed. These ARE typed,
// so the derivation lives in tests/unit/forms-count.test.ts instead: it imports
// the real arrays, recomputes every number here, and fails the build on any
// drift. Adding a form without updating this file is a red test, not a wrong
// number on a public page.

/** US federal forms with a verified revision marker. */
export const US_FORM_COUNT = 30;

/** Indian statutory forms with a verified authority link. */
export const INDIA_FORM_COUNT = 32;

/** Both libraries together. */
export const FORM_COUNT = US_FORM_COUNT + INDIA_FORM_COUNT;

/** Distinct issuing authorities across both libraries (IRS, USCIS, EPFO, …). */
export const FORM_AUTHORITY_COUNT = 13;
