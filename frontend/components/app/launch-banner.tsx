'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Sparkles, X } from 'lucide-react';

// Top-of-page announcement strip for the free-launch period. Dismissible
// (remembered locally), links to the /free explainer. Remove when Pro launches.
export function LaunchBanner() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    setShow(localStorage.getItem('dd_launch_banner') !== 'off');
  }, []);
  if (!show) return null;

  return (
    <div className="relative bg-gradient-to-r from-primary to-indigo-600 text-white">
      <Link
        href="/free"
        className="mx-auto flex max-w-6xl items-center justify-center gap-2 px-10 py-2.5 text-center text-[13px] font-medium hover:opacity-95 sm:text-sm"
      >
        <Sparkles className="hidden size-4 shrink-0 sm:inline" />
        <span>
          <strong>DiemDesk is free for everyone during launch</strong> — every tool, worldwide, no signup.
          Pro for power users is coming soon. <span className="underline underline-offset-2">Learn more →</span>
        </span>
      </Link>
      <button
        aria-label="Dismiss announcement"
        onClick={() => { localStorage.setItem('dd_launch_banner', 'off'); setShow(false); }}
        className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-white/80 hover:bg-white/20 hover:text-white"
      >
        <X className="size-4" />
      </button>
    </div>
  );
}
