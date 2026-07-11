'use client';

// Keep an editor's work alive across in-app navigation. The editor tools live in
// page components that unmount when you route away (e.g. jump to another tool),
// which used to wipe the loaded PDF + all edits. This module-level store survives
// unmount, so returning to the editor restores the file and edits instead of a
// blank dropzone. (It's in-memory: a full page reload still starts fresh — an
// IndexedDB layer for reload-survival can build on this later.)

export type EditorSession<T = unknown> = { file: File; data: T; savedAt: number };

const store = new Map<string, EditorSession>();

export function saveSession<T>(key: string, file: File, data: T): void {
  store.set(key, { file, data, savedAt: Date.now() });
}

export function loadSession<T>(key: string): EditorSession<T> | null {
  return (store.get(key) as EditorSession<T> | undefined) ?? null;
}

export function clearSession(key: string): void {
  store.delete(key);
}
