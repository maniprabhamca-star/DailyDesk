import { classify, type FileKind } from './file-classify';

// Getting a folder into a browser tab, two ways.
//
// A browser cannot be handed a path — someone has to pick a folder, and the two
// mechanisms for that are not equivalent:
//
//   <input webkitdirectory>   works everywhere; a one-off snapshot; no writes.
//   showDirectoryPicker()     Chrome/Edge only; a live handle; can move files.
//
// The picker is the better experience and it is the minority browser, so the
// input is the baseline and the picker is a progressive enhancement. That order
// matters: a tool that only works in Chrome is a tool most people bounce off.
//
// Deleting is deliberately NOT deleting. Files move to a _trash folder inside
// the folder you picked, because a web page permanently destroying someone's
// files — however good the confirm dialog — is not defensible.

export type PickedFile = {
  id: string;
  name: string;
  /** Path relative to the picked folder, for display and de-duplication. */
  rel: string;
  size: number;
  lastModified: number;
  kind: FileKind;
  file: File;
  /** Only present on the picker path — needed to move the file to trash. */
  dirHandle?: FileSystemDirectoryHandle;
};

export type Folder = {
  name: string;
  files: PickedFile[];
  /** True when we can move files to trash. False on the input fallback. */
  canWrite: boolean;
  handle?: FileSystemDirectoryHandle;
  /** Files we deliberately ignored — not documents. Counted, never listed. */
  ignored: number;
};

export const TRASH_DIR = '_trash';

/** Chrome and Edge only. Everything else uses the input. */
export function canPickDirectory(): boolean {
  return typeof window !== 'undefined' && 'showDirectoryPicker' in window;
}

const skipDir = (name: string) =>
  name === TRASH_DIR || name === 'node_modules' || name === '.git' || name.startsWith('.');

/**
 * Walk a directory handle.
 *
 * `maxDepth` and `maxFiles` are not tuning knobs, they are the difference
 * between a tool and a hang: somebody will point this at a folder containing
 * node_modules, and forty thousand previews is not a feature. We stop, and the
 * UI says we stopped.
 */
async function walk(
  dir: FileSystemDirectoryHandle,
  opts: { maxDepth: number; maxFiles: number },
  prefix = '',
  depth = 0,
  out: PickedFile[] = [],
  counts = { ignored: 0 },
): Promise<{ files: PickedFile[]; ignored: number; truncated: boolean }> {
  if (out.length >= opts.maxFiles) return { files: out, ignored: counts.ignored, truncated: true };

  for await (const entry of dir.values()) {
    if (out.length >= opts.maxFiles) return { files: out, ignored: counts.ignored, truncated: true };

    if (entry.kind === 'directory') {
      if (depth >= opts.maxDepth || skipDir(entry.name)) continue;
      await walk(entry as FileSystemDirectoryHandle, opts, `${prefix}${entry.name}/`, depth + 1, out, counts);
      continue;
    }

    const kind = classify(entry.name);
    if (!kind) { counts.ignored += 1; continue; }

    const file = await (entry as FileSystemFileHandle).getFile();
    out.push({
      id: `${prefix}${entry.name}`,
      name: entry.name,
      rel: `${prefix}${entry.name}`,
      size: file.size,
      lastModified: file.lastModified,
      kind,
      file,
      dirHandle: dir,
    });
  }
  return { files: out, ignored: counts.ignored, truncated: false };
}

export async function pickDirectory(
  opts: { maxDepth?: number; maxFiles?: number } = {},
): Promise<(Folder & { truncated: boolean }) | null> {
  const maxDepth = opts.maxDepth ?? 2;
  const maxFiles = opts.maxFiles ?? 2000;
  let handle: FileSystemDirectoryHandle;
  try {
    handle = await window.showDirectoryPicker({ mode: 'readwrite' });
  } catch {
    return null; // the person cancelled; not an error worth showing
  }
  const { files, ignored, truncated } = await walk(handle, { maxDepth, maxFiles });
  return { name: handle.name, files, canWrite: true, handle, ignored, truncated };
}

/**
 * The everywhere path. `webkitdirectory` gives a flat FileList whose entries
 * carry webkitRelativePath, so the folder structure survives even though the
 * handles do not.
 */
export function readFileList(
  list: FileList,
  opts: { maxDepth?: number; maxFiles?: number } = {},
): Folder & { truncated: boolean } {
  const maxDepth = opts.maxDepth ?? 2;
  const maxFiles = opts.maxFiles ?? 2000;
  const files: PickedFile[] = [];
  let ignored = 0;
  let truncated = false;
  let root = '';

  for (const file of Array.from(list)) {
    // e.g. "Client work/2026/invoice.pdf" — first segment is the picked folder.
    const relFull = (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name;
    const parts = relFull.split('/');
    if (!root && parts.length > 1) root = parts[0];
    const rel = parts.length > 1 ? parts.slice(1).join('/') : file.name;

    if (rel.split('/').some((seg, i) => i < parts.length - 2 && skipDir(seg))) { ignored += 1; continue; }
    if (rel.split('/').length - 1 > maxDepth) { ignored += 1; continue; }

    const kind = classify(file.name);
    if (!kind) { ignored += 1; continue; }
    if (files.length >= maxFiles) { truncated = true; break; }

    files.push({
      id: rel, name: file.name, rel, size: file.size,
      lastModified: file.lastModified, kind, file,
    });
  }
  return { name: root || 'Selected files', files, canWrite: false, ignored, truncated };
}

/**
 * Make sure we may actually write, and say so plainly when we may not.
 *
 * `showDirectoryPicker({ mode: 'readwrite' })` grants permission at pick time,
 * but that grant is not permanent: Chrome downgrades it to 'prompt' when the
 * tab has been open a while, when the folder is a sensitive one, and whenever
 * the person picked with the "View files" option instead of "Edit files".
 *
 * Without this check every write throws a bare NotAllowedError deep inside the
 * loop, where it was caught and reported as an unexplained "could not move" —
 * which is indistinguishable from a bug, and is exactly how this surfaced.
 *
 * requestPermission() must be called while a user gesture is still in play, so
 * this belongs at the top of a click handler and nowhere else.
 */
export async function ensureWritable(root: FileSystemDirectoryHandle): Promise<void> {
  const h = root as FileSystemDirectoryHandle & {
    queryPermission?: (d: { mode: string }) => Promise<PermissionState>;
    requestPermission?: (d: { mode: string }) => Promise<PermissionState>;
  };
  if (!h.queryPermission) return; // older engine; let the write itself fail
  if (await h.queryPermission({ mode: 'readwrite' }) === 'granted') return;
  if (await h.requestPermission?.({ mode: 'readwrite' }) === 'granted') return;
  throw new Error(
    'This browser tab no longer has permission to change that folder. Pick the folder again and choose “Edit files”.',
  );
}

/**
 * Move a file into `_trash` inside the picked folder.
 *
 * Copy-then-remove rather than a rename, because the File System Access API has
 * no move across directories. Deliberately NOT removeEntry on its own: the file
 * survives, and getting it back is a file-manager drag rather than a support
 * ticket.
 */
export async function moveToTrash(root: FileSystemDirectoryHandle, f: PickedFile): Promise<string> {
  if (!f.dirHandle) throw new Error('This file was not opened with folder permission.');
  const trash = await root.getDirectoryHandle(TRASH_DIR, { create: true });
  // Keep the name unique so trashing two files called "notes.txt" doesn't eat one.
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const trashName = `${stamp}__${f.name}`;
  const target = await trash.getFileHandle(trashName, { create: true });
  const w = await target.createWritable();
  await w.write(await f.file.arrayBuffer());
  await w.close();
  await f.dirHandle.removeEntry(f.name);
  // The caller needs this to put it back — the stamp makes the name unguessable.
  return trashName;
}

/**
 * Put a trashed file back where it came from.
 *
 * Undo only works because "delete" was never a delete: the bytes are still in
 * `_trash`, and `dirHandle` still points at the folder the file came out of. If
 * a file with the same name has appeared there since, we do NOT overwrite it —
 * silently clobbering a newer file while "undoing" would be a far worse bug than
 * the one undo exists to fix.
 */
export async function restoreFromTrash(
  root: FileSystemDirectoryHandle,
  f: PickedFile,
  trashName: string,
): Promise<void> {
  if (!f.dirHandle) throw new Error('This file was not opened with folder permission.');
  const trash = await root.getDirectoryHandle(TRASH_DIR, { create: true });
  const source = await trash.getFileHandle(trashName);
  const bytes = await (await source.getFile()).arrayBuffer();

  let name = f.name;
  try {
    await f.dirHandle.getFileHandle(f.name);
    // Something is already there. Come back beside it rather than over it.
    const dot = f.name.lastIndexOf('.');
    name = dot > 0
      ? `${f.name.slice(0, dot)} (restored)${f.name.slice(dot)}`
      : `${f.name} (restored)`;
  } catch { /* nothing there — the normal case */ }

  const target = await f.dirHandle.getFileHandle(name, { create: true });
  const w = await target.createWritable();
  await w.write(bytes);
  await w.close();
  await trash.removeEntry(trashName);
}
