// The public changelog — curated, user-facing entries (never raw commit spam).
// Newest first. Keep entries in plain product language: what changed for the
// person using the tool, not how the sausage was made. Add an entry with every
// meaningful ship — this file IS the /changelog page.

export type ChangeKind = 'new' | 'improved' | 'fixed' | 'ai' | 'launch';

export type ChangeEntry = {
  date: string; // YYYY-MM-DD
  kind: ChangeKind;
  title: string;
  detail: string;
  href?: string; // deep link to the tool/page it concerns
};

export const CHANGELOG: ChangeEntry[] = [
  {
    date: '2026-07-21',
    kind: 'improved',
    title: 'Redact: cleaner boxes, smarter AI matching',
    detail:
      'Redaction boxes now stay clean on the page — tap one to select it and a single Remove button appears (no more accidental deletes). The AI personal-info finder locates fragmented account numbers and multi-line addresses it previously missed, and lists each value once with the pages it appears on. Verified against real bank statements.',
    href: '/redact-pdf',
  },
  {
    date: '2026-07-20',
    kind: 'improved',
    title: 'Your work now survives tab switches',
    detail:
      'Browsers quietly evict heavy background tabs to save memory — which used to wipe your loaded file. Now 19 tools save your file and edits on your device and silently pick up exactly where you left off when you come back.',
  },
  {
    date: '2026-07-20',
    kind: 'ai',
    title: 'The AI document suite is complete — launching with Pro',
    detail:
      'Eight AI tools, built and ready behind the scenes: Chat with PDF, page-cited Summaries, Translate with a do-not-translate glossary, a Question generator with Anki/Moodle export, PDF→Excel table clean-up, meaning-level document compare, AI find-personal-info for Redact, and natural-language commands in the search palette. Every answer cites the page it came from, and your file never leaves your device — only text does, and only when you ask.',
    href: '/pricing',
  },
  {
    date: '2026-07-20',
    kind: 'improved',
    title: 'Faster first file-drop on every PDF tool',
    detail:
      'The PDF engine now warms up in the background the moment a tool page opens, so your first drop starts processing immediately instead of pausing to load machinery.',
  },
  {
    date: '2026-07-20',
    kind: 'fixed',
    title: 'Offline caching rebuilt, carefully',
    detail:
      'Once you have used a tool online, it keeps working in that browser without a connection. The previous version of this could pin browsers to an outdated copy of the site — the rebuild makes that impossible, and we soak-tested it for a week before saying so here.',
  },
  {
    date: '2026-07-15',
    kind: 'new',
    title: 'PDF → Excel, free and on-device',
    detail:
      'Extract tables from statements, invoices and reports into a real .xlsx or CSV — detected, highlighted on the page, and editable before export. Runs entirely in your browser; the big names upload your file to their servers for this.',
    href: '/pdf-to-excel',
  },
  {
    date: '2026-07-15',
    kind: 'new',
    title: 'Share straight from Gmail on Android',
    detail:
      'Install DiemDesk and it appears in Android’s share sheet — share a PDF from Gmail and it opens in the viewer, ready to hand off to any tool without re-uploading.',
    href: '/pdf-viewer',
  },
  {
    date: '2026-07-14',
    kind: 'new',
    title: 'PDF viewer with no-re-upload hand-off',
    detail:
      'Open a PDF once, then send it to Compress, Split, Sign, Fill-form and more with one click — the file travels between tools on your device, never uploaded twice.',
    href: '/pdf-viewer',
  },
  {
    date: '2026-07-14',
    kind: 'new',
    title: '16 developer & data tools',
    detail:
      'Base64, JSON↔CSV, regex tester, hash generator, diff checker and a dozen more — all instant, all in your browser.',
    href: '/developer-tools',
  },
  {
    date: '2026-07-13',
    kind: 'launch',
    title: 'DiemDesk opens to the public',
    detail:
      'The gate came down: 50+ tools live at diemdesk.com, free to use, no signup, no watermarks — and your files stay on your device.',
    href: '/overview',
  },
  {
    date: '2026-07-12',
    kind: 'new',
    title: 'Sign in with Google',
    detail: 'One-tap sign-in, using Google’s verified-identity flow — we never see or store a password.',
  },
  {
    date: '2026-07-11',
    kind: 'new',
    title: 'On-device batch processing on six tools',
    detail:
      'Compress, convert, resize, rotate and strip metadata from many files at once — each processed on your device, zipped for one download.',
  },
  {
    date: '2026-07-10',
    kind: 'improved',
    title: 'Split by file size, and a faster Compress',
    detail:
      'Split a PDF into parts under a size cap (email limits, portal limits), and Compress now skips font work on scans — over three minutes down to about 25 seconds on a large scanned file.',
    href: '/split-pdf',
  },
  {
    date: '2026-07-02',
    kind: 'launch',
    title: 'DiemDesk.com goes live',
    detail: 'The product got its name and home: diemdesk.com, served over HTTPS through Cloudflare.',
  },
];

export const KIND_META: Record<ChangeKind, { label: string }> = {
  new: { label: 'New tool' },
  improved: { label: 'Improved' },
  fixed: { label: 'Fixed' },
  ai: { label: 'AI' },
  launch: { label: 'Milestone' },
};
