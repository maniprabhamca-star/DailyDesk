// Single source of truth for plan price + feature lists, so the home pricing
// teaser and the full /pricing page can never drift out of sync. Edit here once.

import { FORM_COUNT } from './forms-count';

export const PRICING = {
  pro: {
    monthly: '5.98',
    // Annual $60/yr → clean $5.00/mo effective, ~16% off (≈2 months free).
    annualPerMonth: '5',
    annualNote: '$60 billed yearly',
  },
  freeFeatures: [
    'Every everyday tool — PDF, image, video & utilities',
    'Unlimited on-device tools — no daily limits',
    'Big files free — up to 100 MB in your browser',
    'Full-strength compression — Strong & Maximum',
    'Sign PDFs now — annotate & basic redaction coming soon',
    '3 free Office conversions a day (PDF ↔ Word/Excel/PPT)',
    // Deliberately in the FREE list. The forms libraries are the funnel, and a
    // competitor charging a subscription for the same orientation is the point.
    // The count is interpolated, never typed — forms-count.ts is pinned to the
    // real catalogues by tests/unit/forms-count.test.ts.
    `Guides to ${FORM_COUNT} government forms, re-checked at the source`,
    'Video compress & Video → GIF',
    'No ads, no watermarks, no signup',
  ],
  proFeatures: [
    'Everything in Free — with more scale',
    'Unlimited file size (free already handles up to 100 MB)',
    'Batch processing — many files at once',
    // "Edit PDF text" was too loose to sell. The free Fill tool already places
    // text, dates and a signature anywhere on a page and flattens the result,
    // which most people would call editing a PDF — so a Pro bullet reading
    // "Edit PDF text" promises something a non-payer already has, and the buyer
    // finds that out after paying. The comparison table on the same page has
    // always said it precisely; the card now matches it.
    'Full in-place text editing — change the existing text',
    'Search & pattern redaction',
    'Unlimited Office conversions + OCR — no daily cap, any size',
    'AI document suite — chat, cited summaries, translate, question generator, AI find-personal-info, table clean-up (launching with Pro)',
    'Saved one-click workflows',
    'Priority speed & support',
    'Encrypted File Vault — coming soon',
  ],
  // Business = everything in Pro, plus the volume and exports an accountant
  // actually needs. Written as "everything in Pro, plus" on purpose: the whole
  // point of the tier is that it REPLACES buying both, so the list must not read
  // like a different product. See docs/designs/business-tier-pricing.html.
  businessFeatures: [
    'Everything in Pro — one subscription, not two',
    '300 bank-statement pages a month',
    'Every row reconciled against the running balance',
    'Export to Tally, QuickBooks (QBO), OFX, Excel & CSV',
    'AI document suite — 200 actions a month',
    'Saved per-client presets',
    'Top-up pages when a month runs long',
    'Invoiced billing on request',
    'Priority support',
  ],
  // Who each tier is for, in the buyer's own terms. A tier list that describes
  // features without naming the person is how someone decides we are not for
  // them.
  audience: {
    free: 'Anyone with a file and a problem.',
    pro: 'An individual who hits a limit — a freelancer, a student, someone doing their own paperwork.',
    business: 'Someone whose clients’ paperwork is the job — an accountant, a bookkeeper, a two-person practice.',
  },
} as const;
