// The upload size limits the Compress-to-size tool fills with one tap.
//
// ───────────────────────────────────────────────────────────────────────────
// Why this file exists, and why `source` is not optional
// ───────────────────────────────────────────────────────────────────────────
//
// These presets lived inline in components/tools/compress-target-tool.tsx with
// a comment calling them "real, sourced upload limits" and not one URL beside
// them. Two problems came out of an SEO audit on 2026-11-25 and they are worth
// separating, because only one of them is about search:
//
//  1. ⚠ THE ACCURACY ONE. The tool asserts these numbers to a person about to
//     submit an exam form. A figure with no source and no date is a claim about
//     nothing: portals change their caps, and "UPSC photo 40 KB" is either
//     right today or quietly wrong, and nothing in the repo could tell you
//     which.
//  2. The discoverability one. They never reached the HTML — the chips render
//     client-side after a file is dropped, so NEET, the US visa cap, Canada PR
//     and India e-Visa appeared nowhere in the page a crawler sees.
//
// So: one source of truth, read by both the tool and the page, and a type that
// makes the distinction impossible to fudge. A limit either carries a
// `source` — authority, URL, the date it was read, and the sentence as
// published — or it carries `unverified`, which says why. Never both, never
// neither; tests/unit/size-limits.test.ts fails the build otherwise.
//
// **Only sourced limits are published on the page.** An unverified preset stays
// in the tool, because a preset is a convenience — it fills a number box the
// user can see and change — while a row in a published table is a claim about
// what a government department requires. Those are not the same act. This is
// the same rule the resale-certificate matrix runs on: a row we could not read
// at source was left blank rather than filled with something plausible.
//
// ⛔ Do NOT fill a `source` from a blog, an aggregator, a coaching site or a
// forum. Several of these caps are quoted all over the internet and the quotes
// disagree. Read the authority's own page, or leave it unverified. And never
// work around a bot check to get one: travel.state.gov sits behind one, which
// is exactly why the US visa row is unverified below.

export const KB = 1024;
export const MB = 1024 * KB;

export const LIMIT_GROUPS = [
  'India exams & forms',
  'Passport & visa',
  'Everyday sharing',
] as const;
export type LimitGroup = (typeof LIMIT_GROUPS)[number];

/** A figure read on the authority's own page, on a stated date. */
export type LimitSource = {
  /** The authority, named the way it names itself. */
  authority: string;
  /** The exact page it was read on. */
  url: string;
  /** ISO date it was read. A cap without a date is not a fact for long. */
  checked: string;
  /** What the page says, as published. Short. */
  quote: string;
};

type Base = {
  /** The chip label in the tool. */
  label: string;
  /** The cap, as a person would write it. */
  note: string;
  bytes: number;
  group: LimitGroup;
  /** What the cap applies to — only used in the published table. */
  applies?: string;
};

export type SizeLimit =
  | (Base & { source: LimitSource; unverified?: never })
  | (Base & { source?: never; unverified: string });

export const SIZE_LIMITS: readonly SizeLimit[] = [
  // ── India exams & forms ──────────────────────────────────────────────────
  // Every one of these still needs reading at source. The commissions publish
  // their caps inside per-exam notice PDFs rather than on a stable page, so
  // each is its own hunt. ssc.gov.in and upsconline.gov.in both answer a real
  // browser, so this is work pending, not work blocked.
  { label: 'UPSC photo', note: '40 KB', bytes: 40 * KB, group: 'India exams & forms',
    unverified: 'Published per-exam in UPSC notice PDFs; not yet read at source.' },
  { label: 'UPSC doc', note: '300 KB', bytes: 300 * KB, group: 'India exams & forms',
    unverified: 'Published per-exam in UPSC notice PDFs; not yet read at source.' },
  { label: 'SSC', note: '100 KB', bytes: 100 * KB, group: 'India exams & forms',
    unverified: 'In the SSC one-time-registration instructions; not yet read at source.' },
  { label: 'NEET', note: '200 KB', bytes: 200 * KB, group: 'India exams & forms',
    unverified: 'Published in the NTA information bulletin per session; not yet read at source.' },
  { label: 'IBPS', note: '50 KB', bytes: 50 * KB, group: 'India exams & forms',
    unverified: 'In the IBPS per-recruitment advertisement; not yet read at source.' },
  { label: 'SBI', note: '50 KB', bytes: 50 * KB, group: 'India exams & forms',
    unverified: 'In the SBI per-recruitment advertisement; not yet read at source.' },
  { label: 'RRB', note: '50 KB', bytes: 50 * KB, group: 'India exams & forms',
    unverified: 'Published per Railway Recruitment Board notification; not yet read at source.' },
  { label: 'Signature', note: '20 KB', bytes: 20 * KB, group: 'India exams & forms',
    unverified: 'A common signature cap across Indian portals rather than one authority’s rule, so there is no single page to cite.' },

  // ── Passport & visa ──────────────────────────────────────────────────────
  { label: 'US visa', note: '240 KB', bytes: 240 * KB, group: 'Passport & visa',
    unverified: '⛔ travel.state.gov serves its photo requirements behind a bot check. We do not work around one, so this stays unverified until the page can be read another way.' },
  { label: 'India passport', note: '250 KB', bytes: 250 * KB, group: 'Passport & visa',
    unverified: 'passportindia.gov.in returns a near-empty body to automated reads; the cap is inside the portal.' },
  { label: 'India e-Visa', note: '1 MB', bytes: 1 * MB, group: 'Passport & visa',
    unverified: 'Not yet read at source.' },
  { label: 'China visa', note: '1 MB', bytes: 1 * MB, group: 'Passport & visa',
    unverified: 'Not yet read at source.' },
  { label: 'UAE visa', note: '1 MB', bytes: 1 * MB, group: 'Passport & visa',
    unverified: 'Not yet read at source.' },
  {
    label: 'Canada PR', note: '4 MB', bytes: 4 * MB, group: 'Passport & visa',
    applies: 'Each document uploaded to the IRCC secure account or the Permanent Residence Portal',
    source: {
      authority: 'Immigration, Refugees and Citizenship Canada',
      url: 'https://ircc.canada.ca/english/helpcentre/answer.asp?qnum=1123&top=23',
      checked: '2026-11-26',
      // The figure is in a table rather than a sentence: the rows for the IRCC
      // secure account and the Permanent Residence Portal both read 4 MB. The
      // other accounts on that table are 5 MB, which is why the row names the
      // two it applies to instead of saying "Canada".
      quote: 'Yes. The file size limit varies depending on which online application account you use.',
    },
  },
  { label: 'Passport photo', note: '200 KB', bytes: 200 * KB, group: 'Passport & visa',
    unverified: 'A general figure, not one authority’s rule — per-country photo specifications live on /passport-photo.' },

  // ── Everyday sharing ─────────────────────────────────────────────────────
  {
    // Was labelled "Email". Renamed: what is verified is Gmail's personal-account
    // cap, and "Email" implied every provider shares it. They do not, and
    // Workspace administrators set their own.
    label: 'Gmail', note: '25 MB', bytes: 25 * MB, group: 'Everyday sharing',
    applies: 'Files attached to a message you send from a personal Gmail account',
    source: {
      authority: 'Google',
      url: 'https://support.google.com/mail/answer/6584',
      checked: '2026-11-26',
      quote: 'For personal Gmail accounts, the limit is 25 MB.',
    },
  },
  { label: 'Discord', note: '25 MB', bytes: 25 * MB, group: 'Everyday sharing',
    unverified: 'support.discord.com refuses automated reads, and this cap has been raised at least once, so an old figure is worse than none.' },
  { label: 'Web upload', note: '2 MB', bytes: 2 * MB, group: 'Everyday sharing',
    unverified: 'A rule of thumb for form uploads, not anybody’s published limit.' },
] as const;

/** Narrowing helper — the only way a row reaches the published table. */
export function isSourced(l: SizeLimit): l is Base & { source: LimitSource } {
  return 'source' in l && l.source !== undefined;
}

/** The rows the page may publish. Everything else stays a tool preset. */
export const PUBLISHED_LIMITS = SIZE_LIMITS.filter(isSourced);

/** Presets the tool offers, grouped as the picker groups them. */
export function limitsInGroup(group: LimitGroup): readonly SizeLimit[] {
  return SIZE_LIMITS.filter((l) => l.group === group);
}

/** How many are still to read at source. Quoted on the page, so it cannot drift. */
export const UNVERIFIED_COUNT = SIZE_LIMITS.length - PUBLISHED_LIMITS.length;
