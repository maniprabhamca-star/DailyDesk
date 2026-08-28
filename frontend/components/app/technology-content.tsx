'use client';

import {
  ShieldCheck, Cpu, Server, Boxes, Gauge, Lock, Sparkles, FileSearch,
  Layers, GitBranch, Wrench, Braces, Landmark, ScanText, Globe, Image as ImageIcon,
} from 'lucide-react';

// Internal engineering reference. Owner-only, noindex, out of the sitemap.
//
// Written to be read a year from now by someone who has forgotten why: every
// entry says what the thing is FOR, not just that we use it. The sections after
// the inventory are the ones worth keeping — they record decisions that were
// arrived at the hard way and would otherwise have to be rediscovered.

/**
 * Every card answers the same three questions in the same order:
 *
 *   what — a plain definition, for someone who has never heard of it
 *   why  — the problem it solves, and what the alternative costs
 *   here — what it actually does in THIS product
 *
 * The earlier version only answered the third, which read as a pile of detail
 * unless you already knew the tool. A stack page has to explain before it can
 * justify.
 */
type Tech = { name: string; tag: string; what: string; why: string; here: string; note?: string };

const FRONTEND: Tech[] = [
  {
    name: 'Next.js 14.2 (App Router)',
    tag: 'Web framework',
    what: 'A framework built on top of React. React on its own only draws the interface once it is running in the browser; Next.js adds the parts a real website needs around it — page routing, and the ability to build the HTML in advance rather than in the visitor\'s browser.',
    why: 'A plain React app sends an almost empty HTML file and then asks the browser to draw everything. That means a blank moment for the visitor and, worse, very little for Google to read. Next.js builds the finished HTML ahead of time, so the page arrives complete and the search engine sees actual words.',
    here: 'Every tool page is built at deploy time — the copy, the steps and the FAQ data are already in the HTML before any script runs, which is how 175 pages compete for search traffic. Only the tool itself becomes interactive afterwards.',
    note: 'Server Actions are version-stamped, so a tab left open across a deploy calls one that no longer exists. A guard catches that and reloads once instead of showing a broken tool.',
  },
  {
    name: 'React 18 · TypeScript 5',
    tag: 'UI library + type safety',
    what: 'React is the library that draws and updates the interface when something changes. TypeScript is JavaScript with type checking added, so the editor and the build know what shape every value is meant to be.',
    why: 'Without React you rewrite screen-updating logic by hand for every tool. Without TypeScript, a mistake only shows up when a user hits it. The check happens at build time instead of in front of a customer.',
    here: 'It matters more here than on a normal site because these document libraries hand each other raw blocks of bytes with no checking of their own — pdf.js output going into pdf-lib, canvas output into an encoder. Pass the wrong one and you get a quietly corrupted file rather than an error. The types are the only thing standing between those calls.',
  },
  {
    name: 'Tailwind CSS 3.4',
    tag: 'Styling',
    what: 'A styling system where you compose small utility classes directly on an element instead of writing separate stylesheets.',
    why: 'Traditional CSS drifts: the same colour ends up defined in four files with three slightly different values, and dark mode becomes a second set of everything to keep in sync. Tailwind reads one shared set of design tokens, so there is exactly one place a colour is defined.',
    here: 'One HSL token set on :root, overridden once for dark. Every colour resolves through it, so light and dark cannot disagree and no component can hard-code a shade that breaks in the other theme.',
    note: 'A colour defined only inside a dark-mode block renders transparent in light. Always define the light value first.',
  },
  {
    name: 'Radix UI',
    tag: 'Accessible components',
    what: 'A library of unstyled, behaviour-only building blocks — dialog, dropdown, toast — that you style yourself.',
    why: 'These components look trivial and are not. Trapping focus inside an open dialog, returning it correctly on close, handling Escape, locking background scroll and wiring the aria attributes are each easy to get almost right. A hand-rolled version passes a quick look and fails a screen reader.',
    here: 'Every dialog, dropdown and toast on the site. We supply the appearance; Radix supplies the behaviour that keyboard and screen-reader users depend on.',
  },
  {
    name: 'framer-motion 11',
    tag: 'Animation',
    what: 'An animation library for React, describing motion as a state to move toward rather than a timeline to script.',
    why: 'Hand-written animation tends to break when a component is interrupted mid-transition. It also makes it easy to honour the operating-system setting for people who get motion sickness from moving interfaces.',
    here: 'The first-visit brand reveal and small state transitions. Every animation checks prefers-reduced-motion and resolves to a still state rather than a faster one — reduced motion means "take me there", not "play a shorter film".',
    note: 'The splash is aria-hidden and role=presentation: it repeats what the page underneath already says, so a screen reader should skip it entirely.',
  },
  {
    name: 'lucide-react',
    tag: 'Icons',
    what: 'An open-source icon set delivered as React components, so each icon is drawn as SVG rather than loaded as an image or a font.',
    why: 'SVG icons stay sharp at any size, take colour from the surrounding text, and add no extra network request. The licence matters as much as the design: ISC allows commercial use with no attribution requirement, and several popular icon sets do not.',
    here: 'Every icon on the site. Imported one at a time so the build strips out the rest — a page carries only the handful of glyphs it actually draws.',
  },
];

const ENGINES: Tech[] = [
  {
    name: 'pdfjs-dist 6.1',
    tag: 'Reads PDFs',
    what: 'Mozilla\'s PDF engine — the same code that displays PDFs inside Firefox — packaged to run on any web page.',
    why: 'A PDF is not a document you can simply open and read; it is a program describing where to paint marks. Interpreting that correctly is years of work, and this is the most battle-tested free implementation of it.',
    here: 'Every READ operation: page previews, turning pages into images for OCR and compression, pulling out text with per-word coordinates, and reading an existing bookmark outline. It brings its own decoders for JPEG 2000 and JBIG2, which is the only reason scanned bank statements open at all.',
    note: 'A render without intent:"print" never finishes in a background tab, and an image URL from a render dies the moment the document is closed. Two silent traps.',
  },
  {
    name: 'pdf-lib 1.17',
    tag: 'Writes PDFs',
    what: 'A library that edits the internal structure of a PDF — its pages, fonts and objects — and writes a valid file back out.',
    why: 'The naive way to "edit" a PDF is to render it to images and rebuild it, which throws away the text, the fonts and the quality. This edits the document in place, so what you did not touch is byte-for-byte what it was.',
    here: 'Every WRITE operation: merge, split, rotate, page geometry, stamping one PDF onto another, metadata and bookmarks. Merging two files keeps both sets of fonts and vectors exactly as they were — nothing is flattened in transit.',
    note: 'It has no bookmark API at all, so that tree is built by hand. And updateMetadata is a LOAD option, not a save one — passing it to save() only looks like it works.',
  },
  {
    name: '@pdf-lib/fontkit',
    tag: 'Font embedding',
    what: 'An extension that lets pdf-lib embed real font files into a PDF.',
    why: 'If a font is not embedded, the reader substitutes whatever it has and your text reflows on someone else\'s machine. Embedding guarantees the document looks the same everywhere — but embedding a whole typeface is heavy, so it subsets down to only the characters used.',
    here: 'Any tool that draws text onto a page: page numbers, Bates numbering, signatures, added text. Adding a page number costs a few kilobytes rather than shipping an entire font family.',
  },
  {
    name: 'qpdf-wasm',
    tag: 'Encrypted PDFs',
    what: 'The qpdf tool compiled to WebAssembly so it runs inside the browser. It handles PDF encryption — opening a file that needs a password.',
    why: 'Most PDF libraries simply refuse an encrypted file. Without something that can decrypt locally, the only alternative is asking people to upload both the document and its password, which for a bank statement is precisely the wrong request.',
    here: 'Opening password-protected PDFs on the device. Not an edge case: Indian bank e-statements are encrypted by default, so the flagship statement converter would fail at step one. The password is typed in the tab, used in the tab, and never sent anywhere.',
  },
  {
    name: '@jsquash/jpeg',
    tag: 'JPEG encoding',
    what: 'The standard JPEG library, compiled to WebAssembly so the browser can encode and decode images directly.',
    why: 'The browser\'s built-in canvas export gives you a single quality slider and its own hidden pipeline, which differs between browsers — so the same file compresses differently in Chrome and Safari. This gives direct control over the compression settings.',
    here: 'The compression engine. It is why a quality level means the same thing on every browser, and why compression results are predictable rather than dependent on whose machine ran them.',
  },
  {
    name: 'libheif-js',
    tag: 'iPhone photos',
    what: 'A decoder for HEIC/HEIF, the image format an iPhone saves photos in by default.',
    why: 'Chrome and Firefox cannot open HEIC at all. Without a decoder, a photo straight from an iPhone is simply an unreadable file — and that is most photos people try to convert on a phone.',
    here: 'Every tool that accepts an image. Before this, iPhone uploads failed with "the browser cannot open that image format", which was the single most common mobile failure.',
    note: 'Android hands you HEIF named .jpg with an image/jpeg type. Both labels lie, so format is decided by reading the file\'s magic bytes, never the name.',
  },
  {
    name: 'onnxruntime-web',
    tag: 'On-device AI',
    what: 'A runtime that executes trained machine-learning models in the browser, using WebAssembly and the GPU.',
    why: 'AI features normally mean sending your image to somebody\'s server. Running the model locally removes that entirely — and removes the per-use cost, which is what lets the feature be free rather than metered.',
    here: 'Background removal. A real image-segmentation model runs on the visitor\'s own machine, so a photograph of a person is processed without ever being uploaded. Every competitor sends this to a GPU server.',
  },
  {
    name: 'hash-wasm',
    tag: 'File fingerprints',
    what: 'Fast cryptographic hashing in WebAssembly — turning a file into a short fingerprint that changes if a single byte changes.',
    why: 'JavaScript hashing is slow enough to freeze the tab on a large file. This is fast enough to fingerprint a big PDF without the page locking up.',
    here: 'The redaction certificate. It records a fingerprint of the finished document, which the recipient can recompute themselves to prove the file they hold is the one that was certified and has not been altered since.',
  },
  {
    name: 'jsqr · qrcode',
    tag: 'QR codes',
    what: 'Two small libraries: one reads a QR code out of an image, the other generates one.',
    why: 'QR codes routinely carry a Wi-Fi password, a contact card or a payment link. Doing both directions locally means that content is never transmitted to be decoded.',
    here: 'Reading codes from a photo or a live camera frame, and generating them with custom colours, a logo and bulk export — all in the browser.',
  },
  {
    name: 'jszip',
    tag: 'Batch downloads',
    what: 'Creates a zip archive in the browser, in memory.',
    why: 'When a tool produces fifty files, the alternatives are fifty separate download prompts or a server round trip to bundle them — one is annoying, the other undoes the privacy promise.',
    here: 'Batch output. Fifty compressed PDFs arrive as one zip, assembled from files that never left the device.',
  },
  {
    name: 'mp4-muxer · webm-muxer · gifenc',
    tag: 'Video assembly',
    what: 'Muxers: they take encoded video frames and write them into a valid MP4, WebM or GIF container.',
    why: 'Modern browsers can already encode video via WebCodecs, but they cannot write the container file around it. These fill that gap, which is what makes browser-based video work possible at all.',
    here: 'Video compression, video-to-GIF and video-to-MP3. Video files are far too large to be worth uploading, so this is the difference between the tool existing and not.',
  },
];

const BACKEND: Tech[] = [
  {
    name: 'Node 22 · Express 4',
    tag: 'The API',
    what: 'Node runs JavaScript on a server; Express is the thin framework that turns it into a web API with routes and middleware.',
    why: 'Same language as the frontend, so a validation rule or a type can be shared rather than written twice in two dialects. Express is deliberately minimal — it adds routing and little else, which suits an API that should stay small.',
    here: 'About a dozen routers: conversion, OCR, auth, billing, AI and the statement engine. It holds no document state and owns no user files — work arrives, is done, and the inputs are deleted before the response finishes.',
    note: 'It runs as a pm2 CLUSTER of two. Anything per-process — a Chrome profile, an in-memory cache — must account for both, or half the requests behave differently.',
  },
  {
    name: 'PostgreSQL 16',
    tag: 'Database',
    what: 'A relational database — the durable store for anything that must survive a restart.',
    why: 'Chosen over a document store because this data is relational and money-adjacent: a user has a plan, a plan has a subscription, an expense belongs to a budget. Postgres enforces those relationships rather than trusting the application to remember them.',
    here: 'Accounts, plans, the Pro waitlist and the usage-event log. Bound to localhost, so it is unreachable except through the app. Notably it holds no documents — there is no column anywhere for a file you processed, which is what makes "we do not keep your files" checkable rather than a promise.',
  },
  {
    name: 'Redis 7',
    tag: 'Counters & limits',
    what: 'An in-memory store for short-lived values, where every key can be given an expiry.',
    why: 'Counting requests in the database would mean a write on every single call for data that is worthless tomorrow. Redis is built for exactly this, and being shared means both server processes count against one total instead of allowing double.',
    here: 'Rate limits, the 3-a-day free conversion quota, per-user and global AI spend, and the admin kill-switch that disables a single tool without a deploy. The daily quota key simply expires after 26 hours — no cleanup job needed.',
  },
  {
    name: 'jsonwebtoken · bcryptjs',
    tag: 'Auth',
    what: 'JWT issues a signed token proving who you are; bcrypt turns a password into a hash that cannot be reversed.',
    why: 'A signed token means the server can verify a session without a database lookup on every request. bcrypt is deliberately slow to compute — that is the entire point, because it makes guessing millions of stolen passwords impractical.',
    here: 'Sessions and stored passwords. Tokens last 30 days rather than 7, because a 7-day window was signing people out simply for not visiting for a week.',
  },
  {
    name: 'Stripe 22',
    tag: 'Payments',
    what: 'The payments platform handling subscriptions, the checkout page and webhook notifications.',
    why: 'Card details never touch our server or database — Stripe collects them on their own hosted page, which removes an entire category of compliance and breach risk from the product.',
    here: 'Pro subscriptions. Live keys exist only in the server environment, never in the repository, and the checkout path is written to degrade rather than fail: a stale customer record retries instead of erroring at the exact moment somebody is trying to pay.',
  },
  {
    name: 'express-rate-limit + rate-limit-redis',
    tag: 'Abuse protection',
    what: 'Counts how many requests an address has made in a window and refuses the excess.',
    why: 'Conversion costs real CPU, so without a limit one script can occupy the server and make the site unusable for everybody else. Keeping the count in Redis means both processes share one limit rather than each allowing the full amount.',
    here: 'Burst protection on the expensive routes. It fails OPEN if Redis is unreachable — an infrastructure problem must not turn into a site-wide outage.',
  },
  {
    name: 'helmet · cors · compression · morgan',
    tag: 'Middleware',
    what: 'Four small pieces: security headers, cross-origin rules, gzip compression, and request logging.',
    why: 'Each closes a default that is unsafe or wasteful. Helmet sets headers browsers use to block common attacks; CORS decides who may call the API; compression cuts response size; logging gives you something to read when it breaks.',
    here: 'Applied globally. The logs record method, path, status and timing — never request bodies, which for this product would mean logging the contents of somebody\'s document.',
  },
  {
    name: 'multer',
    tag: 'Uploads',
    what: 'Handles multipart file uploads, the format a browser uses when it posts a file.',
    why: 'Raw upload parsing is fiddly and a natural place to get size limits wrong. It also decides whether a file is held in memory or written to disk, which matters when the file is somebody\'s bank statement.',
    here: 'Configured two ways on purpose: memory where the file goes straight into a process (OCR, receipts), disk where an engine needs a real path (LibreOffice, Ghostscript). Either way the temporary copy is removed on both the success and the failure path.',
  },
  {
    name: 'puppeteer-core 24',
    tag: 'Browser control',
    what: 'A library that drives a real Chrome browser programmatically — open a page, wait for it, print it.',
    why: 'The "core" build deliberately ships no browser of its own. That lets us install Chrome from Google\'s apt repo so it receives security updates like any other package, instead of pinning a bundled copy that quietly ages.',
    here: 'Webpage → PDF. It connects to a Chrome we launched ourselves as an unprivileged user, over a socket bound to localhost.',
  },
  {
    name: 'nodemailer · bullmq · minio',
    tag: 'Mail · jobs · storage',
    what: 'Transactional email, a background job queue backed by Redis, and a client for S3-compatible object storage.',
    why: 'Email must not block a request. Long jobs belong in a queue rather than an HTTP call. And large stored files belong in object storage rather than a database.',
    here: 'Mail for password resets and receipts. The storage client is reserved for the encrypted File Vault — worth stating plainly: no conversion tool touches object storage. The vault is the only feature that stores anything, and its contents are encrypted on your device before they arrive.',
  },
];

const SERVER_ENGINES: Tech[] = [
  {
    name: 'LibreOffice 24.2',
    tag: 'Office formats',
    what: 'The full open-source office suite, run without a window — handed a file on the command line, it writes out another format.',
    why: 'It is the same program that reads and writes these formats for millions of people, so a conversion is a native export rather than a third party guessing at Microsoft\'s spec. That is why fonts, tables and layout survive instead of approximately surviving.',
    here: 'Eleven tools: Word, Excel, PowerPoint, HTML and OpenDocument into PDF, and PDF back out to Word, RTF and ODT.',
    note: 'Two hard lessons: it needs its own profile directory per run or it corrupts under concurrency, and its HTML export turns text into pictures — a real document came out as 17 words and 75 GIFs, which is why PDF → HTML runs in the browser instead.',
  },
  {
    name: 'Ghostscript 10.02',
    tag: 'PDF/A archival',
    what: 'A long-standing PostScript and PDF processor, used here purely to rewrite a PDF into the PDF/A archival profile.',
    why: 'PDF/A is a real ISO standard with strict rules — every font embedded, colour spaces defined — so a document opens identically in twenty years. Ghostscript is the only free engine that reliably produces a compliant file, which matters when a court or an archive requires the format.',
    here: 'PDF → PDF/A, and nothing else. Kept deliberately to that one job because of its licence.',
  },
  {
    name: 'Tesseract 5.3',
    tag: 'OCR',
    what: 'An optical character recognition engine: it looks at a picture of a page and works out what the words are.',
    why: 'A scan is a photograph — no text to select, search or copy. OCR is what turns it back into a document. Tesseract is Apache-2.0, so unlike most accurate OCR it can be shipped in a commercial product without a per-page fee.',
    here: 'The OCR tool, with 100+ language packs installed. We ask it for word positions rather than a finished PDF, which is what lets us lay an invisible text layer over your original pages instead of replacing them — so the file barely grows.',
  },
  {
    name: 'Google Chrome 152',
    tag: 'Page rendering',
    what: 'A real Chrome browser running without a screen, driven by code.',
    why: 'A modern web page is not a document — it is a program that assembles itself with JavaScript. Nothing short of a real browser can produce what a visitor actually sees, which is why "capture this URL" needs a browser rather than a downloader.',
    here: 'Webpage → PDF. Installed from Google\'s apt repo so it gets security updates as a normal package; Ubuntu only offers a snap shim, a poor fit for a server.',
    note: 'It runs as the unprivileged ddrender user with its sandbox INTACT — never --no-sandbox, on the one feature whose whole job is loading hostile third-party pages.',
  },
];

const PRODUCTION: Tech[] = [
  {
    name: 'Ubuntu 24.04 LTS',
    tag: 'Operating system',
    what: 'The Linux distribution the server runs. LTS means Long Term Support — five years of security updates without version changes underneath you.',
    why: 'Newer is worse here. This box runs conversion engines that break in interesting ways when a system library moves, and a five-year support window means security patches without surprise upgrades.',
    here: 'One virtual server: 4 CPUs, 15 GB RAM, 193 GB disk, running at 13%.',
    note: 'A separate project and Docker share this machine. Not ours, but it competes for the same CPU when a conversion queue builds up.',
  },
  {
    name: 'nginx 1.24',
    tag: 'Web server',
    what: 'A reverse proxy: it accepts every public request, handles the HTTPS, and passes it inward to whichever application should answer.',
    why: 'It means one hardened front door instead of three applications each exposed to the internet with their own idea of security. TLS, headers and routing are decided in one place.',
    here: 'Frontend on 3000, backend on 4000 and admin on 3100 all bind to localhost, so nothing is reachable except through the proxy.',
    note: 'The admin was the exception until it was caught: it bound to every interface, so its login answered on the raw IP and bypassed Cloudflare Access entirely.',
  },
  {
    name: 'pm2',
    tag: 'Process manager',
    what: 'Keeps Node applications running: restarts them if they crash, starts them again after a reboot, and can run several copies of one app.',
    why: 'A bare `node server.js` dies with its terminal and never comes back. It also allows clustering, so one slow conversion does not block every other request.',
    here: 'Frontend as one process, backend as a cluster of two, admin as one. The saved process list survives a reboot — which is why the admin bind fix had to go into the app\'s own start script rather than a pm2 argument.',
  },
  {
    name: 'Cloudflare',
    tag: 'Edge & DNS',
    what: 'Sits in front of the server: it answers DNS, terminates HTTPS at locations near the visitor, caches static files, and filters abusive traffic.',
    why: 'Visitors get a nearby connection instead of a trip to one box, attacks are absorbed before they arrive, and the origin address stays out of sight. Cloudflare Access adds a login in front of the admin host without any code.',
    here: 'DNS, caching, TLS, and Zero Trust on the admin host. The origin certificate is Cloudflare\'s own, valid to 2041 — it is trusted only by Cloudflare, so it can be long-lived instead of renewing every ninety days.',
    note: 'Cloudflare\'s managed robots.txt currently blocks AI crawlers site-wide. Worth a deliberate decision rather than an inherited default.',
  },
  {
    name: 'fail2ban · nftables',
    tag: 'Server hardening',
    what: 'nftables is the Linux firewall deciding which ports accept traffic. fail2ban reads the auth log and bans addresses that keep failing to log in.',
    why: 'Any server with SSH open is under constant automated password guessing within hours of existing. The firewall closes everything not needed; fail2ban makes the guessing pointless by banning the source.',
    here: 'Only 22, 80 and 443 answer publicly. fail2ban is active on SSH.',
    note: 'ufw is no longer installed but its rule chains are still loaded — the firewall is enforcing, yet there is no tool on the box to inspect or change those rules safely.',
  },
];

const INNOVATIONS = [
  {
    icon: Gauge, tint: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-500/10',
    title: 'DPI-aware compression',
    lede: 'Most compressors shrink every image to a fixed pixel cap. That cannot tell a thumbnail from a full-page photo, so it either wrecks the big one or leaves the small one fat.',
    body: [
      'We read how large each image is ACTUALLY DRAWN on the page and downsample to a target DPI. A photo shown as a 2 cm thumbnail is shrunk hard with no visible loss; the same photo shown full-page stays sharp. Text and vectors are never touched — the document stays crisp and selectable.',
      'Two paths, because scans and documents fail differently. The surgical pass (150 DPI / q74 at Recommended) handles photos on ordinary text pages and stays gentle. The scan-page rasteriser (100 DPI / q0.52) is far more aggressive and fires only when one image covers ≥70% of a page — because scanned pages are where the megabytes actually live.',
    ],
    guards: [
      ['The inflated-page-size trap', 'Some scans declare a page where 1px maps to 1pt, so the "DPI" reads as ~72 and a DPI-based target would UPSCALE the image. A second cap — a fraction of the stored pixels — is applied, and we take whichever is smaller. Never above source resolution.'],
      ['Only if it is worth it', 'A page is rasterised only when the target is ≤87% of the stored pixels. Re-encoding at the same size burns minutes and can GROW the file — JPEG 2000 beats same-resolution JPEG. "Squeeze harder" overrides this.'],
      ['Monotonic levels', 'Taking min() of both caps guarantees a stronger level always targets fewer pixels and lower quality, so Maximum can never come out larger than Recommended — which it otherwise could, and did.'],
    ],
    testing: 'Proven headlessly in Node against real files, not eyeballed. A 27 MB JPEG-2000 book at Recommended: ~58% smaller, output still crisp and readable. Competitors managed ~1% on the same file. Compression runs across a worker pool (up to 4, sized to cores and file size) with per-page watchdogs that fall back to the surgical-only result rather than hanging.',
  },
  {
    icon: FileSearch, tint: 'text-sky-600 dark:text-sky-400', bg: 'bg-sky-500/10',
    title: 'Compression you can actually see',
    lede: '"Trust us, it looks fine" is not a claim anyone should accept about their own document.',
    body: [
      'The before/after preview scores the compressed page against the original using SSIM over 8×8 windows, on a denoised pair, compared at the compressed page\'s own size. It then finds the single WORST region and shows you that crop — not a flattering one.',
      'It also reports what actually changed: source pixels → output pixels, the DPI and quality used, and whether the resolution floor was hit. If the honest answer is "this is already as small as it usefully gets", it says so instead of pretending.',
    ],
    guards: [
      ['Keep whichever is smaller', 'On a small source, "Smaller file" once produced a BIGGER file (170 KB → 180 KB). The engine now compares and keeps the smaller of the two.'],
    ],
    testing: 'Verified by measuring real byte counts before and after, including the case that produced the regression.',
  },
  {
    icon: Landmark, tint: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-500/10',
    title: 'Balance validation as a free accuracy oracle',
    lede: 'The flagship idea behind the bank statement converter, and the reason it can work on a bank we have never seen.',
    body: [
      'The balance equation — balance[i] = balance[i−1] − debit[i] + credit[i] — is treated as a SOLVABLE CONSTRAINT rather than a check. We try candidate column assignments and keep the one whose arithmetic holds down the page.',
      'One pass therefore does three jobs at once: it identifies which column is date, debit, credit and balance on an unfamiliar layout; it PROVES the extraction arithmetically; and it acts as a free accuracy oracle that decides when to escalate to AI — local first, then Haiku, and a bigger model only when the balance fails. That keeps AI cost near zero.',
    ],
    guards: [
      ['Integer paise, end to end', 'Money is never a float. Floating point and reconciliation do not belong in the same program.'],
      ['It refuses to guess', 'Handed an invoice, it returns null rather than hallucinating a statement.'],
    ],
    testing: '58 assertions. It solved a deliberately SHUFFLED-column grid with no prior knowledge; a single misread amount flags exactly one row and reports the expected balance; an invoice returns null. Bank fingerprinting adds 24 more (all 11 phase-1 banks at 0.94–0.98 confidence) plus 5 end-to-end on generated PDFs.',
  },
  {
    icon: ScanText, tint: 'text-violet-600 dark:text-violet-400', bg: 'bg-violet-500/10',
    title: 'OCR that does not bloat the file',
    lede: 'The obvious way to build searchable-PDF OCR makes the file several times larger. We do not do the obvious thing.',
    body: [
      'Pages are rasterised in the browser and streamed to the server in batches. Tesseract returns WORD BOUNDING BOXES (TSV) rather than a rendered PDF, and we overlay an invisible text layer onto the ORIGINAL pages with pdf-lib.',
      'So the original images and their compression are kept untouched — the file barely grows — and the text becomes selectable and searchable. A re-rendered output PDF would have thrown away the original encoding and ballooned.',
    ],
    guards: [
      ['Licence-clean by construction', 'Tesseract (Apache-2.0) and pdf.js only. No Ghostscript or Poppler in this path, which would drag AGPL/GPL into a commercial product.'],
    ],
    testing: 'Verified that page count, page dimensions and original image encoding survive, and that the resulting text is selectable.',
  },
  {
    icon: ShieldCheck, tint: 'text-rose-600 dark:text-rose-400', bg: 'bg-rose-500/10',
    title: 'SSRF defence for Webpage → PDF',
    lede: 'A server that renders any URL you name will happily render its own cloud metadata endpoint and hand you a picture of the result.',
    body: [
      'Blocking "localhost" by name is not the same check as any of these: a public hostname that RESOLVES to 127.0.0.1, a redirect from a public page to a private one, DNS rebinding between our check and Chrome\'s lookup, an IPv6-mapped v4 address, or a decimal/hex/octal IPv4 literal.',
      'So we validate the shape, resolve the name ourselves and reject if ANY answer is private, then re-check EVERY request Chrome actually makes. That last part is what closes the redirect and rebinding holes, because by then the address is the one really being connected to. Refusal messages deliberately reveal nothing about our network.',
    ],
    guards: [
      ['Chrome is never root', 'The backend runs as root under pm2, and Chrome disables its own sandbox as root. The usual answer is --no-sandbox; we rejected that for the one feature whose job is loading hostile pages. It runs as unprivileged ddrender via setpriv, sandbox intact, DevTools socket on loopback.'],
      ['A page that never goes quiet is still capturable', 'Waiting for network idle sounds right and is wrong: analytics, chat widgets and live feeds never go quiet, so capturable pages were being refused. We wait for the document, settle on an 8s budget, and print what is there.'],
    ],
    testing: '58 assertions covering exactly those bypasses — 169.254.169.254, the debugging port, 2130706433, 0x7f000001, ::ffff:127.0.0.1, 6to4, NAT64, and a public hostname pointing at loopback. All verified refused through the public endpoint on production.',
  },
  {
    icon: Layers, tint: 'text-indigo-600 dark:text-indigo-400', bg: 'bg-indigo-500/10',
    title: 'A bookmark outline built by hand',
    lede: 'pdf-lib has no outline API at all, so the PDF object tree is constructed directly.',
    body: [
      'An /Outlines root, one dictionary per item, each carrying Parent, Prev, Next, First, Last and a destination. The linked-list shape is the part that matters: every item points at its parent, both siblings and its first and last child, so the refs must exist before the dictionaries that mention them — hence two passes.',
      'The differentiator is the first button: it builds the whole nested outline from the document\'s OWN headings in one click, reusing the heading detection already behind PDF → Markdown so the two can never disagree.',
    ],
    guards: [
      ['Deleting a parent promotes its children', 'Losing a whole branch to one wrong click is not forgivable.'],
      ['A page past the end is clamped', 'Rather than written as a broken destination.'],
      ['Saving empty removes /PageMode too', 'Or the reader opens a panel with nothing in it.'],
    ],
    testing: '17 assertions walking the outline the way a reader does — Prev/Next/Parent agreement, nesting, unicode titles, /Count, clamping, and that rewriting replaces rather than appends. Plus 12 unit tests over the tree edits, which are pure functions.',
  },
  {
    icon: Braces, tint: 'text-teal-600 dark:text-teal-400', bg: 'bg-teal-500/10',
    title: 'The metadata trap most editors fall into',
    lede: 'A PDF can record the same facts twice, and Acrobat believes the newer copy.',
    body: [
      'There is the old Info dictionary in the trailer, and there is an XMP packet on the catalogue. When both exist, Acrobat and most modern readers believe XMP. So a tool that writes only the Info dictionary APPEARS to work — the bytes really do change — and the reader still shows the old author.',
      'We write both: strip only the properties we own out of the XMP, append one authoritative rdf:Description, and leave the rest of the packet (rights, ICC intent, edit history) intact. When a file disagrees with itself, the tool says so — that disagreement is usually why somebody came looking.',
    ],
    guards: [
      ['updateMetadata is a LOAD option', 'Passing it to save() only looks like it helps. Loading with it false is what stops pdf-lib stamping its own Producer over the user\'s.'],
      ['setKeywords joins with spaces', 'Splitting on commas silently turns "tax, 2026" into "tax 2026". Pass the whole string as one element.'],
    ],
    testing: '19 assertions, including a fixture built to disagree with itself: the stale XMP title really is replaced, unrelated XMP survives, special characters are escaped rather than injected, and pdf-lib does not stamp its own Producer.',
  },
  {
    icon: ImageIcon, tint: 'text-orange-600 dark:text-orange-400', bg: 'bg-orange-500/10',
    title: 'Never trust what a file calls itself',
    lede: 'Android hands you a HEIF image named .jpg with an image/jpeg MIME type. Both labels are lies.',
    body: [
      'Image format is decided by reading the magic bytes, not the filename or the browser-reported type. That single change fixed the "none of these images could be converted" reports from mobile users.',
      'The embed path also calls the encoder EXACTLY ONCE. An earlier probe embedded twice to measure the result and doubled every output file — caught by measuring real bytes (170,763 vs 340,759), not by looking.',
    ],
    testing: 'Byte-level verification in Node, after an earlier "verbatim" check was found to be comparing only the first 64 bytes — which are identical for every canvas JPEG and therefore proved nothing.',
  },
  {
    icon: Lock, tint: 'text-slate-600 dark:text-slate-400', bg: 'bg-slate-500/10',
    title: 'Entitlement, and a deliberate asymmetry',
    lede: 'Two gates that look similar and must behave in opposite ways when things break.',
    body: [
      'dailyQuota (3/day free → Pro unlimited) fails OPEN: infrastructure trouble must never block the free tier. requirePro fails CLOSED: an outage is not a reason to give away an expensive endpoint. Both live in one shared module so any router can use them.',
      'Usage is counted only on SUCCESS, so a failed conversion never costs somebody one of their three.',
    ],
    guards: [
      ['The client must send the token', 'The server can only see a plan it is told about. A tool that omits the Authorization header meters paying subscribers as anonymous — shipped three times before it became a build-failing test that reads the source.'],
    ],
    testing: 'A unit test asserts every component calling /api/convert/* or /api/ocr attaches the Bearer token and reads it from the right key. It found a fourth offender the moment it was written.',
  },
  {
    icon: Globe, tint: 'text-cyan-600 dark:text-cyan-400', bg: 'bg-cyan-500/10',
    title: 'A narrated capture on one connection',
    lede: 'Webpage → PDF can take half a minute, and most of it is a cold browser start. Silence reads as a hang.',
    body: [
      'The response streams one JSON line per real stage — checking, browser, opening, settling, printing — then a done sentinel, then the PDF bytes on the SAME response. One request, so it can never land on the other cluster instance and need shared state.',
      'These are stages the renderer actually reports, not a timer pretending to be progress.',
    ],
    guards: [
      ['Opt-in', 'The plain POST still returns application/pdf, so the health canary and anything else pointed at the endpoint is unaffected.'],
      ['X-Accel-Buffering: no', 'Without it nginx buffers the whole response and the narration arrives all at once at the end — worse than not sending it.'],
      ['Errors travel as a line', 'By then the status code has already gone out as 200.'],
    ],
  },
];

const PRACTICES = [
  { icon: Cpu, title: 'Everything provable runs on the device', body: 'The privacy claim is checkable: a live byte counter on every tool page counts what actually left the tab, and the Network panel confirms it. A claim you can verify beats one you have to trust.' },
  { icon: GitBranch, title: 'Headless harnesses, not eyeballing', body: 'PDF work is verified in Node against real files — compression, outlines, metadata, SSRF, image embedding. Browser testing is for the interactive layer; correctness is proven where it can be measured.' },
  { icon: Wrench, title: 'Findings become tests', body: 'Every recurring mistake becomes a check: the New chip needs a ship date, server tools must send the token, the menu must never scroll, titles ≤60 and descriptions ≤155. Each was written after being caught once.' },
  { icon: Boxes, title: 'Derived counts, never typed', body: 'Tool counts, badges and the "what runs where" split all read from one catalog. A hand-typed count drifts the day a tool ships.' },
  { icon: Sparkles, title: 'Degrade, never dead-end', body: 'Every browser gets a working path or an honest explanation. A tool that cannot run says why and points somewhere that can.' },
  { icon: Server, title: 'Cross-browser by default', body: 'The E2E matrix runs chromium, firefox, webkit, edge and mobile, with a full-route sweep on one engine covering SEO, console errors, responsiveness and accessibility.' },
];

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mt-2.5 first:mt-0">
      <p className="text-[10px] font-bold uppercase tracking-wider text-primary/70">{label}</p>
      <p className="mt-0.5 text-[13px] leading-relaxed text-foreground/85">{children}</p>
    </div>
  );
}

function Card({ t }: { t: Tech }) {
  return (
    <div className="flex flex-col rounded-xl border bg-card p-4 shadow-soft">
      <div className="mb-3 flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <p className="text-sm font-bold tracking-tight">{t.name}</p>
        <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">{t.tag}</span>
      </div>
      <Row label="What it is">{t.what}</Row>
      <Row label="Why it helps">{t.why}</Row>
      <Row label="What it does here">{t.here}</Row>
      {t.note && (
        <p className="mt-3 rounded-md border-l-2 border-amber-500/50 bg-amber-500/[0.06] py-1.5 pl-2.5 pr-2 text-[12px] leading-relaxed text-muted-foreground">
          <span className="font-semibold text-amber-700 dark:text-amber-500">Gotcha —</span> {t.note}
        </p>
      )}
    </div>
  );
}

function Group({ icon: Icon, title, sub, blurb, items }: { icon: typeof Cpu; title: string; sub: string; blurb: string; items: Tech[] }) {
  return (
    <section className="mx-auto max-w-[1200px] px-5 py-10">
      <div className="flex items-center gap-2.5">
        <span className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary"><Icon className="size-5" /></span>
        <div>
          <h2 className="text-xl font-extrabold tracking-tight sm:text-2xl">{title}</h2>
          <p className="text-sm text-muted-foreground">{sub}</p>
        </div>
      </div>
      {/* A list of names tells you what we installed. This says why the layer is
          shaped the way it is — which is the part that is hard to reconstruct
          later from the package.json alone. */}
      <p className="mt-4 max-w-3xl border-l-2 border-primary/30 pl-4 text-[14px] leading-relaxed text-foreground/80">
        {blurb}
      </p>
      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((t) => <Card key={t.name} t={t} />)}
      </div>
    </section>
  );
}

export function TechnologyContent() {
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      {/* Hero, matching /overview's treatment so this reads as the same product. */}
      <section className="relative overflow-hidden border-b border-white/10 bg-[radial-gradient(120%_140%_at_15%_0%,#241f5e_0%,#14132e_45%,#0a0a18_100%)] text-indigo-50">
        <div className="mx-auto max-w-[1200px] px-5 py-16">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider">
            <Lock className="size-3" /> Internal · owner only
          </span>
          <h1 className="mt-4 text-3xl font-extrabold tracking-tight sm:text-4xl">How DiemDesk is built</h1>
          <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-indigo-100/90">
            Every technology in the product and what it is there for, followed by the engineering
            decisions worth remembering — the compression logic, the accuracy oracle, the security
            work, and the traps that cost a day each and should never cost one again.
          </p>
          <p className="mt-4 text-xs text-indigo-200/70">
            Not indexed, not in the sitemap, not linked from anywhere. Anyone else who opens this URL goes to the home page.
          </p>
        </div>
      </section>

      <Group
        icon={Cpu} title="Frontend" sub="What the browser runs" items={FRONTEND}
        blurb="Every page is rendered on the server so search engines get real HTML, then handed to React in the browser for the part that is actually interactive. Tailwind holds one token set that drives both light and dark, so a colour is never defined in two places and can never disagree with itself. TypeScript is not decoration here: these libraries pass raw byte arrays between each other, and the types are what stop the wrong buffer reaching a font parser at three in the morning."
      />
      <div className="border-y bg-muted/20">
        <Group
          icon={Boxes} title="In-browser document engines" sub="Why most tools never upload anything" items={ENGINES}
          blurb="This row is the whole product position. Each of these is a real document engine — the same class of software a server would run — compiled to WebAssembly and executed inside the tab, on the machine that already has the file. Nothing is uploaded because nothing needs to be. It also costs us nothing per use, which is precisely why those tools can be free and unlimited forever while competitors meter theirs."
        />
      </div>
      <Group
        icon={Server} title="Backend" sub="Deliberately small — only what a browser cannot do" items={BACKEND}
        blurb="Small on purpose, and kept that way. It exists for four things a browser genuinely cannot do: visit a live web page, run a full office suite, read text off a scan, and take money. Everything else was deliberately left out, because each endpoint added is one more thing that can leak, cost or break at two in the morning. The rule is that work moves to the server only when it cannot be done on the device."
      />
      <div className="border-y bg-muted/20">
        <Group
          icon={Wrench} title="Server-side engines" sub="Installed on the box" items={SERVER_ENGINES}
          blurb="Four programs doing the heavy lifting a browser cannot. Licensing narrowed this field more than performance did: Tesseract because Apache-2.0 is clean for a commercial product, and deliberately no Ghostscript or Poppler anywhere in the OCR path, because their licences would reach into what we ship. Each one is sandboxed, given a fresh working directory, and handed nothing it does not need."
        />
      </div>
      <Group
        icon={ShieldCheck} title="Production" sub="Where it all runs" items={PRODUCTION}
        blurb="One box, doing an unglamorous amount of work for its size. Everything except nginx binds to loopback, so the only way in is through the proxy — that is the rule the admin portal was quietly breaking until it was caught. Cloudflare sits in front for TLS, caching and Zero Trust on the admin host, and the origin certificate is Cloudflare's own, which is why it runs to 2041 rather than needing renewal every ninety days."
      />

      {/* The part worth keeping: decisions, not dependencies. */}
      <section className="border-t bg-muted/20">
        <div className="mx-auto max-w-[1200px] px-5 py-14">
          <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">The engineering</p>
          <h2 className="mt-2 text-2xl font-extrabold tracking-tight sm:text-[28px]">What we did that is actually ours</h2>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted-foreground">
            Anyone can install the same libraries. These are the decisions that make the tools behave
            differently from everyone else&rsquo;s — each one written down with what it cost to learn.
          </p>

          <div className="mt-8 space-y-5">
            {INNOVATIONS.map((n) => (
              <article key={n.title} className="rounded-2xl border bg-card p-6 shadow-soft">
                <div className="flex items-start gap-3">
                  <span className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${n.bg} ${n.tint}`}>
                    <n.icon className="size-5" />
                  </span>
                  <div className="min-w-0">
                    <h3 className="text-lg font-extrabold tracking-tight">{n.title}</h3>
                    <p className="mt-1 text-sm font-medium text-muted-foreground">{n.lede}</p>
                  </div>
                </div>

                <div className="mt-4 space-y-3 sm:pl-[52px]">
                  {n.body.map((p, i) => (
                    <p key={i} className="text-[14px] leading-relaxed text-foreground/90">{p}</p>
                  ))}

                  {n.guards && (
                    <ul className="mt-4 space-y-2">
                      {n.guards.map(([label, detail]) => (
                        <li key={label} className="rounded-lg border-l-2 border-primary/40 bg-muted/40 py-2 pl-3 pr-3">
                          <p className="text-[13px] font-bold">{label}</p>
                          <p className="mt-0.5 text-[13px] leading-relaxed text-muted-foreground">{detail}</p>
                        </li>
                      ))}
                    </ul>
                  )}

                  {n.testing && (
                    <p className="mt-4 rounded-lg border border-emerald-500/30 bg-emerald-500/[0.07] px-3 py-2.5 text-[13px] leading-relaxed">
                      <span className="font-bold text-emerald-700 dark:text-emerald-400">How it was proven — </span>
                      <span className="text-foreground/90">{n.testing}</span>
                    </p>
                  )}
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-[1200px] px-5 py-14">
        <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">How we work</p>
        <h2 className="mt-2 text-2xl font-extrabold tracking-tight sm:text-[28px]">The standards behind all of it</h2>
        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {PRACTICES.map((p) => (
            <div key={p.title} className="rounded-2xl border bg-card p-5 shadow-soft">
              <span className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary"><p.icon className="size-4.5" /></span>
              <p className="mt-3 text-sm font-bold tracking-tight">{p.title}</p>
              <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">{p.body}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
