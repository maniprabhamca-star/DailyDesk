'use client';

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

export function clearSession(key: string): void {
  store.delete(key); fileMeta.delete(key);
  const t = timers.get(key); if (t) { clearTimeout(t); timers.delete(key); }
  void idbDel(`${key}::file`).catch(() => {});
  void idbDel(`${key}::data`).catch(() => {});
}
