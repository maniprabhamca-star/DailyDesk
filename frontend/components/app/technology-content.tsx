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

type Tech = { name: string; purpose: string; note?: string };

const FRONTEND: Tech[] = [
  { name: 'Next.js 14.2 (App Router)', purpose: 'The whole site. Server-rendered pages for SEO, client components for the tools themselves.', note: 'Tool pages are static; only the interactive area hydrates.' },
  { name: 'React 18 · TypeScript 5', purpose: 'UI and type safety. Every engine boundary is typed, which is what makes the PDF libraries survivable.' },
  { name: 'Tailwind CSS 3.4', purpose: 'Styling. One token set drives light and dark, so a colour is never defined in two places.' },
  { name: 'Radix UI', purpose: 'Dialog, dropdown, toast. Accessibility primitives we would otherwise get subtly wrong.' },
  { name: 'framer-motion 11', purpose: 'The brand reveal and small state transitions. Respects prefers-reduced-motion.' },
  { name: 'lucide-react', purpose: 'Icons. ISC licensed — clean for commercial use, which not every icon set is.' },
];

const ENGINES: Tech[] = [
  { name: 'pdfjs-dist 6.1', purpose: 'Reading and rendering PDFs in the browser: previews, page rasterisation, text extraction, outlines.', note: 'Rendering needs intent:"print" or a background tab hangs forever.' },
  { name: 'pdf-lib 1.17', purpose: 'Writing PDFs: merge, split, rotate, stamp, page geometry, metadata, bookmarks.', note: 'No outline API — the bookmark tree is hand-built (see below).' },
  { name: '@pdf-lib/fontkit', purpose: 'Embedding real fonts when we add text to a page.' },
  { name: 'qpdf-wasm', purpose: 'Password-protected PDFs, decrypted on the device. Bank statements are protected by default.' },
  { name: '@jsquash/jpeg', purpose: 'JPEG encode/decode in WASM, for compression work the canvas API cannot do precisely.' },
  { name: 'libheif-js', purpose: 'HEIC/HEIF — what an iPhone actually produces. Without it, half of mobile photo uploads fail.' },
  { name: 'onnxruntime-web', purpose: 'Background removal. A real segmentation model running on the device, so the photo is never uploaded.' },
  { name: 'hash-wasm', purpose: 'File hashing for the redaction certificate and integrity checks.' },
  { name: 'jsqr · qrcode', purpose: 'Reading and writing QR codes.' },
  { name: 'jszip', purpose: 'Bundling batch output into one download.' },
  { name: 'mp4-muxer · webm-muxer · gifenc', purpose: 'Video and GIF assembly in the browser for the media tools.' },
];

const BACKEND: Tech[] = [
  { name: 'Node 22 · Express 4', purpose: 'The API. Deliberately small — it exists only for jobs a browser genuinely cannot do.' },
  { name: 'PostgreSQL 16 (pg)', purpose: 'Accounts, plans, waitlist, events. Bound to loopback only.' },
  { name: 'Redis 7 (ioredis)', purpose: 'Rate limits, daily quotas, AI spend counters, tool kill-switches.' },
  { name: 'jsonwebtoken · bcryptjs', purpose: 'Sessions and password hashing.' },
  { name: 'Stripe 22', purpose: 'Subscriptions. Live keys are set on the server only, never in the repo.' },
  { name: 'express-rate-limit + rate-limit-redis', purpose: 'Burst protection shared across both cluster instances.' },
  { name: 'helmet · cors · compression · morgan', purpose: 'Headers, origin policy, gzip, request logs.' },
  { name: 'multer', purpose: 'Upload handling for the server-side converters. Files are deleted the moment the response is sent.' },
  { name: 'puppeteer-core 24', purpose: 'Drives Chrome for Webpage → PDF. "core" means no bundled browser — we manage Chrome ourselves.' },
  { name: 'nodemailer · bullmq · minio', purpose: 'Mail, background jobs, object storage client.' },
];

const SERVER_ENGINES: Tech[] = [
  { name: 'LibreOffice 24.2', purpose: 'Office ↔ PDF, PDF → RTF/ODT, ODF → PDF. One profile directory per run, or it corrupts under concurrency.' },
  { name: 'Ghostscript 10.02', purpose: 'PDF/A archival conversion — the one job that genuinely needs it.' },
  { name: 'Tesseract 5.3', purpose: 'OCR. Apache-2.0, so licence-clean; 100+ language packs installed.' },
  { name: 'Google Chrome 152', purpose: 'Webpage → PDF. Runs unprivileged as ddrender with its sandbox intact.' },
];

const PRODUCTION: Tech[] = [
  { name: 'Ubuntu 24.04 LTS', purpose: '4 vCPU · 15 GB RAM · 193 GB disk (13% used).' },
  { name: 'nginx 1.24', purpose: 'TLS termination and reverse proxy. Everything else binds to 127.0.0.1 and is only reachable through it.' },
  { name: 'pm2', purpose: 'Process manager. Frontend fork, backend cluster of two, admin fork.' },
  { name: 'Cloudflare', purpose: 'Edge, DNS and an Origin certificate valid to 2041. Cloudflare Access protects the admin host.' },
  { name: 'fail2ban · nftables', purpose: 'SSH protection and firewall rules.' },
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

function Card({ t }: { t: Tech }) {
  return (
    <div className="rounded-xl border bg-card p-4 shadow-soft">
      <p className="text-sm font-bold tracking-tight">{t.name}</p>
      <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">{t.purpose}</p>
      {t.note && <p className="mt-2 rounded-md bg-muted/50 px-2 py-1.5 text-[12px] leading-relaxed text-muted-foreground"><span className="font-semibold">Gotcha:</span> {t.note}</p>}
    </div>
  );
}

function Group({ icon: Icon, title, sub, items }: { icon: typeof Cpu; title: string; sub: string; items: Tech[] }) {
  return (
    <section className="mx-auto max-w-[1200px] px-5 py-10">
      <div className="flex items-center gap-2.5">
        <span className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary"><Icon className="size-5" /></span>
        <div>
          <h2 className="text-xl font-extrabold tracking-tight sm:text-2xl">{title}</h2>
          <p className="text-sm text-muted-foreground">{sub}</p>
        </div>
      </div>
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

      <Group icon={Cpu} title="Frontend" sub="What the browser runs" items={FRONTEND} />
      <div className="border-y bg-muted/20">
        <Group icon={Boxes} title="In-browser document engines" sub="Why most tools never upload anything" items={ENGINES} />
      </div>
      <Group icon={Server} title="Backend" sub="Deliberately small — only what a browser cannot do" items={BACKEND} />
      <div className="border-y bg-muted/20">
        <Group icon={Wrench} title="Server-side engines" sub="Installed on the box" items={SERVER_ENGINES} />
      </div>
      <Group icon={ShieldCheck} title="Production" sub="Where it all runs" items={PRODUCTION} />

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
