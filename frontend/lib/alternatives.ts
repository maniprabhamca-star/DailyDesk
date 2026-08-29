// The `/<competitor>-alternative` pages, in one list.
//
// This exists because the four original pages were hand-typed into /compare and
// the next five were not, so they shipped as orphans: live, in the sitemap, and
// reachable from nowhere on the site. Google finds a page in a sitemap, but an
// internal link is what tells it the page matters — and a reader never finds it
// at all. Deriving the list from here means adding a page adds its link.
//
// `tests/unit/alternatives.test.ts` fails the build if an app/*-alternative
// route exists that is not in this array.

export type Alternative = {
  /** Route segment: /<slug> */
  slug: string;
  /** How the competitor writes its own name. */
  name: string;
  /** The one-line reason someone comparing would switch. Shown on /compare. */
  hook: string;
};

export const ALTERNATIVES: Alternative[] = [
  { slug: 'adobe-acrobat-alternative', name: 'Adobe Acrobat', hook: 'The everyday jobs, without a subscription' },
  { slug: 'smallpdf-alternative', name: 'Smallpdf', hook: 'No two-tasks-a-day wall' },
  { slug: 'ilovepdf-alternative', name: 'iLovePDF', hook: 'The same tools, nothing uploaded' },
  { slug: 'sejda-alternative', name: 'Sejda', hook: 'No hourly task limit' },
  { slug: 'pdf24-alternative', name: 'PDF24', hook: 'On-device without a Windows install' },
  { slug: 'foxit-alternative', name: 'Foxit', hook: 'No licence, no 14-day clock' },
  { slug: 'sodapdf-alternative', name: 'Soda PDF', hook: 'No account, no cloud drive' },
  { slug: 'pdffiller-alternative', name: 'pdfFiller', hook: 'Fill and sign without an account' },
  { slug: 'pdfnet-alternative', name: 'pdf.net', hook: '114 tools against about 35' },
];
