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
    'Every tool — PDF, image, video & utilities',
    'OCR — make scanned PDFs searchable',
    'Unlimited use — no daily task limits',
    'Full-strength compression — Strong & Maximum',
    'Edit, annotate & sign',
    'Single-file Office conversions (PDF ↔ Word/Excel/PPT)',
    'Video compress & Video → GIF',
    'No ads, no watermarks, no signup',
    'Files up to 20 MB',
  ],
  proFeatures: [
    'Everything in Free, with no size limits',
    'Unlimited file size (free caps at 20 MB)',
    'Batch processing — many files at once',
    'Saved one-click workflows',
    'Priority speed & support',
    'More AI actions — coming soon',
    'Encrypted File Vault — coming soon',
  ],
} as const;
