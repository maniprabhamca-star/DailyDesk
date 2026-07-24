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
    date: '2026-07-23',
    kind: 'improved',
    title: 'Try a tool without leaving the home page',
    detail:
      'The home page now opens with a working compressor instead of a picture of one — drop a PDF straight into the hero and watch it shrink on your own device, then carry the same file into the full Compress tool without re-uploading it. Open your browser’s Network tab while it runs: you’ll see nothing leave your machine. Further down, a new section shows what using any tool actually looks like — same three steps, every time.',
    href: '/',
  },
  {
    date: '2026-07-23',
    kind: 'new',
    title: 'PDF to Audio — have any PDF read aloud',
    detail:
      'Listen to a PDF instead of reading it: pick a voice, set the speed and pitch, press Play and follow the highlighted sentence — tap any sentence to jump there. It uses your device’s own voice, so the file never leaves your browser. Free (a downloadable MP3 is coming with Pro).',
    href: '/pdf-to-audio',
  },
  {
    date: '2026-07-23',
    kind: 'new',
    title: 'Bates numbering — sequential stamps for legal files',
    detail:
      'Add Bates numbers (like ABC-000001) to your PDFs for legal discovery and case files. Set the prefix, starting number, padding and corner, watch a live preview, and drop several files to number the whole set continuously — file two picks up where file one ended. Runs on your device, never uploaded. Free.',
    href: '/bates-numbering',
  },
  {
    date: '2026-07-23',
    kind: 'new',
    title: 'PDF to Markdown — clean, editable text from any PDF',
    detail:
      'Convert a PDF into tidy Markdown — headings, lists and tables kept as GitHub-flavoured Markdown — for your notes app, a static site, or pasting into an AI chat. Toggle heading and table detection, preview it rendered or raw, then Copy or download a .md file. Runs entirely in your browser; the file is never uploaded. Free.',
    href: '/pdf-to-markdown',
  },
  {
    date: '2026-07-22',
    kind: 'improved',
    title: 'Stronger protection for your account',
    detail:
      'We hardened sign-in against automated password-guessing: repeated login attempts are now rate-limited at the network edge before they ever reach our servers, alongside bot filtering. Normal sign-ins are unaffected — this only slows down attacks.',
    href: '/security',
  },
  {
    date: '2026-07-22',
    kind: 'new',
    title: 'Receipt Scanner — snap a receipt into your budget',
    detail:
      'Photograph a receipt and it reads the amount, store and date, then drops the expense straight into your Budget Tracker after you confirm. A Pro tool (launching with Pro); the photo is scanned on our server and deleted immediately.',
    href: '/receipt-scanner',
  },
  {
    date: '2026-07-22',
    kind: 'new',
    title: 'Habit Tracker and Budget Tracker',
    detail:
      'Two simple daily tools, synced to your account: build streaks with the Habit Tracker, and see where your money goes with the Budget Tracker’s monthly total and category breakdown. Both free (with generous limits), no ads.',
    href: '/habits',
  },
  {
    date: '2026-07-22',
    kind: 'new',
    title: 'Smart Notes — quick notes that follow you',
    detail:
      'Fast, clean notes that sync to your account across every device — search across everything, tag to organize, and they save as you type. Free to use (up to 10 notes; Pro for unlimited), no ads.',
    href: '/notes',
  },
  {
    date: '2026-07-22',
    kind: 'new',
    title: 'Link in Bio — one page for all your links',
    detail:
      'Build a clean, ad-free link page at your own diemdesk.com/u/handle — your photo, a short bio, your links, and a theme. Share the single link everywhere. A Pro feature, launching with Pro.',
    href: '/link-in-bio',
  },
  {
    date: '2026-07-22',
    kind: 'new',
    title: 'PDF to PowerPoint and PDF to PDF/A',
    detail:
      'Two new conversions: turn a PDF into an editable PowerPoint deck (each page becomes a slide), or into archival PDF/A for filings and long-term records that must open identically for decades. Three free a day; your file is converted on our server and deleted the instant it downloads.',
    href: '/pdf-to-powerpoint',
  },
  {
    date: '2026-07-21',
    kind: 'new',
    title: 'Scan to PDF — your camera is now a scanner',
    detail:
      'Point your phone at a document and capture clean, multi-page PDFs — with a readability boost that makes a photo read like a proper scan. No camera? Add photos you already took. The camera stream and every page stay in your browser; nothing is uploaded.',
    href: '/scan-to-pdf',
  },
  {
    date: '2026-07-21',
    kind: 'new',
    title: 'Repair PDF — fix files that won’t open',
    detail:
      'Got a PDF that shows up blank or says “file is corrupt”? Repair PDF rebuilds the page index that’s usually broken and tells you honestly how many pages came back — all on your device, so the damaged file is never uploaded.',
    href: '/repair-pdf',
  },
  {
    date: '2026-07-21',
    kind: 'improved',
    title: 'A calmer, faster home page',
    detail:
      'The tools section is no longer a wall of tiles: a quiet category rail lets you focus on one group at a time, and the footer is easier to scan on a phone. Same tools, less clutter.',
  },
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
