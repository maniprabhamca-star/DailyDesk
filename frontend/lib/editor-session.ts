'use client';

import { useEffect, useRef, useState } from 'react';

// Keep an editor's work alive so you never lose a loaded PDF + your edits.
// Two layers, both 100% on-device (nothing is ever uploaded):
//   1. an in-memory module store — instant, survives in-app navigation.
//   2. IndexedDB — survives a full page reload / tab close / crash.
// The file bytes are written to IndexedDB once per file; the (small) edit data is
// written debounced as you work. On return we restore from memory first, then IDB.

export type EditorSession<T = unknown> = { file: File; data: T; savedAt: number };

const MAX_AGE = 7 * 24 * 60 * 60 * 1000; // forget sessions older than a week
const store = new Map<string, EditorSession>();
const fileMeta = new Map<string, { name: string; size: number }>();
const timers = new Map<string, ReturnType<typeof setTimeout>>();

// ---- minimal IndexedDB key/value ------------------------------------------
const DB_NAME = 'diemdesk-editor';
const STORE = 'sessions';
function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') { reject(new Error('no idb')); return; }
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => { if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE); };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
async function idbPut(key: string, val: unknown): Promise<void> {
  const db = await openDb();
  await new Promise<void>((res, rej) => { const tx = db.transaction(STORE, 'readwrite'); tx.objectStore(STORE).put(val, key); tx.oncomplete = () => res(); tx.onerror = () => rej(tx.error); });
  db.close();
}
async function idbGet<V>(key: string): Promise<V | undefined> {
  const db = await openDb();
  const v = await new Promise<V | undefined>((res, rej) => { const tx = db.transaction(STORE, 'readonly'); const rq = tx.objectStore(STORE).get(key); rq.onsuccess = () => res(rq.result as V); rq.onerror = () => rej(rq.error); });
  db.close();
  return v;
}
async function idbDel(key: string): Promise<void> {
  const db = await openDb();
  await new Promise<void>((res, rej) => { const tx = db.transaction(STORE, 'readwrite'); tx.objectStore(STORE).delete(key); tx.oncomplete = () => res(); tx.onerror = () => rej(tx.error); });
  db.close();
}

// ---- public API ------------------------------------------------------------
export function saveSession<T>(key: string, file: File, data: T): void {
  store.set(key, { file, data, savedAt: Date.now() });
  // Write the file bytes to IDB once per file (they don't change while editing).
  const cached = fileMeta.get(key);
  if (!cached || cached.name !== file.name || cached.size !== file.size) {
    fileMeta.set(key, { name: file.name, size: file.size });
    void file.arrayBuffer().then((bytes) => idbPut(`${key}::file`, { name: file.name, type: file.type, bytes })).catch(() => {});
  }
  // Debounce the (small) edit-data write so rapid edits coalesce into one.
  const t = timers.get(key); if (t) clearTimeout(t);
  timers.set(key, setTimeout(() => { void idbPut(`${key}::data`, { data, savedAt: Date.now() }).catch(() => {}); }, 1200));
}

// Instant, in-memory only (survives in-app navigation). Use for a synchronous peek.
export function loadSession<T>(key: string): EditorSession<T> | null {
  return (store.get(key) as EditorSession<T> | undefined) ?? null;
}

// Full restore: memory first (instant), then IndexedDB (survives reloads).
export async function loadSessionAsync<T>(key: string): Promise<EditorSession<T> | null> {
  const mem = store.get(key) as EditorSession<T> | undefined;
  if (mem) return mem;
  try {
    const [f, d] = await Promise.all([
      idbGet<{ name: string; type: string; bytes: ArrayBuffer }>(`${key}::file`),
      idbGet<{ data: T; savedAt: number }>(`${key}::data`),
    ]);
    if (f && d && d.savedAt > Date.now() - MAX_AGE) {
      const file = new File([f.bytes], f.name, { type: f.type });
      const sess: EditorSession<T> = { file, data: d.data, savedAt: d.savedAt };
      store.set(key, sess);
      fileMeta.set(key, { name: f.name, size: file.size });
      return sess;
    }
  } catch { /* IDB unavailable (private mode etc.) — fall through */ }
  return null;
}

// True when this page load should silently pick the session back up instead of
// asking: the browser discarded the tab in the background (Chrome/Edge set
// `wasDiscarded` on the forced reload) or the work is only minutes old. In both
// cases the reload wasn't the user's choice — an empty dropzone reads as data
// loss (owner-reported). Old sessions still get the polite "restore?" prompt.
export function shouldAutoRestore(savedAt: number): boolean {
  const discarded = typeof document !== 'undefined' && (document as Document & { wasDiscarded?: boolean }).wasDiscarded === true;
  return discarded || savedAt > Date.now() - 30 * 60 * 1000;
}

export function clearSession(key: string): void {
  store.delete(key); fileMeta.delete(key);
  const t = timers.get(key); if (t) { clearTimeout(t); timers.delete(key); }
  void idbDel(`${key}::file`).catch(() => {});
  void idbDel(`${key}::data`).catch(() => {});
}

// ---- file-only session for every ordinary tool -----------------------------
// The editors keep file + edit data; the other tools only need the FILE to
// survive a background-tab discard (the browser evicting an idle heavy tab —
// which looked like data loss to the owner). One line per tool:
//   useFileSession('compress', file, loadFile);
// Saves the loaded file (≤ MAX_FILE_SESSION bytes) and, on a reload that wasn't
// the user's choice, silently loads it back. A file arriving via hand-off or a
// fast user pick wins — restore only fires if nothing is loaded shortly after
// mount.
// Raised 25MB -> 100MB (2026-08-23, owner request) to match FREE_MAX_BYTES in
// lib/plan.ts — the largest file the tools will process on a free plan. The old
// cap meant a 27MB scan was accepted for compression and then silently dropped
// on reload, which is the worst combination: big enough to be worth keeping,
// too big to be kept.
//
// The cost is real but bounded: saveSession holds the file in memory as an
// ArrayBuffer while writing, so a 100MB PDF briefly doubles its footprint, and
// the write itself is async and best-effort. Browsers grant IndexedDB a large
// share of free disk, so the quota is not the binding constraint on desktop; on
// a nearly-full phone the write simply fails and is swallowed, exactly as
// before.
export const MAX_FILE_SESSION = 100 * 1024 * 1024;

export function useFileSession(
  key: string,
  file: File | null,
  load: (f: File) => void | Promise<void>,
): { name: string; run: () => void } | null {
  const fileRef = useRef<File | null>(file);
  fileRef.current = file;
  const loadRef = useRef(load);
  loadRef.current = load;
  // Offered on the dropzone when the session is too old to reload silently.
  // Without this a tool looked as though it had simply forgotten the file:
  // inside 30 minutes it came back on its own, outside it vanished with no
  // way to ask for it. Edit and Annotate already offered the choice.
  const [restorable, setRestorable] = useState<{ name: string; run: () => void } | null>(null);

  // Save whenever a (reasonably sized) file is loaded; clear on explicit unload.
  const hadFile = useRef(false);
  useEffect(() => {
    if (file) {
      hadFile.current = true;
      setRestorable(null); // a file is open; nothing left to offer
      if (file.size <= MAX_FILE_SESSION) saveSession(key, file, null);
    } else if (hadFile.current) {
      hadFile.current = false;
      clearSession(key); // the user closed the file on purpose — forget it
    }
  }, [key, file]);

  // Restore on mount if the reload wasn't the user's doing.
  useEffect(() => {
    let alive = true;
    const t = setTimeout(() => {
      void loadSessionAsync(key).then((sess) => {
        if (!alive || !sess || fileRef.current) return;
        if (shouldAutoRestore(sess.savedAt)) { void loadRef.current(sess.file); return; }
        // Too old to reload behind the reader's back — offer it instead.
        setRestorable({
          name: sess.file.name,
          run: () => { setRestorable(null); void loadRef.current(sess.file); },
        });
      });
    }, 250); // let a hand-off or instant user pick win first
    return () => { alive = false; clearTimeout(t); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return restorable;
}
