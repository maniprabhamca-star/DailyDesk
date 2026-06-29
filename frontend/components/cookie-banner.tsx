'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  FileText, ArrowRight, Laptop, Lock, ShieldCheck, CloudOff, EyeOff, Ban,
} from 'lucide-react';

const ACK_KEY = 'dd_cookie_ack';

function Chip({ icon: Icon, label }: { icon: typeof CloudOff; label: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">
      <Icon className="size-3.5" strokeWidth={2.25} /> {label}
    </span>
  );
}

export function CookieBanner() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    try {
      if (!localStorage.getItem(ACK_KEY)) setShow(true);
    } catch {
      /* localStorage unavailable (private mode) — show once, can't persist */
      setShow(true);
    }
  }, []);

  if (!show) return null;

  const dismiss = () => {
    try {
      localStorage.setItem(ACK_KEY, '1');
    } catch {
      /* ignore */
    }
    setShow(false);
  };

  return (
    <div className="fixed inset-x-3 bottom-3 z-50 mx-auto max-w-3xl">
      <div className="overflow-hidden rounded-2xl border bg-card shadow-lift">
        <div className="flex flex-col md:flex-row md:items-stretch">
          {/* File → device → lock flow */}
          <div className="flex items-center justify-center gap-2.5 bg-emerald-500/10 px-4 py-3 md:justify-start md:py-4">
            <span className="flex size-9 items-center justify-center rounded-lg bg-card text-emerald-600 shadow-soft"><FileText className="size-[18px]" strokeWidth={2.25} /></span>
            <ArrowRight className="size-4 text-emerald-600" strokeWidth={2.5} />
            <span className="flex size-9 items-center justify-center rounded-lg bg-emerald-500 text-white"><Laptop className="size-[18px]" strokeWidth={2.25} /></span>
            <Lock className="size-4 text-emerald-600" strokeWidth={2.5} />
          </div>

          {/* Message */}
          <div className="flex-1 px-4 py-3.5">
            <p className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
              <ShieldCheck className="size-[18px] text-emerald-600" strokeWidth={2.25} /> All your files stay in your browser
            </p>
            <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">
              Your documents are handled on your device and never uploaded. We also use only essential cookies — no tracking, no ads, no selling your data.
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <Chip icon={CloudOff} label="0 uploads" />
              <Chip icon={EyeOff} label="No tracking" />
              <Chip icon={Ban} label="No ads" />
            </div>
          </div>

          {/* Actions — right-aligned on mobile, stacked on desktop */}
          <div className="flex items-center justify-end gap-3 px-4 pb-3.5 md:flex-col-reverse md:items-center md:justify-center md:gap-2 md:pb-0 md:pr-5">
            <Link href="/privacy" className="text-xs font-medium text-primary hover:underline">Privacy details</Link>
            <button
              onClick={dismiss}
              className="h-9 shrink-0 rounded-lg bg-foreground px-5 text-sm font-semibold text-background transition-transform active:scale-95"
            >
              Got it
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
