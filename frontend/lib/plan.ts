'use client';

import { useAuth } from './auth';

// Entitlements. The plan comes from the session cached in localStorage (see
// lib/auth), so these checks work OFFLINE too. This is a SOFT gate (client-side,
// like every client-side paywall) — it stops ~99.9% of users, not a determined dev.
// We deliberately gate SCALE (large files, batch) — never compression QUALITY,
// which stays free for everyone as the acquisition hook.

export type Plan = 'free' | 'pro';

// Free plan caps single-file size; Pro is unlimited. Keep in sync with pricing copy.
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

export function usePlan(): Plan {
  const { user } = useAuth();
  if (hasOwnerCookie()) return 'pro';
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
  if (hasOwnerCookie()) return true;
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

export function fmtBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(bytes < 10 * 1024 * 1024 ? 1 : 0)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}
