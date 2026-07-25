'use client';

import Link from 'next/link';
import { ArrowUpRight, ShieldCheck } from 'lucide-react';

// ShowcaseWall — a MailerLite-style gallery section for the home page.
//
// MailerLite shows a dense masonry of polished email-template thumbnails on a
// dark stage; the richness IS the pitch. Ours is the same shape — a masonry of
// tall, colourful, rounded posters floating on a cinematic near-black — but each
// poster is a REAL DiemDesk capability rendered as a little product shot, and
// every card is a working link into the tool. Same grandeur, honest content.
//
// Drop-in: <ShowcaseWall /> anywhere in app/page.tsx. Fully self-contained.
// Toggle with SHOW_SHOWCASE_WALL below if you want to pull it without deleting.

export const SHOW_SHOWCASE_WALL = true;

// ---- little poster pieces --------------------------------------------------
const Bar = ({ w, c = 'rgba(255,255,255,.14)' }: { w: string; c?: string }) => (
  <div className="h-[7px] rounded-full" style={{ width: w, background: c }} />
);

function Poster({
  href, tint, eyebrow, title, children, tall, cta = 'Open',
}: {
  href: string; tint: string; eyebrow: string; title: string;
  children: React.ReactNode; tall?: boolean; cta?: string;
}) {
  return (
    <Link
      href={href}
      className="group mb-4 block break-inside-avoid overflow-hidden rounded-2xl border border-white/10 bg-[#161a24] shadow-[0_2px_4px_rgba(0,0,0,.3),0_24px_60px_-24px_rgba(0,0,0,.7)] transition-all duration-200 hover:-translate-y-1 hover:border-white/20"
    >
      {/* the visual poster */}
      <div
        className={`relative ${tall ? 'min-h-[220px]' : 'min-h-[150px]'} p-5`}
        style={{ background: `linear-gradient(160deg, ${tint}, #161a24 78%)` }}
      >
        {children}
      </div>
      {/* footer */}
      <div className="flex items-center justify-between gap-2 border-t border-white/10 px-5 py-3.5">
        <div>
          <p className="font-mono text-[10px] font-bold uppercase tracking-[0.08em] text-white/40">{eyebrow}</p>
          <p className="mt-0.5 text-[15px] font-semibold text-white">{title}</p>
        </div>
        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-white/5 text-white/60 transition-colors group-hover:bg-white/15 group-hover:text-white">
          <ArrowUpRight className="size-4" />
        </span>
      </div>
    </Link>
  );
}

export function ShowcaseWall() {
  if (!SHOW_SHOWCASE_WALL) return null;

  return (
    <section className="relative overflow-hidden bg-[#0e1017] py-20 sm:py-24">
      {/* cinematic glows */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(1100px 460px at 50% -6%, rgba(91,82,240,.28), transparent 60%), radial-gradient(720px 400px at 88% 18%, rgba(244,103,78,.12), transparent 55%)',
        }}
      />

      <div className="relative mx-auto max-w-6xl px-5">
        <div className="mx-auto max-w-2xl text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3.5 py-1.5 text-xs font-semibold text-white/70">
            <span className="size-1.5 rounded-full bg-emerald-400 shadow-[0_0_0_3px_rgba(74,222,128,.2)]" />
            67 tools · nothing uploaded
          </span>
          <h2 className="mt-5 text-3xl font-extrabold leading-[1.08] tracking-tight text-white sm:text-[42px]">
            Everything you can get done
            <br />
            <span className="bg-gradient-to-r from-amber-300 via-[#f4674e] to-[#8b83ff] bg-clip-text text-transparent">
              without your files ever leaving
            </span>
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-[15px] text-white/60 sm:text-base">
            Every tool runs on your own device. Browse a few of the things people
            reach for most — each one opens instantly, no sign-up, no upload.
          </p>
        </div>

        {/* the wall — CSS masonry, varied heights like MailerLite */}
        <div className="mt-14 columns-1 gap-4 sm:columns-2 lg:columns-3 xl:columns-4">

          {/* Compress — the showpiece (tall) */}
          <Poster href="/compress-pdf" tint="rgba(22,163,74,.20)" eyebrow="Compress PDF · real result" title="Shrink a 27 MB scan to 6.8 MB" tall cta="Compress">
            <div className="flex items-baseline gap-3">
              <span className="font-mono text-[40px] font-extrabold leading-none tracking-tight text-emerald-400">6.8<span className="text-2xl"> MB</span></span>
              <span className="font-mono text-sm text-white/35 line-through">27.1 MB</span>
            </div>
            <p className="mt-3 text-[13px] text-white/60">Rebuilt page by page. Other tools handed it back about 1% smaller.</p>
            <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/10">
              <div className="h-full w-1/4 rounded-full bg-gradient-to-r from-emerald-400 to-green-600" />
            </div>
            <p className="mt-3 font-mono text-[11px] font-bold uppercase tracking-wider text-emerald-400/80">−75% saved</p>
          </Poster>

          {/* Privacy proof */}
          <Poster href="/why-diemdesk" tint="rgba(91,82,240,.22)" eyebrow="Uploaded to us" title="Zero — and you can check" cta="See how">
            <div className="font-mono text-5xl font-extrabold leading-none text-[#8b83ff]">0<span className="text-xl"> bytes</span></div>
            <p className="mt-3 inline-flex items-center gap-1.5 text-[12px] text-white/55"><ShieldCheck className="size-3.5 text-[#8b83ff]" /> Counted live in your own tab</p>
          </Poster>

          {/* Edit PDF — mini document poster (tall) */}
          <Poster href="/edit-pdf" tint="rgba(91,82,240,.16)" eyebrow="Edit PDF" title="Change the text, keep the font" tall cta="Edit">
            <div className="rounded-lg bg-white/[0.06] p-3.5 ring-1 ring-white/10">
              <div className="mb-2 h-2.5 w-1/2 rounded bg-white/25" />
              <Bar w="92%" /><div className="mt-1.5" /><Bar w="80%" />
              <div className="mt-1.5 flex items-center gap-1.5">
                <span className="rounded bg-[#8b83ff] px-1.5 py-0.5 text-[10px] font-bold text-white">Net 45</span>
                <Bar w="40%" />
              </div>
              <div className="mt-1.5" /><Bar w="70%" />
            </div>
          </Poster>

          {/* Passport photo — photo grid */}
          <Poster href="/passport-photo" tint="rgba(8,145,178,.20)" eyebrow="Passport photo" title="45 countries, exact size" cta="Make one">
            <div className="grid grid-cols-3 gap-1.5">
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="aspect-[3/4] rounded-md bg-gradient-to-b from-cyan-400/30 to-cyan-900/30 ring-1 ring-white/10">
                  <div className="mx-auto mt-2 size-3.5 rounded-full bg-white/40" />
                  <div className="mx-auto mt-1 h-2 w-2/3 rounded-t-full bg-white/25" />
                </div>
              ))}
            </div>
          </Poster>

          {/* Redact — black bars (tall) */}
          <Poster href="/redact-pdf" tint="rgba(244,103,78,.16)" eyebrow="Redact · truly removed" title="Black it out for good" tall cta="Redact">
            <div className="rounded-lg bg-white/[0.06] p-3.5 ring-1 ring-white/10">
              <div className="mb-2 h-2.5 w-2/5 rounded bg-white/25" />
              <Bar w="88%" /><div className="mt-1.5" />
              <div className="h-[7px] w-2/5 rounded-full bg-[#111]" />
              <div className="mt-1.5" /><Bar w="76%" />
              <div className="mt-1.5 flex gap-1.5"><Bar w="30%" /><div className="h-[7px] w-1/3 rounded-full bg-[#111]" /></div>
              <div className="mt-1.5" /><Bar w="60%" />
            </div>
          </Poster>

          {/* Sign */}
          <Poster href="/sign-pdf" tint="rgba(244,103,78,.20)" eyebrow="Sign PDF" title="Draw it, drop it, done" cta="Sign">
            <div className="rounded-lg bg-white/[0.06] p-4 ring-1 ring-white/10">
              <svg viewBox="0 0 160 44" className="w-full" fill="none">
                <path d="M6 34 C 22 6, 34 6, 40 26 S 60 44, 74 20 S 96 4, 108 28 128 34 150 14" stroke="#fb8a76" strokeWidth="3" strokeLinecap="round" />
              </svg>
              <div className="mt-2 h-px w-full bg-white/20" />
              <p className="mt-1.5 font-mono text-[10px] text-white/40">signature</p>
            </div>
          </Poster>

          {/* Convert */}
          <Poster href="/pdf-to-word" tint="rgba(2,132,199,.20)" eyebrow="Convert" title="PDF ⇄ Word, Excel, JPG" cta="Convert">
            <div className="flex items-center gap-3">
              <span className="flex size-12 items-center justify-center rounded-xl bg-rose-500/20 text-lg font-bold text-rose-300 ring-1 ring-white/10">PDF</span>
              <span className="text-2xl text-white/40">→</span>
              <span className="flex size-12 items-center justify-center rounded-xl bg-sky-500/20 text-lg font-bold text-sky-300 ring-1 ring-white/10">DOC</span>
            </div>
          </Poster>

          {/* PDF to Excel — table (tall) */}
          <Poster href="/pdf-to-excel" tint="rgba(22,163,74,.14)" eyebrow="PDF to Excel" title="Tables out, spreadsheet in" tall cta="Extract">
            <div className="overflow-hidden rounded-lg ring-1 ring-white/10">
              {[0, 1, 2, 3].map((r) => (
                <div key={r} className={`grid grid-cols-3 ${r === 0 ? 'bg-emerald-500/25' : 'bg-white/[0.05]'} `}>
                  {[0, 1, 2].map((c) => (
                    <div key={c} className="border-b border-r border-white/10 px-2 py-1.5">
                      <div className="h-2 rounded" style={{ width: `${50 + ((r + c) % 3) * 18}%`, background: r === 0 ? 'rgba(255,255,255,.5)' : 'rgba(255,255,255,.22)' }} />
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </Poster>

          {/* Developer pack — code */}
          <Poster href="/developer-tools" tint="rgba(124,58,237,.20)" eyebrow="Developer pack · 16 tools" title="JSON, Base64, JWT, hash…" cta="Open pack">
            <div className="rounded-lg bg-black/40 p-3 font-mono text-[11px] leading-relaxed ring-1 ring-white/10">
              <div><span className="text-violet-300">const</span> <span className="text-white/80">out</span> = <span className="text-emerald-300">format</span>(json);</div>
              <div className="text-white/40">{'{ "clean": true,'}</div>
              <div className="text-white/40">{'  "indent": 2 }'}</div>
            </div>
          </Poster>

          {/* Chat with PDF (tall) */}
          <Poster href="/chat-pdf" tint="rgba(124,58,237,.16)" eyebrow="AI · Chat with PDF" title="Ask your document anything" tall cta="Try it">
            <div className="space-y-2">
              <div className="ml-auto w-4/5 rounded-2xl rounded-tr-sm bg-white/10 px-3 py-2 text-[12px] text-white/70">What&rsquo;s the notice period in clause 6?</div>
              <div className="w-4/5 rounded-2xl rounded-tl-sm bg-violet-500/25 px-3 py-2 text-[12px] text-white/85">Ninety days&rsquo; written notice <span className="rounded bg-white/15 px-1 text-[10px]">p.4</span></div>
            </div>
          </Poster>

          {/* Merge — stacking pages */}
          <Poster href="/merge-pdf" tint="rgba(220,38,38,.18)" eyebrow="Merge PDF" title="Many files, one clean PDF" cta="Merge">
            <div className="relative h-20">
              {[0, 1, 2].map((i) => (
                <div key={i} className="absolute h-16 w-12 rounded-md bg-white/[0.08] ring-1 ring-white/15" style={{ left: `${i * 22}px`, top: `${i * 6}px`, transform: `rotate(${(i - 1) * 5}deg)` }}>
                  <div className="mt-2 space-y-1 px-1.5"><Bar w="80%" /><Bar w="60%" /><Bar w="70%" /></div>
                </div>
              ))}
            </div>
          </Poster>

          {/* QR */}
          <Poster href="/qr-code-generator" tint="rgba(245,158,11,.16)" eyebrow="QR code" title="Wi-Fi, links, vCards" cta="Generate">
            <div className="grid grid-cols-5 gap-1">
              {[1,0,1,1,0, 0,1,1,0,1, 1,1,0,1,1, 0,1,1,0,0, 1,0,1,1,1].map((v, i) => (
                <div key={i} className={`aspect-square rounded-[3px] ${v ? 'bg-amber-300' : 'bg-white/[0.06]'}`} />
              ))}
            </div>
          </Poster>

        </div>

        {/* footer CTA */}
        <div className="mt-12 flex flex-col items-center gap-3">
          <Link
            href="/tools"
            className="inline-flex items-center gap-2 rounded-xl bg-white px-6 py-3 text-[15px] font-bold text-[#0e1017] shadow-lg transition-transform hover:scale-[1.02]"
          >
            Browse all 67 tools <ArrowUpRight className="size-4" />
          </Link>
          <p className="text-[13px] text-white/45">Free · no account · nothing uploaded for in-browser tools</p>
        </div>
      </div>
    </section>
  );
}
