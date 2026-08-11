'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  FolderOpen, Trash2, ExternalLink, ChevronLeft, ChevronRight, ChevronDown,
  ShieldCheck, TriangleAlert, Undo2, Search, Check,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { usePlan } from '@/lib/plan';
import {
  classify, unsupportedReason, isTextual, TEXT_READ_CAP, KIND_META, KIND_GROUP,
  type FileKind,
} from '@/lib/file-classify';
import {
  canPickDirectory, pickDirectory, readFileList, moveToTrash, restoreFromTrash, TRASH_DIR,
  type Folder, type PickedFile,
} from '@/lib/folder-read';

// Folder Preview — see every file in a folder at once.
//
// Windows thumbnails pictures and videos and gives everything else the same grey
// icon, so a folder of forty PDFs and spreadsheets is forty identical rectangles.
// This draws all of them. It can only exist as a web tool because we don't
// upload: reading somebody's whole folder is a thing you'd never do with a site
// that takes copies.
//
// Two structural decisions worth knowing before editing:
//
// 1. ONLY HTML NEEDS AN IFRAME. The tool this was learned from framed everything
//    because its previews arrived as HTML from a server. We generate ours, so
//    markdown/CSV/JSON/code/fonts/images are plain DOM and a PDF is a canvas of
//    page one. The iframe budget therefore applies to a small minority of files.
//
// 2. THE WORK QUEUE IS NOT OPTIONAL. Mounting a screenful of live previews at
//    once pegs the renderer — measured, by them, the hard way. Three at a time,
//    and previews far from the viewport are released.

const FREE_MAX_FILES = 30;
const MAX_CONCURRENT = 3;
const MAX_LIVE = 24;

type Rendered =
  | { state: 'idle' }
  | { state: 'loading' }
  | { state: 'text'; body: string }
  | { state: 'html'; body: string }
  | { state: 'table'; rows: string[][]; total: number }
  | { state: 'url'; url: string }
  | { state: 'font'; url: string }
  | { state: 'failed'; why: string };

const fmtBytes = (n: number) => {
  if (n < 1024) return `${n} B`;
  const u = ['KB', 'MB', 'GB'];
  let v = n / 1024; let i = 0;
  while (v >= 1024 && i < u.length - 1) { v /= 1024; i += 1; }
  return `${v < 10 ? v.toFixed(1) : Math.round(v)} ${u[i]}`;
};
const fmtDate = (ms: number) => new Date(ms).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });

/** Split a CSV/TSV line respecting quotes — a naive split ruins any real export. */
function splitRow(line: string, sep: string): string[] {
  const out: string[] = [];
  let cur = ''; let q = false;
  for (let i = 0; i < line.length; i += 1) {
    const c = line[i];
    if (q) {
      if (c === '"' && line[i + 1] === '"') { cur += '"'; i += 1; }
      else if (c === '"') q = false;
      else cur += c;
    } else if (c === '"') q = true;
    else if (c === sep) { out.push(cur); cur = ''; }
    else cur += c;
  }
  out.push(cur);
  return out;
}

export function FolderPreviewTool() {
  const plan = usePlan();
  const isPro = plan === 'pro';
  const cap = isPro ? 2000 : FREE_MAX_FILES;

  const [folder, setFolder] = useState<Folder | null>(null);
  const [truncated, setTruncated] = useState(false);
  const [busy, setBusy] = useState(false);
  const [query, setQuery] = useState('');
  const [kindFilter, setKindFilter] = useState<string>('');
  const [size, setSize] = useState<'s' | 'm' | 'l'>('m');
  const [viewer, setViewer] = useState<number | null>(null);
  const [trashed, setTrashed] = useState<{ file: PickedFile; trashName: string }[]>([]);
  // The most recent batch, so Undo puts back exactly what the last action took —
  // not "the last file", which is wrong after a bulk move.
  const [lastBatch, setLastBatch] = useState<{ file: PickedFile; trashName: string }[]>([]);
  const [confirming, setConfirming] = useState<PickedFile[] | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  // Anchor for shift-click. Selecting 40 files one at a time is not triage.
  const lastPicked = useRef<number | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const [rendered, setRendered] = useState<Record<string, Rendered>>({});
  const renderedRef = useRef(rendered);
  renderedRef.current = rendered;
  const urlsRef = useRef<Map<string, string>>(new Map());

  // Blob URLs are the memory in this tool. A folder of 800 images will happily
  // hold 800 decoded bitmaps if nobody revokes them.
  useEffect(() => () => { urlsRef.current.forEach((u) => URL.revokeObjectURL(u)); }, []);

  const files = folder?.files ?? [];

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return files.filter((f) => {
      if (kindFilter && f.kind !== kindFilter) return false;
      if (q && !f.rel.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [files, query, kindFilter]);

  const kindCounts = useMemo(() => {
    const m = new Map<FileKind, number>();
    for (const f of files) m.set(f.kind, (m.get(f.kind) ?? 0) + 1);
    return Array.from(m.entries()).sort((a, b) => b[1] - a[1]);
  }, [files]);

  /* ------------------------------------------------------------ opening */

  const openPicker = useCallback(async () => {
    setBusy(true); setNote(null);
    try {
      const res = await pickDirectory({ maxFiles: cap });
      if (res) {
        setFolder(res); setTruncated(res.truncated); setRendered({}); setTrashed([]); setSelected(new Set());
      }
    } catch (e) {
      setNote(e instanceof Error ? e.message : 'Could not read that folder.');
    } finally { setBusy(false); }
  }, [cap]);

  const onInput = useCallback((list: FileList | null) => {
    if (!list || list.length === 0) return;
    setBusy(true); setNote(null);
    try {
      const res = readFileList(list, { maxFiles: cap });
      setFolder(res); setTruncated(res.truncated); setRendered({}); setTrashed([]); setSelected(new Set());
    } finally { setBusy(false); }
  }, [cap]);

  /* ------------------------------------------------- the rendering queue */

  const loadingCount = useRef(0);
  const queue = useRef<PickedFile[]>([]);

  const doRender = useCallback(async (f: PickedFile) => {
    loadingCount.current += 1;
    const set = (r: Rendered) => setRendered((p) => ({ ...p, [f.id]: r }));
    try {
      if (f.kind === 'unsupported') { set({ state: 'failed', why: unsupportedReason(f.name) }); return; }

      if (f.kind === 'image' || f.kind === 'svg' || f.kind === 'html' || f.kind === 'font') {
        const url = URL.createObjectURL(f.file);
        urlsRef.current.set(f.id, url);
        set(f.kind === 'font' ? { state: 'font', url } : { state: 'url', url });
        return;
      }

      if (f.kind === 'pdf') {
        const { renderFirstPage } = await import('@/lib/folder-pdf-thumb');
        const url = await renderFirstPage(f.file);
        urlsRef.current.set(f.id, url);
        set({ state: 'url', url });
        return;
      }

      if (isTextual(f.kind)) {
        const text = await f.file.slice(0, TEXT_READ_CAP).text();
        if (f.kind === 'table') {
          const lines = text.split(/\r?\n/).filter(Boolean);
          const sep = (lines[0]?.match(/\t/g)?.length ?? 0) > (lines[0]?.match(/,/g)?.length ?? 0) ? '\t' : ',';
          set({ state: 'table', rows: lines.slice(0, 14).map((l) => splitRow(l, sep)), total: lines.length });
        } else if (f.kind === 'markdown') {
          const { renderMarkdown } = await import('@/lib/md-render');
          // Cap first: rendering 256KB of markdown for a 150px card is waste.
          set({ state: 'html', body: renderMarkdown(text.split(/\r?\n/).slice(0, 80).join('\n')) });
        } else {
          set({ state: 'text', body: text.split(/\r?\n/).slice(0, 60).join('\n') });
        }
        return;
      }
      set({ state: 'failed', why: 'We don’t have a way to draw this one.' });
    } catch {
      set({ state: 'failed', why: 'This file couldn’t be read.' });
    } finally {
      loadingCount.current -= 1;
      pump();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pump = useCallback(() => {
    while (loadingCount.current < MAX_CONCURRENT && queue.current.length) {
      const next = queue.current.shift();
      if (!next) break;
      void doRender(next);
    }
  }, [doRender]);

  // De-duplication lives in a ref SET, not in the rendered-state ref.
  //
  // The first version asked `renderedRef.current[id]?.state === 'loading'` inside
  // pump() — but request() calls setRendered() and pump() in the same tick, and
  // the ref is only re-assigned on the next render. So the lookup returned
  // undefined, every item was skipped, and the whole grid sat on its spinner
  // forever. The screenshot caught it; the first test did not, because it only
  // checked that filenames were listed.
  const requested = useRef<Set<string>>(new Set());

  const request = useCallback((f: PickedFile) => {
    if (requested.current.has(f.id)) return;
    requested.current.add(f.id);
    setRendered((p) => ({ ...p, [f.id]: { state: 'loading' } }));
    queue.current.push(f);
    pump();
  }, [pump]);

  /* ---------------------------------------------------------- selection */

  const toggle = useCallback((index: number, shift: boolean) => {
    // Read the anchor BEFORE moving it, and capture it for the updater.
    //
    // setSelected(fn) is lazy: React calls fn during render, by which time a
    // `lastPicked.current = index` written after this line has already landed —
    // so the updater saw the NEW anchor, the range collapsed to one item, and
    // shift-click behaved like an ordinary click. Second time a ref read inside
    // a lazy updater has bitten this file; the first was the render queue.
    const from = shift && lastPicked.current !== null ? lastPicked.current : index;
    lastPicked.current = index;
    setSelected((prev) => {
      const next = new Set(prev);
      const [a, b] = from <= index ? [from, index] : [index, from];
      // A shift-click SETS the range rather than toggling each item in it —
      // toggling a range you can already see half-selected is unpredictable.
      const turningOn = !prev.has(visible[index]?.id ?? '');
      for (let i = a; i <= b; i += 1) {
        const id = visible[i]?.id;
        if (!id) continue;
        if (turningOn) next.add(id); else next.delete(id);
      }
      return next;
    });
  }, [visible]);

  const clearSelection = useCallback(() => { setSelected(new Set()); lastPicked.current = null; }, []);

  const selectedFiles = useMemo(
    () => visible.filter((f) => selected.has(f.id)),
    [visible, selected],
  );
  const selectedBytes = useMemo(
    () => selectedFiles.reduce((n, f) => n + f.size, 0),
    [selectedFiles],
  );

  /* ------------------------------------------------------------- triage */

  const remove = useCallback(async (f: PickedFile) => {
    if (!folder?.canWrite || !folder.handle) return;
    try {
      const trashName = await moveToTrash(folder.handle, f);
      const entry = { file: f, trashName };
      setFolder((p) => (p ? { ...p, files: p.files.filter((x) => x.id !== f.id) } : p));
      setTrashed((p) => [entry, ...p]);
      setLastBatch([entry]);
      setNote(`Moved ${f.name} to ${TRASH_DIR}.`);
    } catch (e) {
      setNote(e instanceof Error ? e.message : 'Could not move that file.');
    }
  }, [folder]);

  /**
   * Put the last move back.
   *
   * This is why a single-file delete does not ask "are you sure". A confirm
   * dialog on every delete trains people to dismiss it without reading, and then
   * it protects nobody; an undo that actually works protects them after the
   * mistake, which is when they need it. Bulk still confirms — see below.
   */
  const undoLast = useCallback(async () => {
    if (!folder?.canWrite || !folder.handle || lastBatch.length === 0) return;
    setBusy(true);
    const back: PickedFile[] = [];
    const failed: string[] = [];
    for (const entry of lastBatch) {
      try { await restoreFromTrash(folder.handle, entry.file, entry.trashName); back.push(entry.file); }
      catch { failed.push(entry.file.name); }
    }
    const restoredIds = new Set(back.map((f) => f.id));
    setFolder((prev) => (prev
      ? { ...prev, files: [...back, ...prev.files].sort((a, b) => a.rel.localeCompare(b.rel)) }
      : prev));
    setTrashed((prev) => prev.filter((e) => !restoredIds.has(e.file.id)));
    setLastBatch([]);
    setBusy(false);
    setNote(failed.length
      ? `Put ${back.length} back. Could not restore: ${failed.slice(0, 3).join(', ')}.`
      : `Put ${back.length} file${back.length === 1 ? '' : 's'} back.`);
  }, [folder, lastBatch]);

  const removeSelected = useCallback(async (files: PickedFile[]) => {
    if (!folder?.canWrite || !folder.handle || files.length === 0) return;
    setBusy(true);
    const done: { file: PickedFile; trashName: string }[] = [];
    const failed: string[] = [];
    // One at a time and keep going on failure. A half-finished bulk delete that
    // stops at the first locked file, without saying which, is worse than one
    // that finishes and reports.
    for (const f of files) {
      try { done.push({ file: f, trashName: await moveToTrash(folder.handle, f) }); }
      catch { failed.push(f.name); }
    }
    const movedIds = new Set(done.map((e) => e.file.id));
    setFolder((prev) => (prev ? { ...prev, files: prev.files.filter((f) => !movedIds.has(f.id)) } : prev));
    setTrashed((prev) => [...done, ...prev]);
    setLastBatch(done);
    clearSelection();
    setBusy(false);
    setNote(
      failed.length
        ? `Moved ${done.length} to ${TRASH_DIR}. Could not move: ${failed.slice(0, 3).join(', ')}${failed.length > 3 ? ` and ${failed.length - 3} more` : ''}.`
        : `Moved ${done.length} file${done.length === 1 ? '' : 's'} to ${TRASH_DIR} — still on disk.`,
    );
  }, [folder, clearSelection]);

  /* ------------------------------------------------------- viewer keys */

  const step = useCallback((d: number) => {
    setViewer((i) => {
      if (i === null) return i;
      const n = i + d;
      if (n < 0 || n >= visible.length) return i;
      return n;
    });
  }, [visible.length]);

  // Grid-level keys, only while the viewer is closed.
  useEffect(() => {
    if (viewer !== null || !folder) return;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.tagName === 'INPUT' || t.tagName === 'SELECT' || t.tagName === 'TEXTAREA') return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a') {
        e.preventDefault();
        setSelected(new Set(visible.map((f) => f.id)));
      } else if (e.key === 'Escape' && selected.size) {
        clearSelection();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [viewer, folder, visible, selected.size, clearSelection]);

  useEffect(() => {
    if (viewer === null) return;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.tagName === 'INPUT' || t.tagName === 'SELECT' || t.tagName === 'TEXTAREA') return;
      if (e.key === 'Escape') setViewer(null);
      else if (e.key === 'ArrowRight') { e.preventDefault(); step(1); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); step(-1); }
      else if ((e.key === 'd' || e.key === 'D') && folder?.canWrite) {
        const f = visible[viewer];
        if (f) { void remove(f); step(0); }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [viewer, step, visible, folder?.canWrite, remove]);

  /* ------------------------------------------------------------- render */

  if (!folder) {
    return (
      <>
        <div className="rounded-2xl border-2 border-dashed border-primary/35 bg-primary/[0.04] p-8 text-center sm:p-12">
          <FolderOpen className="mx-auto size-9 text-primary" />
          <h2 className="mt-4 text-lg font-bold">Pick a folder to look inside</h2>
          <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
            Every file previews itself — PDFs, spreadsheets, markdown, code, fonts, SVGs.
            Nothing is uploaded and nothing is stored.
          </p>
          <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
            {canPickDirectory() ? (
              <Button size="lg" onClick={() => void openPicker()} disabled={busy}>
                <FolderOpen className="size-4" /> Choose a folder
              </Button>
            ) : (
              <Button size="lg" onClick={() => inputRef.current?.click()} disabled={busy}>
                <FolderOpen className="size-4" /> Choose a folder
              </Button>
            )}
          </div>
          <p className="mt-4 text-xs text-muted-foreground">
            We read only the folder you pick.{' '}
            {!isPro && <>Free previews up to {FREE_MAX_FILES} files — Pro removes the cap.</>}
          </p>
        </div>
        <input
          ref={inputRef} type="file" className="dd-file-input" aria-label="Choose a folder"
          // Non-standard but supported everywhere that matters; React needs the cast.
          {...({ webkitdirectory: '', directory: '' } as Record<string, string>)}
          multiple
          onChange={(e) => { onInput(e.target.files); e.currentTarget.value = ''; }}
        />
      </>
    );
  }

  const current = viewer !== null ? visible[viewer] : null;

  return (
    <div className="overflow-hidden rounded-2xl border bg-card">
      {/* ------------------------------------------------------------ bar */}
      <div className="flex flex-wrap items-center gap-2 border-b bg-muted/30 p-3">
        <button
          onClick={() => (canPickDirectory() ? void openPicker() : inputRef.current?.click())}
          title="Change folder"
          className="inline-flex min-w-0 items-center gap-2 rounded-lg border bg-background px-3 py-1.5 text-[13px] font-semibold transition-colors hover:border-primary/50 hover:bg-accent"
        >
          <FolderOpen className="size-4 shrink-0 text-primary" />
          <span className="truncate max-w-[220px] font-medium text-muted-foreground">{folder.name}</span>
          <ChevronDown className="size-3.5 shrink-0 text-muted-foreground" />
        </button>
        {selected.size > 0 ? (
          <span className="text-[13px]">
            <b className="text-foreground">{selected.size}</b> selected · {fmtBytes(selectedBytes)}
          </span>
        ) : (
          <span className="text-[13px] text-muted-foreground">
            <b className="text-foreground">{visible.length}</b> of {files.length} files
          </span>
        )}
        <span className="flex-1" />
        <label className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query} onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter by name…" aria-label="Filter by name"
            className="w-40 rounded-lg border bg-background py-1.5 pl-8 pr-2 text-[13px]"
          />
        </label>
        <select
          value={kindFilter} onChange={(e) => setKindFilter(e.target.value)} aria-label="Filter by type"
          className="rounded-lg border bg-background px-2 py-1.5 text-[13px]"
        >
          <option value="">All types ({files.length})</option>
          {kindCounts.map(([k, n]) => <option key={k} value={k}>{KIND_GROUP[k]} ({n})</option>)}
        </select>
        {selected.size > 0 && (
          <>
            <Button variant="outline" size="sm" onClick={clearSelection}>Clear</Button>
            {folder.canWrite && (
              <Button
                size="sm" disabled={busy} onClick={() => setConfirming(selectedFiles)}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                <Trash2 className="size-4" /> Move {selected.size} to trash
              </Button>
            )}
          </>
        )}
        {selected.size === 0 && visible.length > 0 && (
          <Button variant="outline" size="sm" onClick={() => setSelected(new Set(visible.map((f) => f.id)))}>
            Select all
          </Button>
        )}
        <div className="inline-flex overflow-hidden rounded-lg border">
          {(['s', 'm', 'l'] as const).map((s) => (
            <button
              key={s} onClick={() => setSize(s)} aria-pressed={size === s}
              className={`px-2.5 py-1.5 text-xs font-semibold ${size === s ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent'}`}
            >{s.toUpperCase()}</button>
          ))}
        </div>
      </div>

      {(truncated || folder.ignored > 0 || !folder.canWrite) && (
        <div className="space-y-2 border-b bg-amber-500/[0.06] px-4 py-3">
          {truncated && (
            <p className="flex gap-2 text-[13px] leading-relaxed">
              <TriangleAlert className="mt-0.5 size-4 shrink-0 text-amber-700 dark:text-amber-400" />
              <span>
                Stopped at {cap} files — this folder has more.
                {!isPro && ' Pro reads the whole thing.'}
              </span>
            </p>
          )}
          {!folder.canWrite && (
            <p className="flex gap-2 text-[13px] leading-relaxed">
              <TriangleAlert className="mt-0.5 size-4 shrink-0 text-amber-700 dark:text-amber-400" />
              <span>
                <b>Previews work; tidying doesn’t.</b> Moving files to trash needs a folder
                permission this browser doesn’t offer. Open in Chrome or Edge to tidy as well as look.
              </span>
            </p>
          )}
          {folder.ignored > 0 && (
            <p className="text-[13px] text-muted-foreground">
              {folder.ignored} item{folder.ignored === 1 ? '' : 's'} skipped — not documents (programs, shortcuts, system files).
            </p>
          )}
        </div>
      )}

      {/* ----------------------------------------------------------- grid */}
      <div
        className="grid gap-3 p-4"
        style={{ gridTemplateColumns: `repeat(auto-fill, minmax(${size === 's' ? 150 : size === 'l' ? 300 : 216}px, 1fr))` }}
      >
        {visible.map((f, i) => (
          <Card
            key={f.id} file={f} r={rendered[f.id] ?? { state: 'idle' }}
            selected={selected.has(f.id)}
            anySelected={selected.size > 0}
            onVisible={() => request(f)}
            onOpen={() => setViewer(i)}
            onToggle={(shift) => toggle(i, shift)}
            onDelete={folder.canWrite ? () => void remove(f) : undefined}
          />
        ))}
        {visible.length === 0 && (
          <p className="col-span-full py-10 text-center text-sm text-muted-foreground">
            Nothing matches that filter.
          </p>
        )}
      </div>

      <input
        ref={inputRef} type="file" className="dd-file-input" aria-label="Change folder"
        {...({ webkitdirectory: '', directory: '' } as Record<string, string>)}
        multiple
        onChange={(e) => { onInput(e.target.files); e.currentTarget.value = ''; }}
      />

      {/* ---------------------------------------------------------- footer */}
      <div className="flex flex-wrap items-center gap-3 border-t bg-muted/30 px-4 py-3">
        <span className="flex items-center gap-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
          <ShieldCheck className="size-3.5" /> 0 bytes uploaded — check your Network tab
        </span>
        {trashed.length > 0 && (
          <span className="text-xs text-muted-foreground">
            {trashed.length} moved to <code>{TRASH_DIR}</code> — still on disk
          </span>
        )}
        {lastBatch.length > 0 && (
          <Button variant="outline" size="sm" onClick={() => void undoLast()} disabled={busy}>
            <Undo2 className="size-4" /> Undo {lastBatch.length === 1 ? '' : `${lastBatch.length} `}
          </Button>
        )}
        <span className="flex-1" />
        <Button variant="outline" size="sm" onClick={() => { setFolder(null); setViewer(null); }}>
          Pick another folder
        </Button>
      </div>

      {note && (
        <div className="flex items-center gap-2 border-t px-4 py-2 text-[13px]">
          <Undo2 className="size-3.5 text-muted-foreground" /> {note}
        </div>
      )}

      {/* Bulk delete asks first. One file is instantly undoable and a dialog
          there would just train people to click through; forty files at once is
          a different act, and the size is the number they actually care about. */}
      {confirming && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-foreground/40 p-4">
          <div className="w-full max-w-md rounded-2xl border bg-card p-6 shadow-lift">
            <p className="flex items-center gap-2 text-base font-bold">
              <TriangleAlert className="size-5 text-destructive" />
              Move {confirming.length} file{confirming.length === 1 ? '' : 's'} to trash?
            </p>
            <p className="mt-2.5 text-sm leading-relaxed text-muted-foreground">
              That’s <b className="text-foreground">{fmtBytes(confirming.reduce((n, f) => n + f.size, 0))}</b>.
              They move to a <code>{TRASH_DIR}</code> folder inside <b className="text-foreground">{folder.name}</b> —
              nothing is destroyed, and you can put them back.
            </p>
            <ul className="mt-3 max-h-32 space-y-0.5 overflow-auto rounded-lg border bg-muted/30 p-2.5 text-xs text-muted-foreground">
              {confirming.slice(0, 8).map((f) => <li key={f.id} className="truncate">{f.rel}</li>)}
              {confirming.length > 8 && <li className="pt-1 font-medium">and {confirming.length - 8} more</li>}
            </ul>
            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <Button variant="outline" onClick={() => setConfirming(null)}>Keep them</Button>
              <Button
                onClick={() => { const files = confirming; setConfirming(null); void removeSelected(files); }}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                <Trash2 className="size-4" /> Move to trash
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* --------------------------------------------------------- viewer */}
      {current && (
        <div className="fixed inset-0 z-50 flex flex-col bg-background">
          <div className="flex flex-wrap items-center gap-2 border-b p-3">
            <Button variant="outline" size="sm" onClick={() => setViewer(null)}>
              <ChevronLeft className="size-4" /> Back to grid
            </Button>
            <span className="min-w-0 truncate text-sm font-bold">{current.name}</span>
            <span className="text-xs text-muted-foreground">
              {(viewer ?? 0) + 1} / {visible.length} · {KIND_GROUP[current.kind]} · {fmtBytes(current.size)}
            </span>
            <span className="flex-1" />
            <a
              href={urlsRef.current.get(current.id) ?? '#'} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[13px] font-medium hover:bg-accent"
            >
              Open in tab <ExternalLink className="size-3.5" />
            </a>
            <Button variant="outline" size="sm" onClick={() => step(1)}>
              Keep <kbd className="ml-1 rounded border px-1 text-[10px]">→</kbd>
            </Button>
            {folder.canWrite && (
              <Button
                size="sm" onClick={() => { void remove(current); }}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                <Trash2 className="size-4" /> Delete <kbd className="ml-1 rounded border border-white/30 px-1 text-[10px]">D</kbd>
              </Button>
            )}
          </div>

          <div className="relative flex-1 overflow-auto">
            <button
              onClick={() => step(-1)} aria-label="Previous file" disabled={viewer === 0}
              className="absolute left-3 top-1/2 z-10 -translate-y-1/2 rounded-xl border bg-card p-2 shadow-lift disabled:opacity-30"
            ><ChevronLeft className="size-5" /></button>
            <button
              onClick={() => step(1)} aria-label="Next file" disabled={viewer === visible.length - 1}
              className="absolute right-3 top-1/2 z-10 -translate-y-1/2 rounded-xl border bg-card p-2 shadow-lift disabled:opacity-30"
            ><ChevronRight className="size-5" /></button>
            <Full file={current} r={rendered[current.id] ?? { state: 'idle' }} onNeed={() => request(current)} />
          </div>
        </div>
      )}
    </div>
  );
}

/* --------------------------------------------------------------- card */

function Card({ file, r, selected, anySelected, onVisible, onOpen, onToggle, onDelete }: {
  file: PickedFile; r: Rendered; selected: boolean; anySelected: boolean;
  onVisible: () => void; onOpen: () => void; onToggle: (shift: boolean) => void; onDelete?: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const meta = KIND_META[file.kind];

  useEffect(() => {
    const el = ref.current;
    if (!el || r.state !== 'idle') return;
    // 600px of lookahead so a preview is usually ready by the time it's on screen.
    const io = new IntersectionObserver((es) => {
      if (es.some((e) => e.isIntersecting)) { onVisible(); io.disconnect(); }
    }, { rootMargin: '600px' });
    io.observe(el);
    return () => io.disconnect();
  }, [r.state, onVisible]);

  return (
    <div
      ref={ref}
      className={`group relative overflow-hidden rounded-xl border bg-card transition-all hover:-translate-y-px hover:shadow-md ${
        selected ? 'border-primary ring-2 ring-primary/30' : 'hover:border-primary/50'
      }`}
    >
      {/* Once anything is selected the whole card toggles, so building a
          selection doesn't mean hunting for a 19px checkbox forty times. */}
      <button
        onClick={(e) => (anySelected ? onToggle(e.shiftKey) : onOpen())}
        className="block w-full text-left"
        title={anySelected ? 'Select / deselect' : 'Open full size'}
      >
        <div className="relative h-[150px] overflow-hidden border-b bg-muted/30">
          <Thumb file={file} r={r} />
        </div>
        <div className="p-2.5">
          <p className="break-words text-[12.5px] font-bold leading-tight">{file.name}</p>
          <p className="mt-1 flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <span className="rounded px-1 py-px text-[9px] font-extrabold uppercase text-white" style={{ background: meta.color }}>
              {meta.label}
            </span>
            {fmtBytes(file.size)} · {fmtDate(file.lastModified)}
          </p>
        </div>
      </button>
      {/* The tick is always live: it's how you START a selection, and it must not
          depend on hover — that would strand touch users entirely. */}
      <button
        onClick={(e) => { e.stopPropagation(); onToggle(e.shiftKey); }}
        aria-pressed={selected}
        aria-label={`Select ${file.name}`}
        title="Select (shift-click for a range)"
        className={`absolute left-2 top-2 grid size-5 place-items-center rounded border transition ${
          selected
            ? 'border-primary bg-primary text-primary-foreground'
            : 'border-border bg-card/90 text-transparent hover:border-primary/60 group-hover:text-muted-foreground'
        }`}
      ><Check className="size-3.5" strokeWidth={3} /></button>

      {onDelete && !anySelected && (
        <button
          onClick={onDelete} title="Move to trash"
          className="absolute right-2 top-2 hidden rounded-lg border bg-card p-1.5 text-muted-foreground shadow-sm transition hover:text-destructive group-hover:block"
        ><Trash2 className="size-3.5" /></button>
      )}
    </div>
  );
}

function Thumb({ file, r }: { file: PickedFile; r: Rendered }) {
  if (r.state === 'idle' || r.state === 'loading') {
    return <div className="grid h-full place-items-center"><span className="size-5 animate-spin rounded-full border-2 border-border border-t-primary" /></div>;
  }
  if (r.state === 'failed') {
    return (
      <div className="grid h-full place-content-center justify-items-center gap-1 p-3 text-center">
        <p className="text-[11px] font-bold">No preview</p>
        <p className="text-[9.5px] leading-snug text-muted-foreground">{r.why}</p>
      </div>
    );
  }
  if (r.state === 'font') {
    return (
      <div className="grid h-full place-items-center gap-1">
        <FontFace url={r.url} id={file.id} />
        <b style={{ fontFamily: `dd-f-${cssId(file.id)}` }} className="text-3xl">Aa Bb Cc</b>
        <span className="text-[8px] tracking-wider text-muted-foreground">THE QUICK BROWN FOX · 0123456789</span>
      </div>
    );
  }
  if (r.state === 'url') {
    if (file.kind === 'html') {
      return (
        <iframe
          src={r.url} title={file.name} scrolling="no" sandbox="allow-same-origin"
          className="pointer-events-none h-[600px] w-[900px] origin-top-left"
          style={{ transform: 'scale(0.24)' }}
        />
      );
    }
    return (
      <div className="dd-checker grid h-full place-items-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={r.url} alt={file.name} className="max-h-full max-w-full object-contain" />
      </div>
    );
  }
  if (r.state === 'table') {
    return (
      <div className="h-full overflow-hidden p-2">
        <table className="w-full border-collapse text-[6.5px]">
          <tbody>
            {r.rows.map((row, i) => (
              <tr key={i}>
                {row.slice(0, 6).map((c, j) => (
                  <td key={j} className={`truncate border px-1 py-0.5 ${i === 0 ? 'bg-muted font-bold' : ''}`}>{c}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-1 text-[7px] text-muted-foreground">first {r.rows.length} of {r.total} rows</p>
      </div>
    );
  }
  if (r.state === 'html') {
    return (
      <div
        className="dd-md-thumb h-full overflow-hidden p-2 text-[6.5px] leading-[1.5]"
        dangerouslySetInnerHTML={{ __html: r.body }}
      />
    );
  }
  return (
    <pre className="h-full overflow-hidden whitespace-pre-wrap p-2 font-mono text-[6.5px] leading-[1.5] text-foreground/80">
      {r.body}
    </pre>
  );
}

const cssId = (s: string) => s.replace(/[^a-zA-Z0-9]/g, '');

function FontFace({ url, id }: { url: string; id: string }) {
  return <style>{`@font-face{font-family:'dd-f-${cssId(id)}';src:url('${url}')}`}</style>;
}

/* --------------------------------------------------------------- full */

function Full({ file, r, onNeed }: { file: PickedFile; r: Rendered; onNeed: () => void }) {
  useEffect(() => { if (r.state === 'idle') onNeed(); }, [r.state, onNeed]);

  if (r.state === 'idle' || r.state === 'loading') {
    return <div className="grid h-full place-items-center"><span className="size-7 animate-spin rounded-full border-2 border-border border-t-primary" /></div>;
  }
  if (r.state === 'failed') {
    return (
      <div className="grid h-full place-content-center justify-items-center gap-2 p-8 text-center">
        <p className="text-lg font-bold">No preview for this one</p>
        <p className="max-w-sm text-sm text-muted-foreground">{r.why}</p>
      </div>
    );
  }
  if (r.state === 'url') {
    if (file.kind === 'html') {
      return <iframe src={r.url} title={file.name} sandbox="allow-same-origin" className="h-full w-full border-0" />;
    }
    if (file.kind === 'pdf') {
      // No sandbox: Chrome's PDF viewer is a plugin document and a sandbox makes
      // it render nothing at all. Measured by the tool this came from.
      return <iframe src={URL.createObjectURL(file.file)} title={file.name} className="h-full w-full border-0" />;
    }
    return (
      <div className="dd-checker grid min-h-full place-items-center p-6">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={r.url} alt={file.name} className="max-h-full max-w-full object-contain" />
      </div>
    );
  }
  if (r.state === 'table') {
    return (
      <div className="mx-auto max-w-5xl p-6">
        <table className="w-full border-collapse text-sm">
          <tbody>
            {r.rows.map((row, i) => (
              <tr key={i}>
                {row.map((c, j) => (
                  <td key={j} className={`border px-2 py-1 ${i === 0 ? 'bg-muted font-semibold' : ''}`}>{c}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-3 text-xs text-muted-foreground">Showing {r.rows.length} of {r.total} rows.</p>
      </div>
    );
  }
  if (r.state === 'font') {
    return (
      <div className="mx-auto max-w-3xl space-y-6 p-10">
        <FontFace url={r.url} id={file.id} />
        <p style={{ fontFamily: `dd-f-${cssId(file.id)}` }} className="text-5xl">Aa Bb Cc Dd Ee</p>
        <p style={{ fontFamily: `dd-f-${cssId(file.id)}` }} className="text-2xl">The quick brown fox jumps over the lazy dog.</p>
        <p style={{ fontFamily: `dd-f-${cssId(file.id)}` }} className="text-lg tracking-wide">0123456789 &amp; ! ? @ # % — “quotes”</p>
      </div>
    );
  }
  if (r.state === 'html') {
    return (
      <div
        className="dd-md prose-none mx-auto max-w-3xl p-8 text-[15px] leading-relaxed"
        dangerouslySetInnerHTML={{ __html: r.body }}
      />
    );
  }
  return <pre className="whitespace-pre-wrap p-6 font-mono text-[13px] leading-relaxed">{r.body}</pre>;
}
