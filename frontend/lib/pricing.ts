// Single source of truth for plan price + feature lists, so the home pricing
// teaser and the full /pricing page can never drift out of sync. Edit here once.

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
    'Video compress & Video → GIF',
    'No ads, no watermarks, no signup',
  ],
  proFeatures: [
    'Everything in Free — with more scale',
    'Unlimited file size (free already handles up to 100 MB)',
    'Batch processing — many files at once',
    'Edit PDF text + Search & pattern redaction',
    'Unlimited Office conversions + OCR — no daily cap, any size',
    'Saved one-click workflows',
    'Priority speed & support',
    'More AI actions & encrypted File Vault — coming soon',
  ],
} as const;
