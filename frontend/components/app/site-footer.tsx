import Link from 'next/link';
import { ShieldCheck, Apple, Play, MapPin, Lock, EyeOff } from 'lucide-react';
import { BrandMark } from '@/components/app/brand-mark';

// Preview toggle: a server started with NEXT_PUBLIC_FOOTER_WM=mono renders the
// footer watermark in grayscale so we can compare colorful vs monochrome.
const FOOTER_WM_MONO = process.env.NEXT_PUBLIC_FOOTER_WM === 'mono';

const COLUMNS = [
  { title: 'Tools', color: '#a78bfa', links: [
    { label: 'Compress PDF', href: '/compress-pdf' },
    { label: 'Merge PDF', href: '/merge-pdf' },
    { label: 'QR generator', href: '/qr-code-generator' },
    { label: 'All tools', href: '/#tools' },
  ] },
  { title: 'Product', color: '#2dd4bf', links: [
    { label: 'Overview', href: '/overview' },
    { label: 'Free during launch', href: '/free' },
    { label: 'Pricing', href: '/pricing' },
    { label: 'Compare', href: '/compare' },
    { label: 'Feedback', href: '/feedback' },
    { label: 'Get started', href: '/register' },
    { label: 'Log in', href: '/login' },
  ] },
  { title: 'Legal', color: '#fbbf24', links: [
    { label: 'About', href: '/about' },
    { label: 'Privacy', href: '/privacy' },
    { label: 'Security', href: '/security' },
    { label: 'Terms', href: '/terms' },
    { label: 'Refunds', href: '/refund-policy' },
  ] },
];

const PILLS = [
  { icon: MapPin, label: 'Made in the USA' },
  { icon: Lock, label: 'AES-256 encryption' },
  { icon: EyeOff, label: 'No tracking' },
];

/** Shared dark anchor footer — used across the marketing/content surface (home, tool pages, legal, pricing). */
export function SiteFooter() {
  return (
    <footer className="relative overflow-hidden border-t border-white/10 bg-[#0f172a] text-slate-300">
      <div className="relative z-10 mx-auto max-w-6xl px-4 pb-5 pt-9 sm:px-6">
        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-[1.6fr_1fr_1fr_1fr]">
          <div>
            <Link href="/" className="flex items-center gap-2.5">
              <BrandMark className="size-8" />
              <span className="text-lg font-semibold tracking-tight text-white">DiemDesk</span>
            </Link>
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-slate-400">
              Every tool you reach for — private, fast, and free. Your files never leave your device.
            </p>
            <span className="mt-5 inline-flex items-center gap-1.5 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-medium text-emerald-300">
              <ShieldCheck className="size-3.5" /> Private by design
            </span>
            {/* App badges — custom "coming soon" (honest; swap for real store badges at launch) */}
            <div className="mt-4 flex flex-wrap gap-2.5">
              {[
                { Icon: Apple, name: 'App Store' },
                { Icon: Play, name: 'Google Play' },
              ].map((b) => (
                <span key={b.name} className="inline-flex items-center gap-2.5 rounded-xl border border-white/15 bg-white/5 px-3.5 py-2 transition-colors hover:bg-white/10">
                  <b.Icon className="size-6 text-white" />
                  <span className="leading-tight">
                    <span className="block text-[9px] uppercase tracking-wide text-slate-400">Coming soon</span>
                    <span className="block text-[13px] font-semibold text-white">{b.name}</span>
                  </span>
                </span>
              ))}
            </div>
          </div>
          {COLUMNS.map((col) => (
            <div key={col.title}>
              <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-white">
                <span className="size-1.5 rounded-full" style={{ backgroundColor: col.color }} /> {col.title}
              </p>
              <ul className="mt-4 space-y-2.5 text-sm">
                {col.links.map((l) => (
                  <li key={l.label}><Link href={l.href} className="font-medium text-slate-400 transition-colors hover:text-white">{l.label}</Link></li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        {/* Trust pills */}
        <div className="mt-7 flex flex-wrap gap-2">
          {PILLS.map((t) => (
            <span key={t.label} className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] font-medium text-slate-300">
              <t.icon className="size-3.5" /> {t.label}
            </span>
          ))}
        </div>
        {/* Background brand mark — desktop flourish, bleeds off the bottom-right corner
            (cropped by the footer's overflow-hidden). lg-only so it never crosses the
            taller stacked bar on small screens. */}
        <div aria-hidden className={`pointer-events-none absolute -bottom-14 -right-10 -z-10 hidden lg:block ${FOOTER_WM_MONO ? 'opacity-[0.10] grayscale' : 'opacity-[0.08]'}`}>
          <BrandMark className="size-[320px]" />
        </div>
        <div className="mt-7 flex flex-col items-center justify-between gap-3 border-t border-white/10 pt-6 text-xs text-slate-500 sm:flex-row">
          <p>© {new Date().getFullYear()} DiemDesk · Private preview</p>
          <p className="flex items-center gap-2 text-emerald-300">
            <span className="relative flex size-2"><span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-60" /><span className="relative inline-flex size-2 rounded-full bg-emerald-400" /></span>
            In-browser tools never upload your files — verify in the Network tab
          </p>
        </div>
      </div>
    </footer>
  );
}
