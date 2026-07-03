import Link from 'next/link';
import { ArrowRight, FlaskConical, ShieldCheck } from 'lucide-react';

// Verifiable-proof band (pre-launch social proof: a documented test result, not
// testimonials or puffery). Numbers must stay in sync with the real test on the
// /compress-pdf "Put to the test" band — keep both honest if levels are retuned.
export function ProofStrip() {
  return (
    <section className="mx-auto max-w-6xl px-4 py-5 sm:px-6">
      <div className="flex flex-col items-center gap-6 rounded-2xl bg-[#0f172a] px-6 py-7 text-slate-300 sm:flex-row sm:gap-8 sm:px-9">
        <div className="min-w-0 flex-1 text-center sm:text-left">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-medium text-emerald-300">
            <FlaskConical className="size-3.5" /> Put to the test
          </span>
          <h2 className="mt-3 text-xl font-bold tracking-tight text-white sm:text-2xl">The scans other tools give up on</h2>
          <p className="mt-2 text-sm leading-relaxed text-slate-400">
            We tested a 27 MB scanned book that big-name tools returned almost unchanged —
            DiemDesk cut it by 75%, without the file ever leaving the browser.
          </p>
          <Link href="/compress-pdf" className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-300 transition-all hover:gap-2.5">
            Try Compress PDF <ArrowRight className="size-4" />
          </Link>
        </div>
        <div className="shrink-0 text-center sm:border-l sm:border-white/10 sm:pl-8">
          <p className="flex items-baseline justify-center gap-2.5">
            <span className="text-sm text-slate-500 line-through">27.1 MB</span>
            <ArrowRight className="size-4 self-center text-slate-500" />
            <span className="text-4xl font-bold tracking-tight text-emerald-400">6.8 MB</span>
          </p>
          <p className="mt-1.5 text-sm font-semibold text-emerald-300">75% saved</p>
          <p className="mt-1 flex items-center justify-center gap-1.5 text-xs text-slate-500">
            <ShieldCheck className="size-3.5" /> Verify in your Network tab
          </p>
        </div>
      </div>
    </section>
  );
}
