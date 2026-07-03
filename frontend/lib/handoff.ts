// In-browser file hand-off between tools — the engine behind "Keep moving".
//
// Because every DiemDesk tool runs client-side, a tool's output files are
// already in the browser. This lets one tool pass its real result files
// straight into the next tool with ZERO re-upload / re-download — something
// server-based competitors (iLovePDF, Smallpdf) can't do seamlessly.
//
// Implementation is deliberately tiny and dependency-free: a module-level
// holder. Next.js client navigation (Link / router.push) keeps the same JS
// context alive, so the files survive the route change. A hard refresh clears
// it (by design — the target tool simply shows its normal upload zone).

export type Handoff = {
  files: File[];
  from: string; // human label of the source tool, e.g. "PDF to JPG"
};

let pending: Handoff | null = null;

/** Stash files for the next tool, then navigate to it. */
export function setHandoff(h: Handoff): void {
  pending = h;
}

/** Consume the pending hand-off (clears it). Call once on the target tool's mount. */
export function takeHandoff(): Handoff | null {
  const h = pending;
  pending = null;
  return h;
}

/** Peek without consuming. */
export function hasHandoff(): boolean {
  return !!pending && pending.files.length > 0;
}
