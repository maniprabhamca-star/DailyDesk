'use client';

import { useEffect, useState } from 'react';
import { useAuth } from './auth';

// Entitlements. The plan comes from the session cached in localStorage (see
// lib/auth), so these checks work OFFLINE too. This is a SOFT gate (client-side,
// like every client-side paywall) — it stops ~99.9% of users, not a determined dev.
// We deliberately gate SCALE (large files, batch) — never compression QUALITY,
// which stays free for everyone as the acquisition hook.

export type Plan = 'free' | 'pro';

// Free plan caps single-file size for the client-side tools; Pro is unlimited.
// 100 MB free is a deliberate acquisition lever (beats every competitor's free
// tier) and costs us nothing since these tools run in the browser. The real
// server-cost lever is OCR, which sets its OWN tighter 20 MB free cap in
// ocr-tool.tsx (OCR_FREE_MAX) — independent of this. Keep in sync with pricing.
export const FREE_MAX_BYTES = 100 * 1024 * 1024; // 100 MB

// Emails that are treated as Pro regardless of billing — e.g. the owner's own
// account, so large-file processing works before Stripe is wired. Soft
// client-side, like every gate here; matched case-insensitively.
const PRO_EMAILS = ['maniprabhamca@gmail.com', 'mrmanigandan@gmail.com'];

// The owner's private-preview bypass cookie (see nginx dd-admin-bypass.conf) also
// unlocks Pro on the client, so the owner gets unlimited size WITHOUT app login —
// the same cookie that skips the gate lifts the size cap. Only the owner has it.
function hasOwnerCookie(): boolean {
  return typeof document !== 'undefined' && /(?:^|;\s*)ddadmin=[^;]+/.test(document.cookie);
}

function isLocalPreviewHost(): boolean {
  if (typeof window === 'undefined') return false;
  return window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
}

function useOwnerBypass(): boolean {
  const [enabled, setEnabled] = useState(false);
  useEffect(() => {
    setEnabled(hasOwnerCookie() || isLocalPreviewHost());
  }, []);
  return enabled;
}

export function usePlan(): Plan {
  const { user } = useAuth();
  const ownerBypass = useOwnerBypass();
  if (ownerBypass) return 'pro';
  if (!user) return 'free';
  if (user.plan === 'pro') return 'pro';
  if (user.email && PRO_EMAILS.includes(user.email.trim().toLowerCase())) return 'pro';
  return 'free';
}

// True only for the OWNER (ddadmin bypass cookie, or a PRO_EMAILS account). Used
// to let the owner see/test tools that are hidden from the public (coming_soon /
// disabled via the admin tool-flags) — build tools privately, launch later.
export function useIsOwner(): boolean {
  const { user } = useAuth();
  const ownerBypass = useOwnerBypass();
  if (ownerBypass) return true;
  if (user?.email && PRO_EMAILS.includes(user.email.trim().toLowerCase())) return true;
  return false;
}

// True when a file of this size is allowed to be processed on the given plan.
export function canProcessSize(bytes: number, plan: Plan): boolean {
  return plan === 'pro' || bytes <= FREE_MAX_BYTES;
}

// Batch = running a tool over MANY files at once (many files -> many outputs),
// e.g. compress 50 PDFs in one action. Free does one file per job; Pro batches.
// IMPORTANT: tools whose whole purpose is multi-input -> ONE output (Merge,
// JPG->PDF) are a single job, NOT batch — they must NOT call this gate.
export const FREE_MAX_BATCH = 1;

// True when this many files may be processed in one batch job on the given plan.
export function canBatch(count: number, plan: Plan): boolean {
  return plan === 'pro' || count <= FREE_MAX_BATCH;
}

// How many of `count` files this plan may process in one batch (the rest need Pro).
export function allowedBatchCount(count: number, plan: Plan): number {
  return plan === 'pro' ? count : Math.min(count, FREE_MAX_BATCH);
}

// ---- Physical browser capacity (device RAM) — NOT a paywall --------------
// This limit is independent of plan: it's the hard ceiling of processing ON the
// device. A tool must hold the input + the decoded/working data + the output in
// the tab's memory at once (a heavy re-encode/render needs ~3x the file size in
// RAM; a light structural op ~1.5x), and a single ArrayBuffer maxes out near 2 GB
// in today's browsers — so even a 64 GB desktop can't process an arbitrarily large
// file in one tab. We use this to WARN before a huge file crashes the tab, never
// to gate a sale (Pro doesn't lift a law of physics).
const AB_HARD_CAP = 2 * 1024 * 1024 * 1024; // ~single-ArrayBuffer / wasm32 ceiling

// Chrome/Edge expose approximate device RAM in GB (coarse buckets, capped at 8);
// other browsers don't, so assume a middle-of-the-road 4 GB.
export function deviceMemoryGB(): number {
  if (typeof navigator === 'undefined') return 4;
  const dm = (navigator as unknown as { deviceMemory?: number }).deviceMemory;
  return typeof dm === 'number' && dm > 0 ? dm : 4;
}

export type OpWeight = 'light' | 'heavy';

// Largest input this device can process on-device before the tab is likely to run
// out of memory. ~60% of reported RAM is a realistic working budget for one tab
// (the rest is the OS, the browser, other tabs), divided by the op's memory factor.
export function browserSafeMaxBytes(weight: OpWeight = 'heavy'): number {
  const budget = deviceMemoryGB() * 0.6 * 1024 * 1024 * 1024;
  const perFile = budget / (weight === 'heavy' ? 3 : 1.5);
  return Math.min(Math.floor(perFile), AB_HARD_CAP);
}

// True when a file is big enough that in-browser processing will very likely fail
// on this device — the signal to show the graceful "too large" guard.
export function exceedsBrowserCapacity(bytes: number, weight: OpWeight = 'heavy'): boolean {
  return bytes > browserSafeMaxBytes(weight);
}

export function fmtBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(bytes < 10 * 1024 * 1024 ? 1 : 0)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}
