// Single source of truth for plan price + feature lists, so the home pricing
// teaser and the full /pricing page can never drift out of sync. Edit here once.

export const PRICING = {
  pro: {
    monthly: '4.99',
    // "$4/mo" framing (user-approved): clean number; the yearly note carries the detail.
    annualPerMonth: '4',
    annualNote: '$49 billed yearly',
  },
  freeFeatures: [
    'Unlimited core PDF & everyday tools',
    'Full-strength compression — Strong & Maximum',
    'Edit & annotate — highlight, fill, sign',
    'No ads, no watermarks, no signup wall',
    'Core tools stay in your browser',
    'Files up to 100 MB',
    'AI actions — coming soon',
    'Encrypted File Vault — coming soon',
  ],
  proFeatures: [
    'Everything in Free, with no limits',
    'Full in-place PDF text editing',
    'Batch processing — many files at once',
    'Office conversions (PDF ↔ Word, Excel, PPT)',
    'OCR — scanned PDFs to searchable text',
    'Unlimited file size (free caps at 100 MB)',
    'Saved one-click workflows',
    'More AI actions per day — coming soon',
    'Unlimited encrypted File Vault — coming soon',
    'Priority speed & support',
  ],
} as const;
