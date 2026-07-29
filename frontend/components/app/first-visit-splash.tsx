'use client';

import { useEffect, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';

// First-visit brand reveal — Option B, the "playful build".
//
// The lifted-D mark assembles from its coloured tiles, the D pops, the wordmark
// rises, then the whole thing fades to the page. Shown ONCE to a brand-new
// visitor and never again. Guardrails, all deliberate:
//   • once only — a localStorage flag, set the instant it shows (a refresh
//     mid-animation won't replay it)
//   • home only — mounted solely on app/page.tsx, so someone landing on
//     /compress-pdf from a search result sees the tool, not a splash
//   • skippable — any tap, key, scroll or wheel dismisses it immediately
//   • never blocks — the real page is already rendered underneath; this is an
//     opaque overlay that lifts away, not a loading gate
//   • respects reduced-motion — those who ask for less motion never see it
//
// Dismiss is driven by an explicit phase ('in' → 'out' → gone) rather than
// AnimatePresence: the overlay carries no `animate` prop of its own, and without
// one AnimatePresence's exit tween never runs, leaving the overlay stuck. A
// phase we control can't get wedged.
//
// Geometry + colours mirror components/app/brand-mark.tsx exactly so the reveal
// and the header logo are the same mark.

const SEEN_KEY = 'dd-splash-seen-v1';
const HOLD_MS = 2000; // time on screen before it auto-lifts
const FADE_MS = 420;  // fade-out duration

export function FirstVisitSplash() {
  const reduce = useReducedMotion();
  const [phase, setPhase] = useState<'hidden' | 'in' | 'out'>('hidden');

  // Decide on the client only — localStorage isn't available at SSR, and the
  // overlay must never appear in server HTML or returning visitors would flash it.
  useEffect(() => {
    if (reduce) return;
    let seen = true;
    try { seen = localStorage.getItem(SEEN_KEY) === '1'; } catch { seen = true; }
    if (seen) return;
    try { localStorage.setItem(SEEN_KEY, '1'); } catch { /* private mode: still show once */ }
    setPhase('in');
  }, [reduce]);

  // While shown: arm the auto-lift timer + let any interaction skip it.
  useEffect(() => {
    if (phase !== 'in') return;
    const out = () => setPhase('out');
    const t = window.setTimeout(out, HOLD_MS);
    const opts = { passive: true } as AddEventListenerOptions;
    window.addEventListener('pointerdown', out, opts);
    window.addEventListener('keydown', out);
    window.addEventListener('wheel', out, opts);
    window.addEventListener('touchstart', out, opts);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener('pointerdown', out);
      window.removeEventListener('keydown', out);
      window.removeEventListener('wheel', out);
      window.removeEventListener('touchstart', out);
    };
  }, [phase]);

  // After the fade completes, unmount entirely.
  useEffect(() => {
    if (phase !== 'out') return;
    const t = window.setTimeout(() => setPhase('hidden'), FADE_MS);
    return () => window.clearTimeout(t);
  }, [phase]);

  if (phase === 'hidden') return null;

  const spring = { type: 'spring' as const, stiffness: 320, damping: 20 };

  return (
    <motion.div
      className="fixed inset-0 z-[200] flex flex-col items-center justify-center gap-5 bg-background"
      initial={{ opacity: 1 }}
      animate={{ opacity: phase === 'out' ? 0 : 1 }}
      transition={{ duration: FADE_MS / 1000, ease: 'easeInOut' }}
      role="presentation"
      aria-hidden="true"
    >
      <svg viewBox="0 0 48 48" className="size-24 drop-shadow-[0_12px_30px_rgba(79,70,229,0.35)]">
        {/* indigo ground */}
        <motion.rect
          width="48" height="48" rx="13.5" fill="#4F46E5"
          initial={{ opacity: 0, scale: 0.85 }} animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
          style={{ transformBox: 'fill-box', transformOrigin: 'center' }}
        />
        {/* the three colour tiles fly in and settle, staggered */}
        <motion.rect
          x="10" y="10" width="12" height="12" rx="3.5" fill="#FBBF24"
          initial={{ opacity: 0, x: -14, y: -14, scale: 0.6 }} animate={{ opacity: 1, x: 0, y: 0, scale: 1 }}
          transition={{ ...spring, delay: 0.18 }}
          style={{ transformBox: 'fill-box', transformOrigin: 'center' }}
        />
        <motion.rect
          x="10" y="26" width="12" height="12" rx="3.5" fill="#22C55E"
          initial={{ opacity: 0, x: -14, y: 14, scale: 0.6 }} animate={{ opacity: 1, x: 0, y: 0, scale: 1 }}
          transition={{ ...spring, delay: 0.3 }}
          style={{ transformBox: 'fill-box', transformOrigin: 'center' }}
        />
        <motion.rect
          x="26" y="26" width="12" height="12" rx="3.5" fill="#F87171"
          initial={{ opacity: 0, x: 14, y: 14, scale: 0.6 }} animate={{ opacity: 1, x: 0, y: 0, scale: 1 }}
          transition={{ ...spring, delay: 0.42 }}
          style={{ transformBox: 'fill-box', transformOrigin: 'center' }}
        />
        {/* the lifted D pops last, settling into its 9° tilt */}
        <motion.g
          initial={{ opacity: 0, scale: 0.4, rotate: -12 }} animate={{ opacity: 1, scale: 1, rotate: 9 }}
          transition={{ ...spring, delay: 0.6 }}
          style={{ transformBox: 'fill-box', transformOrigin: '32px 15px' }}
        >
          <rect x="24" y="7" width="16" height="16" rx="4.5" fill="#fff" />
          <path fillRule="evenodd" fill="#4F46E5" d="M28 9.5 H32.5 C35.7 9.5 37.8 12 37.8 15 C37.8 18 35.7 20.5 32.5 20.5 H28 Z M30.4 11.8 V18.2 H32.5 C34.3 18.2 35.4 16.9 35.4 15 C35.4 13.1 34.3 11.8 32.5 11.8 Z" />
        </motion.g>
      </svg>

      <motion.div
        className="flex flex-col items-center gap-1"
        initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1], delay: 0.85 }}
      >
        <span className="text-2xl font-extrabold tracking-tight text-foreground">DiemDesk</span>
        <span className="text-sm text-muted-foreground">Your files stay yours.</span>
      </motion.div>
    </motion.div>
  );
}
