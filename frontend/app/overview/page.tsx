import type { Metadata } from 'next';
import Link from 'next/link';
import { ShieldCheck, Zap, Target, Check, ArrowRight, Sparkles, Lock } from 'lucide-react';
import { SiteHeader } from '@/components/app/site-header';
import { SiteFooter } from '@/components/app/site-footer';
import { BrandMark } from '@/components/app/brand-mark';
import { Button } from '@/components/ui/button';
import { catalog, PRO_TOOLS, liveToolCount } from '@/components/app/catalog';
import { PRICING } from '@/lib/pricing';

export const metadata: Metadata = {
  title: 'The DiemDesk toolkit — private, on-device document tools',
  description:
    "See everything DiemDesk does: 35 tools live today across 9 categories, most running 100% on your device. What runs where, and what is free vs Pro.",
  alternates: { canonical: '/overview' },
  openGraph: {
    images: ['/og.png'],
    title: 'The DiemDesk toolkit — at a glance',
    description: 'What runs on your device, what’s free vs Pro, and the Pro moat — all in one view.',
    type: 'website',
  },
};

// Live counts, derived from the single catalog source so this page never drifts.
const ALL = catalog.flatMap((g) => g.tools);
const TOTAL = ALL.length;
const LIVE = liveToolCount; // tools actually available now (home shows this too)
const ON_DEVICE = ALL.filter((t) => t.badge === 'device').length;
const SERVER_AI = TOTAL - ON_DEVICE;

const MOATS = [
  {
    icon: ShieldCheck, tint: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-500/10',
    name: 'Privacy', sub: 'Provable, not promised',
    body: 'The everyday tools open and rebuild your file on your device — nothing is uploaded, stored, scanned or trainable. Competitors process everything on their servers.',
    vs: 'The proof: open DevTools → Network. Zero requests. You can’t fake that.',
  },
  {
    icon: Zap, tint: 'text-primary', bg: 'bg-primary/10',
    name: 'Convenience', sub: 'One private workspace',
    body: 'PDF, image, QR, video & utilities in one place — no ads, no signup, no watermark, no daily wall on in-browser tools. Chain tools into saved workflows instead of hopping sites.',
    vs: 'The feel: a premium app, not a single-purpose upload form with ads.',
  },
  {
    icon: Target, tint: 'text-orange-500', bg: 'bg-orange-500/10',
    name: 'Determinism', sub: 'The answer to “why not just AI?”',
    body: 'Real tools give the same exact result every time — no hallucinations, no “regenerate.” AI is embedded as a feature, not the product you’re betting your document on.',
    vs: 'The trust: a redaction you can verify, a signature you can prove.',
  },
];

const DIFFS: { name: string; desc: string; moat: string; flag?: boolean }[] = [
  { name: 'On-device batch', desc: "Process 100 files at once — zero uploads. Rivals upload everything; they can't match private bulk.", moat: 'Privacy', flag: true },
  { name: 'Redaction certificate', desc: "Signed, exportable proof a document was truly scrubbed — 0 recoverable characters. A legal/compliance wedge.", moat: 'Determinism', flag: true },
  { name: 'Saved workflows', desc: "A one-click document assembly line — merge · clean · sign · share-safe · compress — run on a whole batch.", moat: 'Convenience', flag: true },
  { name: 'Encrypted File Vault', desc: "Zero-knowledge storage (Argon2 + AES-256). Even we can't read it — rivals' storage is server-readable.", moat: 'Privacy', flag: true },
  { name: 'Self-destruct shares', desc: "Expiring, password-locked share links DiemDesk itself can't decrypt.", moat: 'Privacy' },
  { name: 'Certificate of completion', desc: "DocuSign-style signed audit trail + verification hash for e-signatures.", moat: 'Determinism' },
  { name: 'Bates numbering', desc: "Legal page-stamping — a standard paid feature that pulls in the legal vertical.", moat: 'Convenience' },
  { name: 'Brand kit', desc: "Save logo / header-footer / watermark once, apply across a whole batch.", moat: 'Convenience' },
  { name: 'Offline PWA', desc: "Install it; works fully offline. Server-first rivals go dark without a connection.", moat: 'Convenience' },
  { name: 'True re-encode Edit', desc: "Higher-fidelity in-place text-editing tier for Pro.", moat: 'Determinism' },
];

// runtime badge for a tool row
function runtime(badge: string) {
  if (badge === 'device') return { label: 'on device', cls: 'text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/30' };
  if (badge === 'server') return { label: 'server', cls: 'text-orange-600 dark:text-orange-400 bg-orange-500/10 border-orange-500/30' };
  if (badge === 'ai') return { label: 'AI', cls: 'text-fuchsia-600 dark:text-fuchsia-400 bg-fuchsia-500/10 border-fuchsia-500/30' };
  return { label: 'vault', cls: 'text-blue-600 dark:text-blue-400 bg-blue-500/10 border-blue-500/30' };
}

export default function OverviewPage() {
  return (
    <>
      <SiteHeader />
      <main>
        {/* HERO — committed dark brand band */}
        <section className="relative overflow-hidden border-b border-white/10 bg-[radial-gradient(120%_140%_at_15%_0%,#241f5e_0%,#14132e_45%,#0a0a18_100%)] text-indigo-50">
          <div className="mx-auto max-w-[1400px] px-5 py-14 sm:py-20">
            <div className="mb-7 flex items-center gap-2.5">
              <BrandMark className="size-9" />
              <span className="text-lg font-semibold tracking-tight text-white">DiemDesk</span>
            </div>
            <p className="text-[11.5px] font-bold uppercase tracking-[0.16em] text-indigo-300">The whole toolkit, at a glance</p>
            <h1 className="mt-2.5 max-w-[17ch] text-4xl font-extrabold leading-[1.08] tracking-tight text-white sm:text-5xl">Every document job — right on your device.</h1>
            <p className="mt-5 max-w-[60ch] text-base leading-relaxed text-indigo-200 sm:text-lg">
              A complete document toolkit — PDF, image, video &amp; utilities — where the everyday tools run{' '}
              <span className="font-semibold text-indigo-100">100% in your browser</span>. Private by architecture, not by promise. Free where it costs us nothing; Pro where it earns its keep.
            </p>
            <div className="mt-8 flex flex-wrap gap-x-9 gap-y-5">
              {[
                { n: LIVE, l: `live today · ${TOTAL} on the roadmap` },
                { n: ON_DEVICE, l: 'run on your device' },
                { n: SERVER_AI, l: 'use our server or AI' },
                { n: '$5', l: 'Pro/mo billed yearly · founding $4.99' },
              ].map((s) => (
                <div key={s.l}>
                  <div className="text-2xl font-extrabold tabular-nums text-white sm:text-3xl">{s.n}</div>
                  <div className="mt-1 text-xs text-indigo-300">{s.l}</div>
                </div>
              ))}
            </div>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild size="lg"><Link href="/">Open the tools <ArrowRight className="size-4" /></Link></Button>
              <Button asChild size="lg" variant="outline" className="border-white/25 bg-white/5 text-white hover:bg-white/10 hover:text-white"><Link href="/pricing">See pricing</Link></Button>
            </div>
          </div>
        </section>

        {/* MOATS */}
        <section className="mx-auto max-w-[1400px] px-5 py-14">
          <p className="text-[11.5px] font-bold uppercase tracking-[0.14em] text-primary">Why DiemDesk wins</p>
          <h2 className="mt-2 text-2xl font-extrabold tracking-tight sm:text-[26px]">Three moats competitors can’t cross</h2>
          <p className="mt-2 max-w-[62ch] text-sm text-muted-foreground">The online tools from iLovePDF, Smallpdf and Adobe are <span className="font-medium text-foreground">server-first</span> — every file uploads to them. DiemDesk is <span className="font-medium text-foreground">device-first</span>. That one choice creates advantages they’d have to rebuild their stack to match.</p>
          <div className="mt-7 grid gap-4 md:grid-cols-3">
            {MOATS.map((m) => (
              <div key={m.name} className="rounded-2xl border bg-card p-5 shadow-soft">
                <span className={`mb-3 flex size-10 items-center justify-center rounded-xl ${m.bg} ${m.tint}`}><m.icon className="size-5" /></span>
                <h3 className="text-base font-semibold">{m.name}</h3>
                <p className="text-xs font-medium text-muted-foreground">{m.sub}</p>
                <p className="mt-3 text-[13px] leading-relaxed text-muted-foreground">{m.body}</p>
                <p className="mt-3 border-t border-dashed pt-3 text-[11.5px] text-muted-foreground"><span className="font-semibold text-foreground">{m.vs.split(':')[0]}:</span>{m.vs.slice(m.vs.indexOf(':') + 1)}</p>
              </div>
            ))}
          </div>
        </section>

        {/* TOOL GRID (data-driven) */}
        <section className="border-y bg-muted/20">
          <div className="mx-auto max-w-[1400px] px-5 py-14">
            <p className="text-[11.5px] font-bold uppercase tracking-[0.14em] text-primary">What runs where</p>
            <h2 className="mt-2 text-2xl font-extrabold tracking-tight sm:text-[26px]">{TOTAL} tools · {ON_DEVICE} on your device</h2>
            <p className="mt-2 max-w-[62ch] text-sm text-muted-foreground">The green <span className="font-medium text-foreground">on device</span> badge means it runs in your browser — free &amp; unlimited, forever. Server-side Office conversions are 3 free a day, then Pro. Tools tagged <span className="font-medium text-foreground">coming soon</span> aren’t live yet — {LIVE} of the {TOTAL} are available today.</p>
            {/* legend */}
            <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-[11px] text-muted-foreground">
              <span className="inline-flex items-center gap-1.5"><span className="size-2 rounded-full bg-emerald-500" /> live</span>
              <span className="inline-flex items-center gap-1.5"><span className="size-2 rounded-full bg-amber-500" /> coming soon</span>
              <span className="inline-flex items-center gap-1.5"><span className="rounded border border-emerald-500/30 bg-emerald-500/10 px-1.5 py-px font-semibold text-emerald-600 dark:text-emerald-400">on device</span> free &amp; unlimited</span>
              <span className="inline-flex items-center gap-1.5"><span className="rounded-full bg-gradient-to-r from-amber-500 to-orange-500 px-1.5 py-px text-[9px] font-bold uppercase text-white">3/day</span> free daily → Pro unlimited</span>
              <span className="inline-flex items-center gap-1.5"><span className="rounded-full bg-gradient-to-r from-amber-500 to-orange-500 px-1.5 py-px text-[9px] font-bold uppercase text-white">Pro</span> paid plan</span>
            </div>

            <div className="mt-6 grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
              {catalog.map((g) => (
                <div key={g.label} className="overflow-hidden rounded-2xl border bg-card shadow-soft">
                  <div className="flex items-center gap-2 border-b bg-muted/20 px-4 py-2.5">
                    <span className="size-2.5 rounded" style={{ backgroundColor: g.color }} />
                    <span className="text-sm font-semibold">{g.label}</span>
                    <span className="ml-auto text-[11px] font-medium tabular-nums text-muted-foreground">{g.tools.filter((t) => t.href && !t.soon).length}/{g.tools.length} live</span>
                  </div>
                  <ul className="p-2">
                    {g.tools.map((t) => {
                      const live = !!t.href && !t.soon;
                      const rt = runtime(t.badge);
                      const isPro = PRO_TOOLS.has(t.name);
                      const isOfficeConv = t.badge === 'server' && (g.label === 'Convert to PDF' || g.label === 'Convert from PDF');
                      return (
                        <li key={t.name} className="flex items-center gap-2 rounded-lg px-2 py-1.5">
                          <span className={`size-2 shrink-0 rounded-full ${live ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                          <span className={`min-w-0 flex-1 truncate text-[13px] ${live ? '' : 'text-muted-foreground'}`}>{t.name}</span>
                          <span className={`shrink-0 rounded border px-1.5 py-px text-[9.5px] font-semibold ${rt.cls}`}>{rt.label}</span>
                          {isOfficeConv && <span className="shrink-0 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 px-1.5 py-px text-[9px] font-bold uppercase text-white">3/day</span>}
                          {isPro && <span className="shrink-0 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 px-1.5 py-px text-[9px] font-bold uppercase text-white">Pro</span>}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* FREE VS PRO (from PRICING source) */}
        <section className="mx-auto max-w-[1400px] px-5 py-14">
          <p className="text-[11.5px] font-bold uppercase tracking-[0.14em] text-primary">The model</p>
          <h2 className="mt-2 text-2xl font-extrabold tracking-tight sm:text-[26px]">Free where it costs us nothing. Pro where it earns its keep.</h2>
          <div className="mt-7 grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border bg-card p-6 shadow-soft">
              <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Free · forever</div>
              <div className="mt-1 text-3xl font-extrabold tracking-tight">$0</div>
              <div className="text-xs text-muted-foreground">No signup, no card, no catch.</div>
              <ul className="mt-4 space-y-2">
                {PRICING.freeFeatures.map((f) => (
                  <li key={f} className="flex gap-2.5 text-[13px]"><Check className="mt-0.5 size-4 shrink-0 text-emerald-500" /><span>{f}</span></li>
                ))}
              </ul>
            </div>
            <div className="relative rounded-2xl border-2 border-primary bg-gradient-to-b from-primary/[0.06] to-transparent p-6 shadow-soft">
              <span className="absolute -top-3 right-5 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white shadow-sm">Pro</span>
              <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Pro · power users &amp; business</div>
              <div className="mt-1 text-3xl font-extrabold tracking-tight">${PRICING.pro.monthly}<span className="text-sm font-semibold text-muted-foreground">/mo</span></div>
              <div className="text-xs text-muted-foreground">or ${PRICING.pro.annualPerMonth}/mo billed yearly (${'60'}/yr). First 1,000 founding members lock $4.99/mo for life.</div>
              <ul className="mt-4 space-y-2">
                {PRICING.proFeatures.map((f) => (
                  <li key={f} className="flex gap-2.5 text-[13px]"><Check className="mt-0.5 size-4 shrink-0 text-primary" /><span>{f}</span></li>
                ))}
              </ul>
            </div>
          </div>
          <p className="mt-4 flex items-start gap-2 rounded-xl border border-orange-500/25 bg-orange-500/[0.06] px-4 py-3 text-[12.5px] text-muted-foreground">
            <Lock className="mt-0.5 size-4 shrink-0 text-orange-500" />
            <span>The in-browser tools stay free &amp; unlimited — they run on your device. Only the few server tools (Office conversions, OCR, AI) are metered: <span className="font-medium text-foreground">3 free Office conversions a day</span>, then Pro removes the cap.</span>
          </p>
        </section>

        {/* PRO DIFFERENTIATORS */}
        <section className="border-y bg-muted/20">
          <div className="mx-auto max-w-[1400px] px-5 py-14">
            <p className="text-[11.5px] font-bold uppercase tracking-[0.14em] text-primary">The Pro moat</p>
            <h2 className="mt-2 text-2xl font-extrabold tracking-tight sm:text-[26px]">Pro features rivals structurally can’t copy</h2>
            <p className="mt-2 max-w-[62ch] text-sm text-muted-foreground">Built for professionals with sensitive, repetitive documents — legal, HR, accounting, healthcare, agencies. Each leans on the device-first architecture. ★ = flagship.</p>
            <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {DIFFS.map((d) => (
                <div key={d.name} className={`rounded-xl border bg-card p-4 shadow-soft ${d.flag ? 'border-amber-500/50' : ''}`}>
                  <div className="flex items-center gap-1.5">
                    {d.flag && <Sparkles className="size-3.5 shrink-0 text-orange-500" />}
                    <span className="text-sm font-semibold">{d.name}</span>
                    {d.flag && <span className="ml-auto shrink-0 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white">★ flagship</span>}
                  </div>
                  <p className="mt-1.5 text-[12px] leading-relaxed text-muted-foreground">{d.desc}</p>
                  <p className="mt-2 text-[9.5px] font-bold uppercase tracking-wide text-muted-foreground/70">{d.moat}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* END TO END */}
        <section className="mx-auto max-w-[1400px] px-5 py-14">
          <p className="text-[11.5px] font-bold uppercase tracking-[0.14em] text-primary">End to end</p>
          <h2 className="mt-2 text-2xl font-extrabold tracking-tight sm:text-[26px]">How the in-browser tools actually work</h2>
          <p className="mt-2 max-w-[62ch] text-sm text-muted-foreground">No magic — just modern browsers. WebAssembly runs real document engines on your machine, so the file never leaves.</p>
          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { n: 1, h: 'You drop a file', p: 'Read straight into the tab’s memory — never sent anywhere.' },
              { n: 2, h: 'Your device does the work', p: 'WASM engines (pdf-lib, ffmpeg, codecs) process it locally, on your CPU.' },
              { n: 3, h: 'You get the result', p: 'Built in-memory and downloaded — still nothing uploaded.' },
              { n: 4, h: 'Nothing left behind', p: 'Close the tab and it’s gone. No account, no server copy, no trace.' },
            ].map((s) => (
              <div key={s.n} className="rounded-xl border bg-card p-4 shadow-soft">
                <span className="flex size-6 items-center justify-center rounded-lg bg-primary text-xs font-bold text-primary-foreground">{s.n}</span>
                <h4 className="mt-2.5 text-[13.5px] font-semibold">{s.h}</h4>
                <p className="mt-1 text-[11.5px] leading-relaxed text-muted-foreground">{s.p}</p>
              </div>
            ))}
          </div>
          <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-l-[3px] border-orange-500 bg-card px-4 py-3 text-[12.5px] text-muted-foreground shadow-soft">
            <ShieldCheck className="mt-0.5 size-4 shrink-0 text-orange-500" />
            <span><span className="font-semibold text-foreground">The honest exception:</span> a few tools genuinely need a server — Office conversions, OCR (they can’t run in a browser), and AI. For those we say so up front, send over an encrypted connection, and <span className="font-medium text-foreground">delete your file the moment it’s done</span> — never stored, never read.</span>
          </div>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild size="lg"><Link href="/">Start using DiemDesk <ArrowRight className="size-4" /></Link></Button>
            <Button asChild size="lg" variant="outline"><Link href="/pricing">Compare Free &amp; Pro</Link></Button>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
