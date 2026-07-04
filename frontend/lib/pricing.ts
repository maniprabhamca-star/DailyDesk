// Single source of truth for plan price + feature lists, so the home pricing
// teaser and the full /pricing page can never drift out of sync. Edit here once.

export const PRICING = {
  pro: {
    monthly: '5.99',
    // Annual $59/yr → $4.92/mo effective ("under $5/month" — the hook). ~18% off monthly.
    annualPerMonth: '4.92',
    annualNote: '$59 billed yearly',
  },
  freeFeatures: [
    'Every tool — PDF, image, video & utilities',
    'Unlimited use — no daily task limits',
    'Full-strength compression — Strong & Maximum',
    'Edit, annotate & sign',
    'Single-file Office conversions (PDF ↔ Word, Excel, PPT)',
    'Video compress & Video → GIF — in your browser',
    'No ads, no watermarks, no signup',
    'Files up to 100 MB',
  ],
  proFeatures: [
    'Everything in Free, with no limits',
    'OCR — scanned PDFs → editable text',
    'Batch processing — many files at once',
    'Unlimited file size',
    'Saved one-click workflows',
    'Priority speed & support',
    'More AI actions — coming soon',
    'Encrypted File Vault — coming soon',
  ],
} as const;
