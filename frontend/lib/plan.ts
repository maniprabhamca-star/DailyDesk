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

export function usePlan(): Plan {
  const { user } = useAuth();
  return user?.plan === 'pro' ? 'pro' : 'free';
}

// True when a file of this size is allowed to be processed on the given plan.
export function canProcessSize(bytes: number, plan: Plan): boolean {
  return plan === 'pro' || bytes <= FREE_MAX_BYTES;
}

export function fmtBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(bytes < 10 * 1024 * 1024 ? 1 : 0)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}
