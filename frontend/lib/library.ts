'use client';

// My Library — the user's reusable elements (signatures, initials, logos, stamps,
// saved text blocks), stored ON-DEVICE in localStorage. Nothing is uploaded; this
// is the same privacy promise as the editors. Small PNG signatures are a few KB,
// so a modest cap keeps us well under the ~5 MB localStorage budget.

export type LibraryImage = { id: string; kind: 'image'; name: string; src: string; aspect: number; createdAt: number };
export type LibraryText = { id: string; kind: 'text'; name: string; text: string; family: string; size: number; color: string; bold: boolean; italic: boolean; underline: boolean; createdAt: number };
export type LibraryItem = LibraryImage | LibraryText;

const KEY = 'dd-library-v1';
const MAX_ITEMS = 60;

export function loadLibrary(): LibraryItem[] {
  if (typeof localStorage === 'undefined') return [];
  try { const raw = localStorage.getItem(KEY); const parsed = raw ? JSON.parse(raw) : []; return Array.isArray(parsed) ? parsed : []; } catch { return []; }
}

function save(items: LibraryItem[]) {
  if (typeof localStorage === 'undefined') return;
  try { localStorage.setItem(KEY, JSON.stringify(items)); } catch { /* quota — ignore, newest were kept */ }
}

// Prepend the new item (newest first), de-dupe identical images/text, cap the list.
export function addLibraryItem(item: LibraryItem): LibraryItem[] {
  const existing = loadLibrary().filter((i) => {
    if (i.kind !== item.kind) return true;
    if (i.kind === 'image' && item.kind === 'image') return i.src !== item.src;
    if (i.kind === 'text' && item.kind === 'text') return !(i.text === item.text && i.color === item.color && i.family === item.family && i.size === item.size);
    return true;
  });
  const items = [item, ...existing].slice(0, MAX_ITEMS);
  save(items);
  return items;
}

export function removeLibraryItem(id: string): LibraryItem[] {
  const items = loadLibrary().filter((i) => i.id !== id);
  save(items);
  return items;
}

export function newLibraryId(): string { return Math.random().toString(36).slice(2) + Date.now().toString(36); }
