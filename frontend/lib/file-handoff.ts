'use client';

import { useEffect } from 'react';

// Pass a file from one page to another WITHOUT re-uploading. Next's <Link>/router
// navigations are client-side (SPA), so a module-level variable survives the
// route change — the PDF viewer stashes the open file here, then navigates to a
// tool which picks it up on mount. Nothing touches disk or a server; a hard
// refresh clears it (→ the target just shows its normal upload zone).
//
// ── Two things this has to get right, both found the hard way ────────────────
//
// 1. **The window has to outlast the navigation.** It was 12 seconds, measured
//    from the moment the file was stashed — before the router had even started
//    moving. The target route is code-split, so on a first visit the browser
//    still has to fetch the tool's chunk (pdf.js included) before anything can
//    claim the file. On a slow connection that is easily more than 12 seconds,
//    and the reader arrives at an empty dropzone having clicked a button that
//    promised them a form. Owner-reported on /us-forms/form-1040-x.
//
// 2. **The file has to be addressed to someone.** The short window was the only
//    thing stopping a stashed file from auto-loading into whatever tool the
//    reader happened to open next, so it could not simply be lengthened. It is
//    addressed instead: a hand-off aimed at /fill-pdf-form is invisible
//    everywhere else, and a generous window costs nothing.

/** How long a hand-off stays claimable. Long enough to cover a cold-cache chunk
 *  fetch on a slow connection; short enough that it cannot outlive the journey
 *  it belongs to. */
const WINDOW_MS = 120_000;

type Pending = { file: File; t: number; to: string | null };
let pending: Pending | null = null;
// Where and when the last hand-off was claimed. Scoped to the page that claimed
// it: "a file is still opening" is only ever true of the page opening it, and a
// global flag would have quietly suppressed the session restore on whatever
// unrelated tool the reader opened in the next few seconds.
let claimed: { at: number; path: string } | null = null;

/** Where the stashed file is addressed, if anywhere. */
function addressedHere(p: Pending): boolean {
  if (!p.to) return true; // unaddressed: any page may claim it (legacy behaviour)
  if (typeof location === 'undefined') return false;
  return location.pathname === p.to;
}

/**
 * Stash a file for the page about to be opened.
 * @param to the destination pathname, e.g. '/fill-pdf-form'. Always pass it:
 *   without it the file can be picked up by any tool the reader opens next.
 */
export function setHandoff(file: File | null, to?: string): void {
  pending = file ? { file, t: Date.now(), to: to ?? null } : null;
  claimed = null; // a new stash supersedes whatever journey came before it
}

/** Consume the handed-off file, if one is waiting for THIS page. */
export function takeHandoff(): File | null {
  const p = pending;
  if (!p) return null;
  if (Date.now() - p.t > WINDOW_MS) { pending = null; return null; }
  // Not for this page — leave it where it is, for the page it was meant for.
  if (!addressedHere(p)) return null;
  pending = null;
  claimed = { at: Date.now(), path: typeof location === 'undefined' ? '' : location.pathname };
  return p.file;
}

/**
 * True when a handed-off file is waiting for this page, or one was just claimed
 * and is still being opened.
 *
 * `useFileSession` restores the last file a tool had, on a timer, if nothing is
 * loaded yet. Loading a PDF is asynchronous — parse, render, read the fields —
 * so a hand-off that takes longer than that timer used to lose the race and the
 * reader got the PREVIOUS document instead of the one they asked for. Reproduced
 * on /us-forms/form-1040-x, which opened an I-485 from an earlier session.
 */
export function handoffInFlight(): boolean {
  if (pending && Date.now() - pending.t <= WINDOW_MS && addressedHere(pending)) return true;
  // A claim is only relevant to the page that made it; the restore it has to
  // beat fires a fraction of a second later, on that same page.
  if (!claimed) return false;
  const here = typeof location === 'undefined' ? '' : location.pathname;
  return claimed.path === here && Date.now() - claimed.at < 20_000;
}

/** Target tools call this with their own file-load function. On mount, if a file
 *  was handed off to this page, it loads straight in — skipping the upload step. */
export function useFileHandoff(load: (f: File) => void) {
  useEffect(() => {
    const f = takeHandoff();
    if (f) load(f);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
