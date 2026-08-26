// The public changelog — curated, user-facing entries (never raw commit spam).
// Newest first. Keep entries in plain product language: what changed for the
// person using the tool, not how the sausage was made. Add an entry with every
// meaningful ship — this file IS the /changelog page.

// 'new' means a NEW TOOL — a page that did not exist before. A capability added
// to a tool that already exists is 'feature'. Conflating the two put "New tool"
// on top of a compression preview change, which is simply untrue.
export type ChangeKind = 'new' | 'feature' | 'improved' | 'fixed' | 'ai' | 'launch';

export type ChangeEntry = {
  date: string; // YYYY-MM-DD
  kind: ChangeKind;
  title: string;
  detail: string;
  href?: string; // deep link to the tool/page it concerns
};

// ⏳ HELD BACK until they un-gate (they are coming_soon / owner-only today, and
// a "new" entry pointing at a door the reader can't open is worse than silence):
// PDF to EPUB · HTML to Excel · Video to MP3 + audio converter. Draft copy for
// all three is in docs/designs/master-roadmap.md §5b — add them the day the
// flags flip, dated then.
export const CHANGELOG: ChangeEntry[] = [
  {
    date: '2026-08-26',
    kind: 'new',
    title: 'Fix what a PDF says it is — and four more ways out of one',
    detail:
      'Every PDF quietly announces a title, an author and the program that made it, which is why a file saved as contract-final still introduces itself as “Microsoft Word - Untitled1”, and why a document can arrive carrying a colleague’s name. Edit PDF details lets you set all of that. The reason other tools appear to do this and change nothing: a PDF can record the same facts twice, in an old information block and in a newer XMP packet, and Acrobat believes the second one — so we write both, and tell you when a file is disagreeing with itself. Drop a stack of PDFs to stamp one author across all of them. Alongside it: PDF to RTF for the software that refuses a .docx, PDF to ODT for people who work in LibreOffice, and OpenDocument to PDF for ODT, ODS, ODP and ODG in one place. PDF to HTML gives you a real web page — selectable text, headings, lists and tables, built in your browser rather than uploaded, because the usual server route turns every paragraph into a picture.',
    href: '/edit-pdf-metadata',
  },
  {
    date: '2026-08-26',
    kind: 'new',
    title: 'Four things a page can need doing to it',
    detail:
      'Scan a book and every sheet holds two pages, which no reader will separate for you — Split pages in half cuts them apart, and it knows that in Arabic, Hebrew and manga the left-hand page is the second one, not the first. Pages per sheet does the opposite, putting 2, 4, 9 or 16 pages on one sheet so a long document prints short; the pages are placed as real pages rather than pictures, so they stay sharp however small they get. Change page size gives a document one size — and its more useful half simply asks what size the file already mostly is and makes the stragglers match, which is what you want after merging things from three different places. Rasterize turns every page into a picture, for when a document has to look identical everywhere and nothing in it should be selectable; it says plainly that this cannot be undone. All four run in your browser, on any file, free.',
    href: '/split-pages-in-half',
  },
  {
    date: '2026-08-24',
    kind: 'new',
    title: 'Put your letterhead back on a PDF',
    detail:
      'Some documents arrive plain and have to go out on headed paper — an invoice from your accounting software, a letter from a template, a form that needs the pre-printed background it was designed for. Until now that meant printing it, or paying for desktop software. Overlay PDF lays one PDF over another: the letterhead, the background, or a stamp page such as DRAFT or PAID, applied across the whole document or only the pages you name. It takes a whole PDF as the stamp rather than a picture of one, so the vectors, the embedded fonts and the transparency all come through exactly as they were designed — which a watermark image cannot do. You can put it on top at any opacity, or behind the page where the page allows it. Both files are opened and combined inside your browser, which matters more here than almost anywhere else: a letterheaded invoice is precisely the document you should not be uploading to a stranger.',
    href: '/overlay-pdf',
  },
  {
    date: '2026-08-23',
    kind: 'improved',
    title: 'Passport photo pages now tell you the whole requirement',
    detail:
      'Each country page used to be a sentence and a short list: the size in millimetres, the background colour, and not much else. It now carries the full requirement — the size in millimetres, inches and pixels at both 300 and 600 DPI, the background, any file-size limit, and the head height in millimetres rather than as a percentage, because "70 to 80 percent" is not a thing you can hold a ruler against and head height is the measurement most photos are rejected for. There is a section on how to measure it, a note on how many copies fit on a single 4×6 print so you can get a set made for the price of one photograph, and links to the other destinations that publish exactly the same size, since one photo often covers several trips. All of the figures are generated from the spec table the tool itself uses, so the page and the photo it makes can never disagree with each other.',
    href: '/passport-photo',
  },
  {
    date: '2026-08-23',
    kind: 'feature',
    title: 'See exactly what compression changed, instead of squinting',
    detail:
      'The quality preview used to put the original and the compressed page side by side and leave you to spot the difference. At the gentler settings there is nothing to spot — which is the whole point, but it reads as though the tool is broken. So it now tells you instead of asking you. It says in words whether anything visible changed, and it lists what was actually done: text untouched and still selectable, and the page image resized from one size to another at a stated quality. There is a "Show what changed" view that paints the page black where nothing moved and bright where it did, amplified ten times, because the changes worth seeing are small ones. And when a page is already close to the smallest size that stays readable, it now says so plainly — that every setting will produce the same page and only the file size differs — instead of leaving you switching between four buttons wondering why nothing happens. None of it is an estimate: it is measured from the actual page your settings will produce, on your device, before you commit to anything.',
    href: '/compress-pdf',
  },
  {
    date: '2026-08-22',
    kind: 'fixed',
    title: 'Photos that said they were one thing and were another',
    detail:
      'Some phones — Samsung handsets in "high efficiency" mode, and several apps that pass a picture along to another app — save a photograph in Apple\'s HEIF format but label the file .jpg. Every tool here believed the label, handed the file to a JPEG reader that refused it, and told you your browser could not open that image format, which was both unhelpful and untrue. Photos are now identified by what is actually inside them rather than what the name claims, so a mislabelled photograph converts like any other. When something genuinely cannot be read, the message now names the format we found and what the browser said about it, instead of a shrug. And every picked file is read the moment you choose it rather than at the moment you press Convert, which closes a window in which a photo could quietly become unreadable in between.',
    href: '/jpg-to-pdf',
  },
  {
    date: '2026-08-22',
    kind: 'improved',
    title: 'Choose how big the PDF should be',
    detail:
      'Photos out of a phone are big — three of them make a PDF of about nine megabytes, which is more than most mail servers will send. Until now that was the only thing this tool would give you, because it embeds each picture exactly as it is and never re-compresses. That is still the default, and still the right answer when the pages are going to be printed or filed. But there is now a File size choice next to page size: Smaller file — now the default — resizes each photo to about four megapixels, which took a twelve-megapixel photograph of a document from 1.6MB down to 286KB in our testing with the text still crisp, and Smallest file goes down to 81KB for something that only has to be read on a screen. Choose Original quality to go back to embedding every photo exactly as it is. The tool says what each setting will do before you convert. If a picture is already small enough that re-compressing it would make it bigger — which happens more often than you would think — it is left alone, because a button marked "smaller" should never hand back something larger.',
    href: '/jpg-to-pdf',
  },
  {
    date: '2026-08-22',
    kind: 'improved',
    title: 'iPhone photos go straight into a PDF now',
    detail:
      'Photographs taken on an iPhone are saved as HEIC, a format Chrome, Edge and Firefox cannot open — so until now, dragging one into JPG to PDF or Scan to PDF got you nothing useful unless you were on a Mac. Both tools now decode HEIC themselves, using the same decoder that has always powered HEIC to JPG, so a photo taken on a phone converts on any browser without being re-saved first. The decoder is only fetched if a HEIC actually turns up; if you never use one, nothing extra is downloaded. Ordinary JPGs and PNGs are still embedded exactly as they are, with no re-compression. Samsung phones set to "high efficiency" save the same format and work the same way. And when an image genuinely cannot be read, the tool now names the file and says why, instead of "please try different files" — which was never much help.',
    href: '/jpg-to-pdf',
  },
  {
    date: '2026-08-22',
    kind: 'fixed',
    title: 'Scan to PDF: the camera works, and no photo disappears quietly',
    detail:
      'Three things were wrong here, all on phones. Tapping “Use camera” asked for permission and then showed a black rectangle, because the camera was switched on a fraction of a second before there was anywhere to show it. When the camera could not start, the reason given was always “no camera available” — which was rarely true; usually permission had simply been declined, and now it says so and tells you where to turn it back on. And “Add photos” opened the camera instead of your gallery on Android, which is the opposite of what it says. Separately, adding a photo the browser could not read took the whole page down with an error message rather than skipping that one file; it now names the file and carries on. Same fix in JPG to PDF, where files left out of a selection were left out in silence — they are now listed, with the reason.',
    href: '/scan-to-pdf',
  },
  {
    date: '2026-08-10',
    kind: 'new',
    title: 'Coming soon: preview every file in a folder',
    detail:
      'Windows shows you a thumbnail for pictures and videos, and the same grey icon for everything else — so a folder of forty PDFs, spreadsheets and notes is forty identical rectangles, and the only way to find the one you want is to open them one at a time. Folder Preview draws the rest of them too: the first page of each PDF, the top rows of each spreadsheet, your markdown, your code, your fonts and your vectors, all on one screen. Files it genuinely cannot draw — Photoshop, Word, archives — are still listed, with the reason, because hiding them would make your folder look emptier than it is. It only exists because nothing is uploaded: handing your whole folder to a website is not something you would sensibly do, and here you are not doing it. It is being tested now and will open shortly.',
    href: '/folder-preview',
  },
  {
    date: '2026-08-08',
    kind: 'new',
    title: 'For developers: our engines, running in your users’ browser',
    detail:
      'If you build software that handles other people’s documents, there is now a way to use what powers these tools inside your own app. Every other PDF service works by taking a copy of the file onto their servers; this one runs in the browser tab, so the document never goes anywhere — which means no vendor for your customers to vet, nothing to add to a data-processing agreement, and no bill that grows with usage, because the work happens on the computer in front of them. It handles the page work: merging, splitting, extracting, deleting, rotating and clearing metadata. It is deliberately clear about what it will not do, including the things that would need a server. Details at /developers.',
    href: '/developers',
  },
  {
    date: '2026-08-08',
    kind: 'new',
    title: 'A certificate to hand over with a redacted file',
    detail:
      'When you redact a PDF you now get a receipt to send alongside it. It records which pages were redacted, how many areas, and — the part that matters — whether any selectable text survived underneath, because a black box drawn over live text is not a redaction. It also carries the fingerprint of that exact file, so whoever receives it can confirm they were sent the document the certificate describes and not a later edit. There is a page at /verify-redaction where anyone can check one: no account, and the comparison happens in their browser. Both the certificate and the check are made on your device, which is also why the certificate is honest about what it cannot prove — it records your computer’s clock, not a notarised timestamp.',
    href: '/verify-redaction',
  },
  {
    date: '2026-08-08',
    kind: 'new',
    title: 'Written for the work you actually do',
    detail:
      'Four new pages for the people whose job makes our approach matter rather than merely nice: law firms, accountants, healthcare and schools. Each one names the rule you work under, walks through the everyday jobs it makes awkward — redacting before production, converting a client statement, releasing a record — and says plainly where we are not the right tool. That last part is deliberate. Most online file tools promise to delete your document after an hour, which quietly concedes they received it; ours never does, and these pages explain what that changes for you.',
    href: '/for/legal',
  },
  {
    date: '2026-08-08',
    kind: 'improved',
    title: 'The Tools menu now shows everything at once',
    detail:
      'Opening Tools used to give you a narrow dropdown with the whole catalogue squeezed into four columns behind a scrollbar — you had to scroll a menu to find out what was in it. It now opens across the full width of the page, so every tool is on screen together, grouped and readable at a glance, with a close button in the corner. Escape closes it too.',
  },
  {
    date: '2026-08-07',
    kind: 'new',
    title: 'Your account page now shows exactly what we hold — and lets you take it or delete it',
    detail:
      'The account page used to show your name and your plan and little else. It now lists everything of yours that sits on our servers, counted, including the lines that read none — because for most people almost every line reads none, and that is the whole point: files you put through the in-browser tools never reach us, so there is nothing to list. Under that, two buttons we should have had from the start. Download everything gives you one JSON file with every row in that list, immediately, with no request form and no waiting. And you can delete your account outright: it takes your email and your password to confirm, then removes everything straight away — no thirty-day grace period, no copy kept, because deleted should mean deleted. You can also set or change your password there, and if you signed up with Google it offers to set one rather than asking for a password you never chose.',
    href: '/account',
  },
  {
    date: '2026-08-07',
    kind: 'improved',
    title: 'You stay signed in for longer, and properly',
    detail:
      'Signing in now lasts a month instead of a week, and it renews itself whenever you come back — so using DiemDesk regularly keeps you signed in indefinitely, rather than logging you out on a fixed schedule no matter how often you visit. When a session genuinely does run out, the whole site now agrees about it at once: you get told plainly and offered a way back in, instead of one page saying “please sign in” while the rest still shows you as logged in.',
  },
  {
    date: '2026-08-07',
    kind: 'fixed',
    title: 'Your account page no longer gets stuck when your session runs out',
    detail:
      'Signing in lasts about a week. When it ran out, the account page didn’t say so — it still showed your name and your plan while the subscription section span forever and the billing button showed a technical error message that meant nothing to anyone. It now tells you plainly that your session has expired and offers to sign you back in, and any billing hiccup shows a real message with a Try again button instead of an endless spinner.',
    href: '/account',
  },
  {
    date: '2026-08-07',
    kind: 'improved',
    title: 'Easier to read, and usable with a screen reader or keyboard',
    detail:
      'We ran the whole site through an accessibility audit and fixed what it found. Text that was slightly too faint to read comfortably — badges, captions, the small print in the footer, section headings in dark mode — is now properly legible in both themes. Every file picker, slider, colour control and switch has a proper name, so a screen reader says what it is instead of announcing an unlabelled button; the search box now behaves like a real combobox as you arrow through results. Links inside paragraphs are underlined rather than only colour-coded. And if you have "reduce motion" turned on in your system settings, nothing on the site loops or pulses any more — that setting is now respected everywhere rather than in a few hand-picked places.',
  },
  {
    date: '2026-08-07',
    kind: 'fixed',
    title: 'A button near the bottom of the screen no longer ignores you on a phone',
    detail:
      'The privacy notice that appears on your first visit sits at the bottom of the screen, and on a small screen it was covering the last part of the page. Anything underneath looked completely normal and simply did nothing when you tapped it — on the favicon generator, that was the Download button. The page now leaves room for the notice, so you can always scroll past it and reach whatever is down there. If you ever tapped something and nothing happened, this may well have been why.',
  },
  {
    date: '2026-08-07',
    kind: 'improved',
    title: 'Cancel your subscription yourself, in two clicks',
    detail:
      'Your account page now lists every paid subscription you have — monthly or annual — with what it costs, when it renews, and a Cancel button that actually cancels. No email, no support ticket, no hunting for a link. If you’re still inside the 14-day money-back window, the page tells you the exact date it closes and offers to refund your last payment on the spot; the money goes back to your card immediately rather than after somebody reads a message. Past that date you can still cancel any time — you simply keep what you’ve paid for until the period ends, and we say so plainly instead of leaving you guessing. Changed your mind before it lapses? There’s a button to keep it. We also ask why you’re leaving, and we do read the answers.',
    href: '/account',
  },
  {
    date: '2026-07-28',
    kind: 'new',
    title: 'A proper welcome for first-time visitors',
    detail:
      'The very first time you land on the home page, the DiemDesk mark builds itself in and lifts away in about a second — a small hello, shown once and never again. It skips the moment you tap, scroll or press a key, never delays the page (which is already there underneath), and stays out of the way if you land straight on a tool from search. Installed on your phone, the app now opens with a clean branded splash too.',
  },
  {
    date: '2026-07-24',
    kind: 'new',
    title: 'Every tool page now shows its own receipts',
    detail:
      'Three additions you won’t find on other file sites. A live counter on each tool measures the bytes of your file that actually leave the tab — it reads zero on our in-browser tools because it has to, and on the few tools that use our server it counts up and says so. Under that, “What this does to your file” lists every change in plain words, including the awkward ones like invalidated signatures. And “Where this won’t help” names the cases we’re the wrong tool for, and points you at the right one — sometimes someone else’s.',
  },
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
  feature: { label: 'New feature' },
  improved: { label: 'Improved' },
  fixed: { label: 'Fixed' },
  ai: { label: 'AI' },
  launch: { label: 'Milestone' },
};
