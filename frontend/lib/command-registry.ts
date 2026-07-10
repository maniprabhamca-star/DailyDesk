'use client';

import { useEffect, useReducer } from 'react';
import type { LucideIcon } from 'lucide-react';

// A tiny bridge so the current editor can publish its own commands to the global
// ⌘K palette (which lives in the layout, not inside the editor). Everything here
// is deterministic and on-device — switch a tool, jump to a page, run a regex
// redaction preset, place a saved signature. No AI, no cost. The palette merges
// these under an "In this tool" section and clears them when the editor unmounts.

export type EditorCommand = {
  id: string;
  label: string;
  hint?: string;       // small right-aligned note (e.g. "from My Library")
  keywords?: string;   // extra search terms
  icon?: LucideIcon;
  pro?: boolean;       // marks a Pro action (badge + gate handled by the palette)
  run: () => void;
};

export type EditorContext = {
  toolLabel: string;                 // e.g. "Annotate"
  commands: EditorCommand[];
  pageCount?: number;
  goToPage?: (n: number) => void;    // 1-based page number
};

let current: EditorContext | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export function setEditorContext(ctx: EditorContext) { current = ctx; emit(); }
export function clearEditorContext() { current = null; emit(); }
export function getEditorContext() { return current; }

// Subscribe a component (the palette) to context changes.
export function useEditorContext(): EditorContext | null {
  const [, force] = useReducer((x: number) => x + 1, 0);
  useEffect(() => {
    const l = () => force();
    listeners.add(l);
    return () => { listeners.delete(l); };
  }, []);
  return current;
}
