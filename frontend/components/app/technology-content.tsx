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
 *   what   — a definition: the CATEGORY first, then how it differs from the
 *            thing it is usually confused with ("React is a library for X;
 *            this adds Y on top"). A definition that assumes you already know
 *            the neighbouring technology explains nothing.
 *   solves — the concrete problems it exists to solve, ENUMERATED. This was
 *            prose in an earlier version and it did not work: a reader skims a
 *            paragraph and takes away nothing they could repeat afterwards.
 *            One line per problem, each naming what goes wrong without it.
 *   here   — what it actually does in THIS product.
 */
type Tech = {
  name: string;
  tag: string;
  what: string;
  solves: string[];
  here: string;
  note?: string;
};

const FRONTEND: Tech[] = [
  {
    name: 'Next.js 14.2 (App Router)',
    tag: 'Web framework',
    what: 'An open-source, full-stack web framework built on top of React. React by itself is a library with one job — drawing the interface once it is already running in the visitor\'s browser. Next.js wraps that library in the structure a production website needs: file-based routing, server rendering, data fetching and build-time optimisation, so one project produces both the pages and the endpoints behind them.',
    solves: [
      'Poor SEO. A plain React app ships an almost empty HTML file and fills it in with JavaScript, so a crawler arrives to find a shell with no words in it. Next.js renders the finished HTML first.',
      'A slow, blank first paint. Without pre-rendering the visitor waits for a script bundle to download, parse and run before anything appears at all.',
      'Routing wired up by hand. In a plain React app every URL has to be registered with a routing library; here a file in the app folder IS the URL.',
      'Two codebases for one feature. API routes and Server Actions live beside the page that uses them, so there is no separate backend project to keep in step.',
    ],
    here: 'Every tool page is built at deploy time — the copy, the steps and the FAQ data are already in the HTML before any script runs, which is how 175 pages compete for search traffic. Only the tool itself becomes interactive afterwards.',
    note: 'Server Actions are version-stamped, so a tab left open across a deploy calls one that no longer exists. A guard catches that and reloads once instead of showing a broken tool.',
  },
  {
    name: 'React 18 · TypeScript 5',
    tag: 'UI library + type safety',
    what: 'React is a JavaScript library for building interfaces: you describe what the screen should look like for a given state, and it works out the smallest set of DOM changes needed to get there. TypeScript is not a separate language — it is JavaScript with a type layer added, checked before the code ships and then compiled away, so nothing extra reaches the browser.',
    solves: [
      'Screen-updating logic written by hand. Without React every tool needs its own "the file changed, now redraw these six things" code, and every one of them is a place to forget a case.',
      'Bugs that surface in front of a customer. A type error is caught at build time, where it costs nothing.',
      'Silent corruption between libraries. These document engines hand each other raw byte buffers with no validation of their own — pdf.js output into pdf-lib, canvas output into an encoder. Pass the wrong one and you get a quietly broken file, not an exception.',
      'Refactoring fear. Renaming something across 175 pages is a compiler job rather than a search-and-hope.',
    ],
    here: 'Every interactive surface. The types matter more here than on an ordinary site precisely because of the third point — they are the only thing standing between two libraries that will both happily accept the wrong bytes.',
  },
  {
    name: 'Tailwind CSS 3.4',
    tag: 'Styling',
    what: 'A utility-first CSS framework. Instead of writing a stylesheet of named classes and then keeping the two in sync, you compose small single-purpose utilities directly on the element, and the build deletes every utility the site never used.',
    solves: [
      'Style drift. The same brand colour ends up defined in four files with three slightly different values, and nobody knows which is authoritative.',
      'Dark mode as a second stylesheet. One token set redefined once, and every component follows automatically instead of needing its own dark variant.',
      'Stylesheets that only ever grow. Unused CSS is stripped at build, so adding pages does not add weight.',
      'Naming things. No inventing a class name for a layout that appears once.',
    ],
    here: 'One HSL token set on :root, overridden once for dark. Every colour resolves through it, so light and dark cannot disagree and no component can hard-code a shade that breaks in the other theme.',
    note: 'A colour defined only inside a dark-mode block renders transparent in light. Always define the light value first.',
  },
  {
    name: 'Radix UI',
    tag: 'Accessible components',
    what: 'A library of unstyled, accessible component primitives — dialog, dropdown, tooltip, toast. It is the opposite of a component kit like Material or Bootstrap: it ships behaviour and accessibility only, and no appearance at all, so the design is entirely ours.',
    solves: [
      'Focus management. Trapping the keyboard inside an open dialog, and returning it to the element that opened it on close.',
      'Keyboard and screen-reader support. Escape to close, arrow keys through a menu, and the aria wiring that makes a screen reader announce what just happened.',
      'Components that look right and are unusable. A hand-rolled dropdown passes a glance and fails anyone without a mouse.',
      'Fighting a design system. Because it ships no styles, nothing has to be overridden to make it ours.',
    ],
    here: 'Every dialog, dropdown and toast on the site. We supply the appearance; Radix supplies the behaviour that keyboard and screen-reader users depend on.',
  },
  {
    name: 'framer-motion 11',
    tag: 'Animation',
    what: 'A declarative animation library for React. You describe the state an element should be in and it works out the motion — as opposed to CSS keyframes or hand-written frame loops, where you script the timeline yourself.',
    solves: [
      'Animations that break when interrupted. A hand-written transition cancelled halfway leaves the element stranded; a declarative one just resolves toward the new target.',
      'Motion sickness. The operating-system reduced-motion setting is honoured everywhere rather than being remembered per animation.',
      'Layout animation. Moving an element between two positions without measuring either by hand.',
    ],
    here: 'The first-visit brand reveal and small state transitions. Reduced motion resolves to a still state rather than a faster one — "take me there", not "play a shorter film".',
    note: 'The splash is aria-hidden and role=presentation: it repeats what the page underneath already says, so a screen reader should skip it entirely.',
  },
  {
    name: 'lucide-react',
    tag: 'Icons',
    what: 'An open-source icon set — an ISC-licensed continuation of Feather — delivered as React components, so each icon is inline SVG in the page rather than an image file or a glyph in an icon font.',
    solves: [
      'Blurry icons. SVG is resolution-independent, so it stays sharp at any size on any screen.',
      'Icons that ignore the theme. Inline SVG inherits the surrounding text colour, so dark mode needs no second set of assets.',
      'Extra network requests. An icon font or sprite sheet is a separate download that blocks paint.',
      'Licence risk. ISC permits commercial use with no attribution requirement; several popular icon sets do not.',
    ],
    here: 'Every icon on the site. Imported one at a time so the build strips the rest — a page carries only the handful of glyphs it actually draws.',
  },
];

const ENGINES: Tech[] = [
  {
    name: 'pdfjs-dist 6.1',
    tag: 'Reads PDFs',
    what: 'Mozilla\'s PDF engine — the same code that displays PDFs inside Firefox — packaged to run on any web page. It parses the file and paints pages onto a canvas, and it is a reader, not a writer: it never modifies the document.',
    solves: [
      'There is no "just read the text". A PDF is a program describing where to paint marks on a page, not a document with paragraphs in it; interpreting that correctly is years of work.',
      'Image formats no browser can open. It brings its own JPEG 2000 and JBIG2 decoders, which is the only reason scanned bank statements render at all.',
      'Text without position. It returns per-word coordinates, which is what makes search, redaction, table detection and OCR overlay possible.',
      'Uploading a file just to see page one. Previews render on the device.',
    ],
    here: 'Every READ operation: page previews, rasterising pages for OCR and compression, extracting text with coordinates, and reading an existing bookmark outline.',
    note: 'A render without intent:"print" never finishes in a background tab, and an image URL from a render dies the moment the document is closed. Two silent traps.',
  },
  {
    name: 'pdf-lib 1.17',
    tag: 'Writes PDFs',
    what: 'A pure-JavaScript library that parses a PDF\'s internal object graph — pages, fonts, images, annotations — changes part of it, and writes a valid file back out. The distinction from pdf.js is the whole point: pdf.js renders a document, pdf-lib edits one.',
    solves: [
      'Destructive "editing". The naive way to change a PDF is to render every page to an image and rebuild, which throws away the text layer, the fonts and the quality.',
      'Needing a server for basic operations. Merge, split, rotate and stamp all run in the tab.',
      'Losing what you did not touch. Untouched pages come out byte-for-byte as they went in, including their original image compression.',
    ],
    here: 'Every WRITE operation: merge, split, rotate, page geometry, stamping one PDF onto another, metadata and bookmarks.',
    note: 'It has no bookmark API at all, so that tree is built by hand. And updateMetadata is a LOAD option, not a save one — passing it to save() only looks like it works.',
  },
  {
    name: '@pdf-lib/fontkit',
    tag: 'Font embedding',
    what: 'A font-parsing extension for pdf-lib. It reads TrueType and OpenType files and subsets them — extracting only the glyphs actually used — before embedding them in the document.',
    solves: [
      'Text that reflows on someone else\'s machine. An unembedded font is silently substituted with whatever the reader happens to have.',
      'Enormous output. Embedding a whole typeface costs megabytes; a subset for a page number costs a few kilobytes.',
      'Alphabets the standard PDF fonts cannot represent at all.',
    ],
    here: 'Any tool that draws text onto a page: page numbers, Bates numbering, signatures, added text.',
  },
  {
    name: 'qpdf-wasm',
    tag: 'Encrypted PDFs',
    what: 'The qpdf command-line tool compiled to WebAssembly so it runs at near-native speed inside the browser tab. Used here for one job — PDF encryption: opening a file that needs a password, and removing or applying that protection.',
    solves: [
      'Libraries that simply refuse. Most PDF tooling errors out on an encrypted file rather than asking for the password.',
      'Uploading a password. The alternative is asking somebody to send us their bank statement AND the password that opens it.',
      'A dead end at step one. Indian bank e-statements are encrypted by default, so the flagship converter would fail on its single most important input.',
    ],
    here: 'Opening password-protected PDFs on the device. The password is typed in the tab, used in the tab, and never sent anywhere.',
  },
  {
    name: '@jsquash/jpeg',
    tag: 'JPEG encoding',
    what: 'libjpeg-turbo — the standard JPEG codec that most software uses — compiled to WebAssembly, giving direct control over encoding rather than going through the browser\'s canvas export.',
    solves: [
      'Results that differ per browser. canvas.toBlob runs each browser\'s own hidden pipeline, so the same file compresses differently in Chrome and Safari.',
      'One quality slider and nothing else. Direct encoding exposes the real parameters instead of a single opaque number.',
      'Unreproducible benchmarks. A quality level means the same thing on every machine, so a measured result holds.',
    ],
    here: 'The compression engine. It is why compression is predictable rather than dependent on whose machine ran it.',
  },
  {
    name: 'libheif-js',
    tag: 'iPhone photos',
    what: 'A decoder for HEIC/HEIF — the image container Apple has used for iPhone photos since iOS 11 — compiled to WebAssembly.',
    solves: [
      'Chrome and Firefox cannot open a HEIC file at all. Without a decoder it is not a low-quality result, it is an unreadable file.',
      'The most common mobile failure there is. A photo straight from an iPhone is exactly what people try to convert on a phone.',
      'Sending a personal photo to a server to have it decoded.',
    ],
    here: 'Every tool that accepts an image. Before this, iPhone uploads failed with "the browser cannot open that image format".',
    note: 'Android hands you HEIF named .jpg with an image/jpeg type. Both labels lie, so format is decided by reading the file\'s magic bytes, never the name.',
  },
  {
    name: 'onnxruntime-web',
    tag: 'On-device AI',
    what: 'Microsoft\'s runtime for ONNX, the open interchange format that trained machine-learning models are exported to. It executes those models in the browser using WebAssembly and the GPU, rather than calling out to a hosted inference API.',
    solves: [
      'Uploading a photograph of a person in order to run AI on it.',
      'A per-use cost. No GPU server bill is what lets the feature be free rather than metered.',
      'Needing a connection. Once the model is cached it works entirely offline.',
    ],
    here: 'Background removal. A real image-segmentation model runs on the visitor\'s own machine — every competitor sends this to a GPU server.',
  },
  {
    name: 'hash-wasm',
    tag: 'File fingerprints',
    what: 'Cryptographic hash functions compiled to WebAssembly. A hash turns any file into a short fixed-length fingerprint that changes completely if a single byte changes, and cannot be worked backwards to the file.',
    solves: [
      'A frozen tab. Hashing in plain JavaScript is slow enough to lock the page on a large document.',
      '"Trust me, this is the same file." The recipient recomputes the fingerprint themselves and compares.',
    ],
    here: 'The redaction certificate. It records a fingerprint of the finished document, so anyone holding the file can prove it is the one that was certified and has not been altered since.',
  },
  {
    name: 'jsqr · qrcode',
    tag: 'QR codes',
    what: 'Two small libraries: jsQR locates and decodes a QR code inside raw image pixels; qrcode generates one from text.',
    solves: [
      'Transmitting the contents to read them. QR codes routinely carry a Wi-Fi password, a contact card or a payment link.',
      'A network round trip per frame. Local decoding is fast enough to read from a live camera feed.',
      'Plain black-and-white output. Generation here supports colours, an embedded logo and bulk export.',
    ],
    here: 'Reading codes from a photo or the camera, and generating them — all in the browser.',
  },
  {
    name: 'jszip',
    tag: 'Batch downloads',
    what: 'Creates and reads zip archives entirely in memory in the browser, with no server and no filesystem involved.',
    solves: [
      'Fifty separate download prompts when a batch job finishes.',
      'A server round trip purely to bundle files that never left the device — which would undo the privacy promise for no functional gain.',
      'Losing structure. A zip keeps the names and folders the tool produced.',
    ],
    here: 'Batch output. Fifty compressed PDFs arrive as one archive, assembled locally.',
  },
  {
    name: 'mp4-muxer · webm-muxer · gifenc',
    tag: 'Video assembly',
    what: 'Muxers, short for multiplexers: they take already-encoded video and audio frames and write them into a valid container file — MP4, WebM or GIF. They do not compress anything; they package what the encoder produced.',
    solves: [
      'The missing half of browser video. The WebCodecs API can encode frames but the platform has nothing that writes the file around them.',
      'Uploading video. These files are far too large to be worth sending anywhere, so this is the difference between the tools existing and not.',
      'A GPU server bill for work the visitor\'s own hardware encoder does for free.',
    ],
    here: 'Video compression, video-to-GIF and video-to-MP3.',
  },
];

const BACKEND: Tech[] = [
  {
    name: 'Node 22 · Express 4',
    tag: 'The API',
    what: 'Node is a runtime that executes JavaScript on a server rather than in a browser. Express is a minimal web framework layered on it: it adds URL routing and a middleware chain and deliberately very little else — unlike a batteries-included framework such as Rails or Django.',
    solves: [
      'Two languages and two dialects. A validation rule or a type is shared with the frontend instead of written twice and drifting apart.',
      'A heavyweight framework for a small API. Express adds routing and stops, which suits a backend that should stay small.',
      'Blocking on slow work. Node\'s event loop keeps many waiting requests alive on one thread instead of one thread each.',
    ],
    here: 'About a dozen routers: conversion, OCR, auth, billing, AI and the statement engine. It holds no document state — work arrives, is done, and the inputs are deleted before the response finishes.',
    note: 'It runs as a pm2 CLUSTER of two. Anything per-process — a Chrome profile, an in-memory cache — must account for both, or half the requests behave differently.',
  },
  {
    name: 'PostgreSQL 16',
    tag: 'Database',
    what: 'A relational database. Data lives in tables with relationships the database itself enforces, and every change is transactional — it either fully happens or does not happen at all. The alternative, a document store, would leave both of those to the application.',
    solves: [
      'Data that has to survive a restart, which memory and Redis do not.',
      'Money-adjacent inconsistency. A user has a plan, a plan has a subscription, an expense belongs to a budget — the database enforces those links rather than trusting the code to remember.',
      'Half-finished writes. A transaction that fails part way leaves nothing behind.',
      'Reporting. Real queries across related tables, rather than reassembling documents in application code.',
    ],
    here: 'Accounts, plans, the Pro waitlist and the usage-event log, bound to localhost. Worth stating plainly: it holds no documents. There is no column anywhere for a file you processed, which is what makes "we do not keep your files" checkable rather than a promise.',
  },
  {
    name: 'Redis 7',
    tag: 'Counters & limits',
    what: 'An in-memory key-value store. Everything lives in RAM so reads and writes are sub-millisecond, and any key can be given an expiry after which it deletes itself. It is not a replacement for the database — it is for values that are worthless tomorrow.',
    solves: [
      'A database write on every single request, for data with a one-day lifespan.',
      'Two server processes counting separately, which would quietly allow double the intended limit.',
      'Cleanup jobs. A daily quota key simply expires after 26 hours; nothing has to sweep it.',
      'Needing a deploy to switch something off. The kill-switch is a key.',
    ],
    here: 'Rate limits, the 3-a-day free conversion quota, per-user and global AI spend, and the admin kill-switch that disables one tool without a deploy.',
  },
  {
    name: 'jsonwebtoken · bcryptjs',
    tag: 'Auth',
    what: 'A JSON Web Token is a signed statement of who you are that the server can verify on its own, using a secret, without looking anything up. bcrypt is a deliberately slow one-way hash for passwords — slow being the feature, not a flaw.',
    solves: [
      'A database lookup on every request just to establish who is calling.',
      'A stolen database becoming stolen passwords. bcrypt cannot be reversed, and its cost makes guessing millions of them impractical.',
      'Being signed out for not visiting. Tokens last 30 days; a 7-day window was doing exactly that to people.',
    ],
    here: 'Sessions and stored passwords across the app and the admin portal.',
  },
  {
    name: 'Stripe 22',
    tag: 'Payments',
    what: 'A payments platform. It hosts the checkout page itself, stores the card, runs the subscription billing cycle, and notifies our server by signed webhook when anything changes.',
    solves: [
      'PCI compliance. Card details never touch our server, database or logs, which removes an entire category of breach risk.',
      'Building subscription billing. Proration, retries, failed-payment dunning, tax and invoices are all somebody else\'s problem.',
      'Trusting the browser about what somebody paid for. Entitlement comes from a signed webhook, not from what the client claims.',
    ],
    here: 'Pro subscriptions. Live keys exist only in the server environment, and the checkout path degrades rather than failing — a stale customer record retries instead of erroring at the moment somebody is trying to pay.',
  },
  {
    name: 'express-rate-limit + rate-limit-redis',
    tag: 'Abuse protection',
    what: 'Middleware that counts requests per client in a rolling window and rejects the excess. The Redis store is the important half: the counter lives outside the process rather than inside each one.',
    solves: [
      'One script occupying the CPU that everybody else\'s conversion needs.',
      'Per-process counters. Two cluster instances with local counts would each allow the full limit, giving away double.',
      'The limiter itself causing an outage. It fails OPEN if Redis is unreachable.',
    ],
    here: 'Burst protection on the expensive routes.',
  },
  {
    name: 'helmet · cors · compression · morgan',
    tag: 'Middleware',
    what: 'Four small middlewares that each close an unsafe or wasteful default: helmet sets defensive HTTP response headers, cors decides which origins may call the API, compression gzips responses, morgan logs requests.',
    solves: [
      'Unsafe browser defaults — clickjacking, MIME sniffing and referrer leakage are all opt-out, not opt-in.',
      'Any website being able to call our API using a visitor\'s credentials.',
      'Bandwidth wasted on uncompressed text responses.',
      'Having nothing to read when something breaks at two in the morning.',
    ],
    here: 'Applied globally. The logs record method, path, status and timing — never request bodies, which here would mean logging the contents of somebody\'s document.',
  },
  {
    name: 'multer',
    tag: 'Uploads',
    what: 'Middleware that parses multipart/form-data — the encoding a browser uses when it posts a file — and hands the route either an in-memory buffer or a path on disk.',
    solves: [
      'Parsing an upload stream by hand, which is exactly where size limits get quietly wrong.',
      'The memory-versus-disk decision. Holding a large scan in RAM, or writing a bank statement to disk when it never needed to be there.',
      'Leftover copies. The temporary file is removed on both the success and the failure path.',
    ],
    here: 'Configured two ways on purpose: memory where the file goes straight into a process (OCR, receipts), disk where an engine needs a real path (LibreOffice, Ghostscript).',
  },
  {
    name: 'puppeteer-core 24',
    tag: 'Browser control',
    what: 'A library that drives Chrome programmatically over its DevTools protocol — open a page, wait for it, print it. The "-core" build is the significant part: unlike full puppeteer it downloads no browser of its own.',
    solves: [
      'A bundled browser that quietly ages. Installing Chrome from Google\'s apt repo means it receives security updates like any other package.',
      'Automating a real browser with no screen attached.',
      'Guessing when a page is ready. It gives explicit control over what "loaded" means.',
    ],
    here: 'Webpage → PDF. It connects to a Chrome we launch ourselves as an unprivileged user, over a socket bound to localhost.',
  },
  {
    name: 'nodemailer · bullmq · minio',
    tag: 'Mail · jobs · storage',
    what: 'Three unrelated pieces: nodemailer sends transactional email over SMTP, BullMQ is a Redis-backed job queue for work that should outlive the request that started it, and minio is a client for S3-compatible object storage.',
    solves: [
      'An HTTP request blocked while a mail server thinks about it.',
      'Long jobs dying with the request that started them.',
      'Large binary files sitting in a database, where they do not belong.',
    ],
    here: 'Mail for password resets and receipts. The storage client is reserved for the encrypted File Vault — no conversion tool touches object storage. The vault is the only feature that stores anything, and its contents are encrypted on your device before they arrive.',
  },
];

const SERVER_ENGINES: Tech[] = [
  {
    name: 'LibreOffice 24.2',
    tag: 'Office formats',
    what: 'The complete open-source office suite, run headless — no window, invoked on the command line with an input path and an output format. It is the same program millions of people use to open these files, driven as a converter.',
    solves: [
      'Reverse-engineering Microsoft\'s formats. A conversion here is a native export by software that genuinely understands the document, not a third party guessing at the spec.',
      'Layout that only approximately survives. Fonts, tables, headers and list numbering come through because the program actually lays the document out.',
      'Per-conversion licence fees. LGPL, free to run commercially.',
    ],
    here: 'Eleven tools: Word, Excel, PowerPoint, HTML and OpenDocument into PDF, and PDF back out to Word, RTF and ODT.',
    note: 'Two hard lessons: it needs its own profile directory per run or it corrupts under concurrency, and its HTML export turns text into pictures — a real document came out as 17 words and 75 GIFs, which is why PDF → HTML runs in the browser instead.',
  },
  {
    name: 'Ghostscript 10.02',
    tag: 'PDF/A archival',
    what: 'A PostScript and PDF interpreter that has existed since 1988 and understands the format at a level almost nothing else does. Used here for exactly one job: rewriting a PDF into the PDF/A archival profile.',
    solves: [
      'PDF/A compliance. A real ISO standard requiring every font embedded and every colour space defined, so the file opens identically in twenty years.',
      'Documents a court, a regulator or an archive will actually accept.',
      'Licence reach. It is AGPL, so it is deliberately confined to this one isolated conversion and kept out of every other path.',
    ],
    here: 'PDF → PDF/A, and nothing else.',
  },
  {
    name: 'Tesseract 5.3',
    tag: 'OCR',
    what: 'An optical character recognition engine — originally HP\'s research project, open-sourced and long maintained by Google. It takes a picture of a page and returns the words in it together with the position of each one.',
    solves: [
      'A scan is a photograph. There is no text in it to select, search, copy or index until something reads it back.',
      'Per-page OCR fees. Apache-2.0 means it can ship inside a commercial product with no per-use cost, which most accurate OCR cannot.',
      'Files that triple in size. Asking for word boxes instead of a rendered PDF is what lets us overlay invisible text on the original pages.',
      'Language coverage. 100+ packs installed, including non-Latin scripts.',
    ],
    here: 'The OCR tool. We ask it for word positions rather than a finished PDF, so your original pages are kept and the file barely grows.',
  },
  {
    name: 'Google Chrome 152',
    tag: 'Page rendering',
    what: 'A full Google Chrome, installed as a normal system package and run without a screen, driven over a local socket. Not a headless rendering library — the actual browser.',
    solves: [
      'A modern web page is a program, not a document. It assembles itself with JavaScript, so nothing short of a real browser produces what a visitor genuinely sees.',
      'Web fonts, CSS grid and lazy-loaded images that a lightweight converter would approximate or miss.',
      'A stale bundled binary. Installed from apt, it patches like everything else on the box.',
    ],
    here: 'Webpage → PDF, with desktop and mobile viewports and a one-long-page option.',
    note: 'It runs as the unprivileged ddrender user with its sandbox INTACT — never --no-sandbox, on the one feature whose whole job is loading hostile third-party pages.',
  },
];

const PRODUCTION: Tech[] = [
  {
    name: 'Ubuntu 24.04 LTS',
    tag: 'Operating system',
    what: 'The Linux distribution the server runs. LTS stands for Long Term Support: five years of security patches with no version changes moving underneath you.',
    solves: [
      'Surprise upgrades. These conversion engines break in interesting ways when a system library shifts.',
      'Falling behind on security while standing still. Patches arrive without feature churn.',
      'Sourcing the engines. LibreOffice, Ghostscript, Tesseract and Chrome are each one apt install away.',
    ],
    here: 'One virtual server: 4 CPUs, 15 GB RAM, 193 GB disk, running at 13%.',
    note: 'A separate project and Docker share this machine. Not ours, but it competes for the same CPU when a conversion queue builds up.',
  },
  {
    name: 'nginx 1.24',
    tag: 'Web server',
    what: 'A reverse proxy. Every public request arrives here first: it terminates HTTPS, applies headers, and forwards inward to whichever local application should answer — so the applications themselves are never directly exposed.',
    solves: [
      'Three applications each facing the internet with their own idea of security.',
      'TLS and security headers configured in three places instead of one.',
      'Serving static files through Node, which is far slower at it than a purpose-built web server.',
    ],
    here: 'Frontend on 3000, backend on 4000 and admin on 3100 all bind to localhost, so nothing is reachable except through the proxy.',
    note: 'The admin was the exception until it was caught: it bound to every interface, so its login answered on the raw IP and bypassed Cloudflare Access entirely.',
  },
  {
    name: 'pm2',
    tag: 'Process manager',
    what: 'A process manager for Node applications. It restarts an app that crashes, brings everything back after a reboot, and can run several copies of one app behind a single port.',
    solves: [
      'A bare `node server.js` dying with its terminal and never returning.',
      'One slow conversion blocking every other request — a second worker keeps the site answering.',
      'A reboot leaving the site down until somebody notices.',
    ],
    here: 'Frontend as one process, backend as a cluster of two, admin as one. The saved process list survives a reboot — which is why the admin bind fix had to go into the app\'s own start script rather than a pm2 argument.',
  },
  {
    name: 'Cloudflare',
    tag: 'Edge & DNS',
    what: 'A network that sits in front of the origin server. It answers DNS, terminates HTTPS in a data centre near the visitor, caches static assets, filters abusive traffic, and can require a login before a request ever reaches us.',
    solves: [
      'One box in one country serving the whole world, with the latency that implies.',
      'Absorbing an attack. Traffic is filtered at the edge rather than at our front door.',
      'The origin address being public and therefore directly attackable.',
      'Building an admin login. Zero Trust Access puts one in front of the host with no application code at all.',
    ],
    here: 'DNS, caching, TLS, and Zero Trust on the admin host. The origin certificate is Cloudflare\'s own, valid to 2041 — trusted only by Cloudflare, so it can be long-lived instead of renewing every ninety days.',
    note: 'Cloudflare\'s managed robots.txt currently blocks AI crawlers site-wide. Worth a deliberate decision rather than an inherited default.',
  },
  {
    name: 'fail2ban · nftables',
    tag: 'Server hardening',
    what: 'nftables is the Linux kernel firewall — it decides which ports accept traffic at all. fail2ban is a log watcher: it reads the auth log and bans an address that keeps failing to log in.',
    solves: [
      'Constant automated password guessing, which begins within hours of a server existing.',
      'Ports open by default. Everything not needed is closed rather than merely unused.',
      'Watching logs by hand. The ban is automatic and temporary.',
    ],
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
    testing: 'Proven headlessly in Node against real files, not eyeballed. A 27 MB JPEG-2000 book at Recommended: ~58% smaller, output still crisp and readable. Competitors managed ~1% on the same file. Compression runs across a worker pool (up to 4, sized to cores and file size), guarded by two watchdogs — because a pdf.js worker given a corrupt or out-of-memory page does not throw, it simply never settles, and the tab would spin forever. 45s wraps a single page render: that page is cancelled and copied through untouched, so one bad page in a 200-page book costs one page rather than the whole job. 90s wraps opening the pool: the workers are torn down and the job falls back to the surgical-only result, which is smaller than the original just not as small.',
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
      ['Never hand back something bigger', 'Three checks at three scopes, because a "compress" button that grows a file is worse than one that does nothing. A re-encoded image replaces the original stream only if it is actually smaller. If the whole file saved under 1%, the ORIGINAL bytes are returned and the tool says "Nothing left to shrink" rather than claiming a win. And Squeeze harder compares against the result you already have — if the stronger setting cannot beat it, you keep the smaller one and are told so.'],
    ],
    testing: 'Verified by measuring real byte counts before and after at each of the three scopes.',
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
    guards: [
      ['Asking for smaller must never give you bigger', 'Re-encoding an already-small JPEG usually GROWS it: a JPEG carries a fixed cost in headers and quantisation tables that a small image has too few pixels to amortise, and flat-colour screenshots compress far better as PNG than as JPEG. On one source, "Smaller file" turned 170 KB into 180 KB. The picture is now embedded exactly as it arrived whenever the re-encode comes out larger.'],
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
    <div className="mt-3 first:mt-0">
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

      {/* The problems, as a list rather than a paragraph. Prose here reads as
          background; a list reads as reasons, and the reader can repeat one. */}
      <div className="mt-3">
        <p className="text-[10px] font-bold uppercase tracking-wider text-primary/70">What it solves</p>
        <ul className="mt-1 space-y-1.5">
          {t.solves.map((s) => (
            <li key={s} className="flex gap-2 text-[13px] leading-relaxed text-foreground/85">
              <span aria-hidden className="mt-[7px] size-1 shrink-0 rounded-full bg-primary/60" />
              <span>{s}</span>
            </li>
          ))}
        </ul>
      </div>

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
      <div className="mt-5 grid items-start gap-3 sm:grid-cols-2 lg:grid-cols-3">
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
            Every technology in the product — what it is, the problems it exists to solve, and what it
            does here — followed by the engineering decisions worth remembering: the compression logic,
            the accuracy oracle, the security work, and the traps that cost a day each and should never
            cost one again.
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
