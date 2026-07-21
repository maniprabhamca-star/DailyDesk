'use client';

// File Vault UI — Phase 3, built to the approved mockup (docs/artifacts/
// mockup-file-vault.html): Unlock screen → vault grid with the VISIBLE
// encrypt-before-upload steps → one-time recovery-key ceremony. Teal accent =
// the vault family. The master key lives only in this component's state and
// dies on lock/navigation; nothing key-shaped is ever persisted or sent.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Lock, Unlock, ShieldCheck, FolderLock, Folder, FolderPlus, Upload, Download,
  Trash2, Loader2, KeyRound, Printer, Copy, Check, AlertTriangle, FileText,
  Image as ImageIcon, Archive, File as FileIcon, LogIn, X, ChevronLeft,
  Recycle, RotateCcw, Pencil,
} from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { downloadBlob } from '@/lib/download';
import {
  getVault, createVaultRemote, listFiles, createFolder, deleteEntry, restoreEntry, renameEntry,
  uploadSealed, downloadSealed, isSignedIn, VaultApiError, type VaultFileRow, type VaultStatus,
} from '@/lib/vault-api';
import type { VaultHeader } from '@/lib/vault-crypto';

const crypto2 = () => import('@/lib/vault-crypto'); // lazy: pulls hash-wasm only here

const MAX_FILE_MB = 500;
const AUTO_LOCK_MS = 15 * 60 * 1000; // relock after 15 min without interaction

type Screen = 'loading' | 'signin' | 'create' | 'ceremony' | 'unlock' | 'vault';
type Row = VaultFileRow & { name: string }; // name = decrypted client-side
type UploadStep = { label: string; where: 'device' | 'server'; state: 'todo' | 'doing' | 'done' };

const fmtBytes = (n: number) => (n >= 1e9 ? `${(n / 1e9).toFixed(1)} GB` : n >= 1e6 ? `${(n / 1e6).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1e3))} KB`);

function FileGlyph({ name }: { name: string }) {
  const ext = (name.split('.').pop() || '').toLowerCase();
  const [cls, label, Icon] =
    ext === 'pdf' ? ['bg-red-600', 'PDF', FileText]
    : ['jpg', 'jpeg', 'png', 'webp', 'heic', 'gif'].includes(ext) ? ['bg-violet-600', 'IMG', ImageIcon]
    : ['doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt'].includes(ext) ? ['bg-blue-600', 'DOC', FileText]
    : ['zip', 'rar', '7z'].includes(ext) ? ['bg-slate-500', 'ZIP', Archive]
    : ['bg-teal-600', ext.slice(0, 3).toUpperCase() || 'FILE', FileIcon];
  const I = Icon as typeof FileText;
  return (
    <span className={`flex h-11 w-9 flex-col items-center justify-center gap-0.5 rounded-md text-white ${cls}`}>
      <I className="size-3.5" /><span className="text-[8px] font-extrabold">{label as string}</span>
    </span>
  );
}

export function FileVaultTool() {
  const [screen, setScreen] = useState<Screen>('loading');
  const [status, setStatus] = useState<VaultStatus | null>(null);
  const [mk, setMk] = useState<CryptoKey | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [folder, setFolder] = useState<Row | null>(null); // current folder (one level, like the mockup)
  const [binOpen, setBinOpen] = useState(false);
  const [binRows, setBinRows] = useState<Row[]>([]);
  const [binDays, setBinDays] = useState(30);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // create/unlock form state
  const [pass, setPass] = useState('');
  const [pass2, setPass2] = useState('');
  const [useRecovery, setUseRecovery] = useState(false);
  const [recoveryIn, setRecoveryIn] = useState('');
  // ceremony state
  const [ceremonyKey, setCeremonyKey] = useState('');
  const [ceremonyHeader, setCeremonyHeader] = useState<VaultHeader | null>(null);
  const [ceremonyMk, setCeremonyMk] = useState<CryptoKey | null>(null);
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);
  // upload steps panel (the mockup's "what actually happens")
  const [upSteps, setUpSteps] = useState<{ name: string; steps: UploadStep[]; pct: number } | null>(null);
  const [query, setQuery] = useState('');
  const fileInput = useRef<HTMLInputElement>(null);

  const lock = useCallback(() => { setMk(null); setRows([]); setFolder(null); setScreen('unlock'); setPass(''); }, []);

  // Auto-lock after inactivity — a vault left open on a shared machine is a leak.
  const lastAct = useRef(Date.now());
  useEffect(() => {
    if (screen !== 'vault') return;
    const bump = () => { lastAct.current = Date.now(); };
    const timer = setInterval(() => { if (Date.now() - lastAct.current > AUTO_LOCK_MS) lock(); }, 30_000);
    window.addEventListener('pointerdown', bump);
    window.addEventListener('keydown', bump);
    return () => { clearInterval(timer); window.removeEventListener('pointerdown', bump); window.removeEventListener('keydown', bump); };
  }, [screen, lock]);

  // initial load
  useEffect(() => {
    let alive = true;
    (async () => {
      if (!isSignedIn()) { setScreen('signin'); return; }
      try {
        const s = await getVault();
        if (!alive) return;
        setStatus(s);
        setScreen(s.exists ? 'unlock' : 'create');
      } catch (e) {
        if (!alive) return;
        setError(e instanceof VaultApiError ? e.message : 'The vault is unavailable right now — please try again.');
        setScreen('signin');
      }
    })();
    return () => { alive = false; };
  }, []);

  const decryptNames = useCallback(async (key: CryptoKey, files: VaultFileRow[]): Promise<Row[]> => {
    const v = await crypto2();
    return Promise.all(files.map(async (f) => {
      let name = '(unreadable)';
      try { name = await v.openName(key, f.sealedName); } catch { /* sealed under another key */ }
      return { ...f, name };
    }));
  }, []);

  const refresh = useCallback(async (key: CryptoKey) => {
    const [s, l, b] = await Promise.all([getVault(), listFiles(), listFiles(true)]);
    setStatus(s);
    setBinDays(b.binDays || 30);
    setRows(await decryptNames(key, l.files));
    setBinRows(await decryptNames(key, b.files));
  }, [decryptNames]);

  // Sync polish: re-list when the tab regains focus, so a second device's
  // changes show up without a manual reload (the vault stays locked-first).
  useEffect(() => {
    if (screen !== 'vault' || !mk) return;
    const onFocus = () => { void refresh(mk).catch(() => {}); };
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [screen, mk, refresh]);

  // ---- create + ceremony -----------------------------------------------------
  const startCreate = useCallback(async () => {
    if (busy) return;
    setError(null);
    if (pass.length < 8) { setError('Use at least 8 characters — a sentence works best.'); return; }
    if (pass !== pass2) { setError('The two passphrases don’t match.'); return; }
    setBusy(true);
    try {
      const v = await crypto2();
      const made = await v.createVault(pass);
      setCeremonyKey(made.recoveryKey);
      setCeremonyHeader(made.header);
      setCeremonyMk(made.mk);
      setSaved(false);
      setScreen('ceremony');
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not create the vault.'); }
    finally { setBusy(false); }
  }, [busy, pass, pass2]);

  const finishCeremony = useCallback(async () => {
    if (!ceremonyHeader || !ceremonyMk || !saved || busy) return;
    setBusy(true); setError(null);
    try {
      await createVaultRemote(ceremonyHeader);
      setMk(ceremonyMk);
      await refresh(ceremonyMk);
      setCeremonyKey(''); setCeremonyHeader(null); setCeremonyMk(null); setPass(''); setPass2('');
      setScreen('vault');
    } catch (e) { setError(e instanceof VaultApiError ? e.message : 'Could not save the vault — please try again.'); }
    finally { setBusy(false); }
  }, [ceremonyHeader, ceremonyMk, saved, busy, refresh]);

  const printKey = useCallback(() => {
    const w = window.open('', '_blank', 'width=600,height=400');
    if (!w) return;
    w.document.write(`<pre style="font:700 20px/1.6 monospace;text-align:center;margin-top:80px">DiemDesk File Vault — recovery key\n\n${ceremonyKey}\n\nStore this offline. It is the ONLY way back in\nif you forget your vault passphrase.</pre>`);
    w.document.close(); w.print();
  }, [ceremonyKey]);

  // ---- unlock ------------------------------------------------------------------
  const unlock = useCallback(async () => {
    if (busy || !status?.header) return;
    setBusy(true); setError(null);
    try {
      const v = await crypto2();
      const key = useRecovery
        ? await v.unlockWithRecovery(status.header, recoveryIn)
        : await v.unlockWithPassphrase(status.header, pass);
      setMk(key);
      await refresh(key);
      setPass(''); setRecoveryIn('');
      setScreen('vault');
    } catch {
      setError(useRecovery ? 'That recovery key doesn’t open this vault — check it character by character.' : 'Wrong passphrase — the vault stays sealed.');
    } finally { setBusy(false); }
  }, [busy, status, useRecovery, recoveryIn, pass, refresh]);

  // ---- vault actions -------------------------------------------------------------
  const addFiles = useCallback(async (files: FileList | File[]) => {
    if (!mk) return;
    setError(null);
    for (const f of Array.from(files)) {
      if (f.size > MAX_FILE_MB * 1024 * 1024) { setError(`“${f.name}” is over ${MAX_FILE_MB} MB — the current per-file limit.`); continue; }
      const steps: UploadStep[] = [
        { label: 'Key derived from your passphrase (Argon2id)', where: 'device', state: 'done' },
        { label: 'File sealed with AES-256-GCM', where: 'device', state: 'doing' },
        { label: 'Uploading the sealed box (we can’t open it)', where: 'server', state: 'todo' },
        { label: 'Stored — encrypted at rest', where: 'server', state: 'todo' },
      ];
      setUpSteps({ name: f.name, steps: [...steps], pct: 0 });
      try {
        const v = await crypto2();
        const bytes = new Uint8Array(await f.arrayBuffer());
        const sealed = await v.sealFile(mk, bytes);
        const sealedName = await v.sealName(mk, f.name);
        steps[1].state = 'done'; steps[2].state = 'doing';
        setUpSteps({ name: f.name, steps: [...steps], pct: 0 });
        await uploadSealed(sealedName, sealed.wrappedFk, sealed.sealed, folder?.id ?? null, (sent, total) => {
          setUpSteps({ name: f.name, steps: [...steps], pct: Math.round((sent / total) * 100) });
        });
        steps[2].state = 'done'; steps[3].state = 'done';
        setUpSteps({ name: f.name, steps: [...steps], pct: 100 });
      } catch (e) {
        setError(e instanceof VaultApiError ? e.message : `Could not add “${f.name}” — please try again.`);
        setUpSteps(null);
        break;
      }
    }
    await refresh(mk);
    setTimeout(() => setUpSteps(null), 1600);
  }, [mk, folder, refresh]);

  const getFile = useCallback(async (r: Row) => {
    if (!mk || r.kind !== 'file' || !r.wrappedFk) return;
    setBusy(true); setError(null);
    try {
      const v = await crypto2();
      const sealed = await downloadSealed(r.id);
      const plain = await v.openFile(mk, { wrappedFk: r.wrappedFk, sealed });
      downloadBlob(new Blob([plain as unknown as BlobPart]), r.name);
    } catch { setError(`Could not open “${r.name}” — please try again.`); }
    finally { setBusy(false); }
  }, [mk]);

  const remove = useCallback(async (r: Row) => {
    if (!mk) return;
    const msg = r.kind === 'folder'
      ? `Delete the folder “${r.name}”? It must be empty.`
      : `Move “${r.name}” to the recycle bin? It stays restorable for ${binDays} days.`;
    if (!window.confirm(msg)) return;
    try { await deleteEntry(r.id); await refresh(mk); }
    catch (e) { setError(e instanceof VaultApiError && e.code === 'not-empty' ? 'Empty the folder first.' : 'Could not delete — please try again.'); }
  }, [mk, refresh, binDays]);

  const restore = useCallback(async (r: Row) => {
    if (!mk) return;
    try { await restoreEntry(r.id); await refresh(mk); }
    catch { setError('Could not restore — please try again.'); }
  }, [mk, refresh]);

  const purge = useCallback(async (r: Row) => {
    if (!mk) return;
    if (!window.confirm(`Permanently delete “${r.name}”? This truly cannot be undone.`)) return;
    try { await deleteEntry(r.id, true); await refresh(mk); }
    catch { setError('Could not delete — please try again.'); }
  }, [mk, refresh]);

  const rename = useCallback(async (r: Row) => {
    if (!mk) return;
    const name = window.prompt('New name (encrypted like everything else):', r.name);
    if (!name?.trim() || name.trim() === r.name) return;
    try {
      const v = await crypto2();
      await renameEntry(r.id, await v.sealName(mk, name.trim()));
      await refresh(mk);
    } catch { setError('Could not rename — please try again.'); }
  }, [mk, refresh]);

  const newFolder = useCallback(async () => {
    if (!mk) return;
    const name = window.prompt('Folder name (encrypted like everything else):');
    if (!name?.trim()) return;
    try {
      const v = await crypto2();
      await createFolder(await v.sealName(mk, name.trim()), folder?.id ?? null);
      await refresh(mk);
    } catch { setError('Could not create the folder — please try again.'); }
  }, [mk, folder, refresh]);

  const visible = useMemo(() => {
    const inFolder = rows.filter((r) => (folder ? r.parentId === folder.id : !r.parentId));
    const q = query.trim().toLowerCase();
    const filtered = q ? inFolder.filter((r) => r.name.toLowerCase().includes(q)) : inFolder;
    return [...filtered.filter((r) => r.kind === 'folder'), ...filtered.filter((r) => r.kind === 'file')];
  }, [rows, folder, query]);

  const countIn = useCallback((id: string) => rows.filter((r) => r.parentId === id).length, [rows]);

  // ---------------------------------------------------------------------------
  if (screen === 'loading') {
    return <div className="flex h-72 items-center justify-center rounded-2xl border bg-card"><Loader2 className="size-6 animate-spin text-muted-foreground" /></div>;
  }

  if (screen === 'signin') {
    return (
      <div className="rounded-2xl border bg-card p-10 text-center shadow-soft">
        <span className="mx-auto flex size-14 items-center justify-center rounded-2xl border border-teal-500/40 bg-teal-500/10 text-teal-600 dark:text-teal-400"><FolderLock className="size-7" /></span>
        <h2 className="mt-4 text-lg font-bold">Your vault needs an account</h2>
        <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">The vault stores your encrypted files against your account — sign in and it’s waiting for you on any device.</p>
        {error && <p className="mx-auto mt-3 max-w-sm text-sm text-amber-700 dark:text-amber-400">{error}</p>}
        <Button asChild className="mt-5"><Link href="/login"><LogIn className="mr-1.5 size-4" /> Sign in</Link></Button>
      </div>
    );
  }

  if (screen === 'create') {
    return (
      <div className="mx-auto max-w-lg rounded-2xl border bg-card p-8 shadow-soft">
        <span className="mx-auto flex size-14 items-center justify-center rounded-2xl border border-teal-500/40 bg-teal-500/10 text-2xl">🔒</span>
        <h2 className="mt-4 text-center text-lg font-bold">Create your vault</h2>
        <p className="mt-2 text-center text-sm text-muted-foreground">
          Pick a <b className="text-foreground">vault passphrase</b> — separate from your login password. It never leaves this device,
          and <b className="text-foreground">we cannot reset it</b>. That’s what makes the vault yours alone.
        </p>
        <div className="mt-5 space-y-3">
          <input type="password" value={pass} onChange={(e) => setPass(e.target.value)} placeholder="Vault passphrase (a sentence works best)"
            className="w-full rounded-xl border bg-muted/40 px-4 py-3 text-sm outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/30" />
          <input type="password" value={pass2} onChange={(e) => setPass2(e.target.value)} placeholder="Type it again"
            onKeyDown={(e) => { if (e.key === 'Enter') void startCreate(); }}
            className="w-full rounded-xl border bg-muted/40 px-4 py-3 text-sm outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/30" />
        </div>
        {error && <p className="mt-3 text-sm text-amber-700 dark:text-amber-400">{error}</p>}
        <Button onClick={() => void startCreate()} disabled={busy} className="mt-4 w-full bg-teal-600 text-white hover:bg-teal-700">
          {busy ? <Loader2 className="mr-1.5 size-4 animate-spin" /> : <KeyRound className="mr-1.5 size-4" />} Continue — get my recovery key
        </Button>
        <div className="mt-5 flex items-start gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2.5 text-xs text-emerald-700 dark:text-emerald-400">
          <ShieldCheck className="mt-px size-4 shrink-0" />
          <span><b>End-to-end encrypted.</b> Files are sealed on your device with AES-256; the key comes from your passphrase (Argon2). DiemDesk’s servers only ever hold ciphertext.</span>
        </div>
      </div>
    );
  }

  if (screen === 'ceremony') {
    return (
      <div className="mx-auto max-w-xl rounded-2xl border bg-card p-8 shadow-soft">
        <h2 className="text-lg font-bold">One-time setup: your recovery key</h2>
        <p className="mt-1 text-sm text-muted-foreground">If you ever forget the vault passphrase, this key is the <b className="text-foreground">only</b> way back in. We never see it either.</p>
        <div className="mt-5 rounded-xl border-2 border-dashed border-teal-500/50 bg-teal-500/5 p-5 text-center font-mono text-lg font-bold tracking-[2px]">{ceremonyKey}</div>
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          <Button size="sm" onClick={() => downloadBlob(new Blob([`DiemDesk File Vault — recovery key\n\n${ceremonyKey}\n\nStore this offline. It is the ONLY way back in if you forget your vault passphrase.`]), 'diemdesk-vault-recovery-key.txt')} className="bg-teal-600 text-white hover:bg-teal-700"><Download className="mr-1 size-3.5" /> Download as file</Button>
          <Button size="sm" variant="outline" onClick={printKey}><Printer className="mr-1 size-3.5" /> Print</Button>
          <Button size="sm" variant="outline" onClick={() => { void navigator.clipboard.writeText(ceremonyKey).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); }); }}>
            {copied ? <Check className="mr-1 size-3.5" /> : <Copy className="mr-1 size-3.5" />} {copied ? 'Copied' : 'Copy'}
          </Button>
        </div>
        <div className="mt-5 flex items-start gap-2.5 rounded-xl border border-amber-500/40 bg-amber-500/10 p-3.5 text-[13px]">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400" />
          <span><b>Store it offline</b> — a printout in a drawer, a note in a password manager. Anyone with this key AND your account can open the vault; without it and your passphrase, <b>nobody</b> can, including us.</span>
        </div>
        <label className="mt-4 flex cursor-pointer items-start gap-2.5 text-sm">
          <input type="checkbox" checked={saved} onChange={(e) => setSaved(e.target.checked)} className="mt-0.5 size-4 accent-teal-600" />
          <span>I’ve saved my recovery key somewhere safe, and I understand DiemDesk <b>cannot</b> recover my files without it.</span>
        </label>
        {error && <p className="mt-3 text-sm text-amber-700 dark:text-amber-400">{error}</p>}
        <Button onClick={() => void finishCeremony()} disabled={!saved || busy} className="mt-4 w-full bg-teal-600 text-white hover:bg-teal-700 disabled:opacity-50">
          {busy ? <Loader2 className="mr-1.5 size-4 animate-spin" /> : <Lock className="mr-1.5 size-4" />} Create my vault →
        </Button>
      </div>
    );
  }

  if (screen === 'unlock') {
    return (
      <div className="mx-auto max-w-lg rounded-2xl border bg-card p-8 text-center shadow-soft">
        <span className="mx-auto flex size-14 items-center justify-center rounded-2xl border border-teal-500/40 bg-teal-500/10 text-2xl">🔒</span>
        <h2 className="mt-4 text-lg font-bold">Unlock your vault</h2>
        <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
          {useRecovery ? 'Enter the 24-character recovery key from setup.' : 'Your vault passphrase never leaves this device — and we can’t reset it.'}
        </p>
        <div className="mx-auto mt-5 flex max-w-md gap-2">
          {useRecovery ? (
            <input value={recoveryIn} onChange={(e) => setRecoveryIn(e.target.value)} placeholder="XXXX-XXXX-XXXX-XXXX-XXXX-XXXX"
              onKeyDown={(e) => { if (e.key === 'Enter') void unlock(); }}
              className="flex-1 rounded-xl border bg-muted/40 px-4 py-3 text-center font-mono text-sm uppercase outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/30" />
          ) : (
            <input type="password" value={pass} onChange={(e) => setPass(e.target.value)} placeholder="Vault passphrase" autoFocus
              onKeyDown={(e) => { if (e.key === 'Enter') void unlock(); }}
              className="flex-1 rounded-xl border bg-muted/40 px-4 py-3 text-sm outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/30" />
          )}
          <Button onClick={() => void unlock()} disabled={busy || (useRecovery ? !recoveryIn.trim() : !pass)} className="bg-teal-600 px-5 text-white hover:bg-teal-700">
            {busy ? <Loader2 className="size-4 animate-spin" /> : <Unlock className="size-4" />}
          </Button>
        </div>
        {error && <p className="mt-3 text-sm text-amber-700 dark:text-amber-400">{error}</p>}
        <button onClick={() => { setUseRecovery(!useRecovery); setError(null); }} className="mt-4 text-xs font-semibold text-teal-600 hover:underline dark:text-teal-400">
          {useRecovery ? '← Back to passphrase' : 'Forgot it? Use your recovery key'}
        </button>
        <p className="mt-4 text-xs text-muted-foreground">Without the passphrase or the recovery key, the files are unrecoverable by design.</p>
      </div>
    );
  }

  // ---- the vault ----------------------------------------------------------------
  const used = status?.used ?? 0;
  const quota = status?.quota ?? 1;
  return (
    <div>
      <div className="overflow-hidden rounded-2xl border bg-card shadow-soft">
        {/* header */}
        <div className="flex flex-wrap items-center gap-3 border-b px-5 py-3.5">
          <b className="text-[15px]">My vault</b>
          <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2.5 py-0.5 text-[10.5px] font-extrabold uppercase tracking-wide text-emerald-700 dark:text-emerald-400">
            <Lock className="size-3" /> End-to-end encrypted
          </span>
          <div className="ml-auto flex min-w-[170px] flex-col gap-1">
            <div className="h-1.5 overflow-hidden rounded-full border bg-muted/40"><div className="h-full bg-teal-600" style={{ width: `${Math.min(100, (used / quota) * 100)}%` }} /></div>
            <span className="text-[11px] text-muted-foreground">{fmtBytes(used)} of {fmtBytes(quota)} used</span>
          </div>
          <Button size="sm" variant="outline" onClick={lock}><Lock className="mr-1 size-3.5" /> Lock vault</Button>
        </div>
        {/* toolbar */}
        <div className="flex flex-wrap items-center gap-2 border-b bg-muted/30 px-5 py-2.5">
          <Button size="sm" onClick={() => fileInput.current?.click()} className="bg-teal-600 text-white hover:bg-teal-700"><Upload className="mr-1 size-3.5" /> Add files</Button>
          <input ref={fileInput} type="file" multiple className="hidden" onChange={(e) => { if (e.target.files?.length) void addFiles(e.target.files); e.target.value = ''; }} />
          <Button size="sm" variant="outline" onClick={() => void newFolder()}><FolderPlus className="mr-1 size-3.5" /> New folder</Button>
          {folder && (
            <button onClick={() => setFolder(null)} className="inline-flex items-center gap-1 rounded-lg border bg-card px-2.5 py-1.5 text-xs font-semibold">
              <ChevronLeft className="size-3.5" /> {folder.name}
            </button>
          )}
          <button onClick={() => setBinOpen((b) => !b)}
            className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition ${binOpen ? 'border-teal-500/50 bg-teal-500/10 text-teal-700 dark:text-teal-400' : 'bg-card text-muted-foreground hover:text-foreground'}`}>
            <Recycle className="size-3.5" /> Bin{binRows.length ? ` (${binRows.length})` : ''}
          </button>
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search file names…"
            className="ml-auto min-w-[170px] rounded-lg border bg-card px-3 py-1.5 text-xs outline-none focus:border-teal-500" />
        </div>

        {error && <div className="border-b bg-amber-500/10 px-5 py-2 text-xs text-amber-700 dark:text-amber-400">{error} <button className="ml-2 font-bold" onClick={() => setError(null)}><X className="inline size-3" /></button></div>}

        {/* upload steps — the mockup's "what actually happens" panel */}
        {upSteps && (
          <div className="space-y-1.5 border-b bg-teal-500/5 px-5 py-3">
            <p className="text-[10.5px] font-extrabold uppercase tracking-wide text-muted-foreground">Adding “{upSteps.name}” — what actually happens</p>
            {upSteps.steps.map((s, i) => (
              <div key={i} className={`flex items-center gap-2.5 rounded-lg border bg-card px-3 py-1.5 text-xs ${s.state === 'todo' ? 'opacity-50' : ''}`}>
                <span className={`flex size-5 items-center justify-center rounded-md border text-[10px] font-extrabold ${s.state === 'done' ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'border-teal-500/40 bg-teal-500/10 text-teal-600 dark:text-teal-400'}`}>
                  {s.state === 'done' ? '✓' : i + 1}
                </span>
                <span className="min-w-0 flex-1">
                  {s.label}
                  {s.state === 'doing' && i === 2 && <span className="mt-1 block h-1 overflow-hidden rounded-full bg-muted"><span className="block h-full bg-teal-600 transition-all" style={{ width: `${upSteps.pct}%` }} /></span>}
                </span>
                <span className={`rounded px-1.5 py-px text-[9px] font-extrabold uppercase tracking-wide ${s.where === 'device' ? 'border border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400' : 'border bg-muted/40 text-muted-foreground'}`}>
                  {s.where === 'device' ? 'On your device' : 'To storage'}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* recycle bin */}
        {binOpen && (
          <div className="border-b bg-muted/20 px-5 py-4">
            <p className="flex items-center gap-2 text-xs font-bold">
              <Recycle className="size-4 text-teal-600 dark:text-teal-400" /> Recycle bin
              <span className="font-medium text-muted-foreground">— items restore to the vault root; everything here is purged {binDays} days after deletion and still counts toward your storage.</span>
            </p>
            {binRows.length === 0 ? (
              <p className="mt-3 text-xs text-muted-foreground">The bin is empty.</p>
            ) : (
              <div className="mt-3 space-y-1.5">
                {binRows.map((r) => (
                  <div key={r.id} className="flex items-center gap-3 rounded-lg border bg-card px-3 py-2 text-xs">
                    <FileGlyph name={r.name} />
                    <span className="min-w-0 flex-1">
                      <b className="block truncate">{r.name}</b>
                      <span className="text-muted-foreground">{fmtBytes(r.size)} · deleted {r.deletedAt ? new Date(r.deletedAt).toLocaleDateString() : ''}</span>
                    </span>
                    <Button size="sm" variant="outline" className="h-7 px-2.5 text-xs" onClick={() => void restore(r)}><RotateCcw className="mr-1 size-3" /> Restore</Button>
                    <Button size="sm" variant="outline" className="h-7 px-2.5 text-xs text-red-600 hover:bg-red-500/10" onClick={() => void purge(r)}><Trash2 className="mr-1 size-3" /> Delete forever</Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* grid */}
        <div className="grid grid-cols-2 gap-3 p-5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {visible.length === 0 && !upSteps && (
            <div className="col-span-full py-10 text-center text-sm text-muted-foreground">
              {query ? 'Nothing matches that search.' : 'Your vault is empty — add the files you’d never email to yourself.'}
            </div>
          )}
          {visible.map((r) => (
            <div key={r.id} className="group relative rounded-xl border bg-muted/30 p-3 transition hover:-translate-y-px hover:border-teal-500/50">
              {r.kind === 'folder' ? (
                <button onClick={() => setFolder(r)} className="w-full text-left">
                  <Folder className="size-9 text-teal-600 dark:text-teal-400" />
                  <b className="mt-1.5 block break-words text-xs leading-tight">{r.name}</b>
                  <span className="text-[10.5px] text-muted-foreground">{countIn(r.id)} item{countIn(r.id) === 1 ? '' : 's'}</span>
                </button>
              ) : (
                <button onClick={() => void getFile(r)} disabled={busy} className="w-full text-left" title="Download & decrypt on this device">
                  <FileGlyph name={r.name} />
                  <b className="mt-1.5 block break-words text-xs leading-tight">{r.name}</b>
                  <span className="text-[10.5px] text-muted-foreground">{fmtBytes(r.size)}</span>
                </button>
              )}
              <span className="absolute right-2 top-2 rounded border border-teal-500/40 bg-teal-500/10 px-1 text-[8.5px] font-extrabold text-teal-600 dark:text-teal-400">E2E</span>
              <span className="absolute bottom-2 right-2 hidden gap-1 group-hover:flex">
                <button onClick={() => void rename(r)} title="Rename" className="rounded-md border bg-card p-1 text-muted-foreground transition hover:text-foreground"><Pencil className="size-3.5" /></button>
                <button onClick={() => void remove(r)} title={r.kind === 'file' ? 'Move to bin' : 'Delete'} className="rounded-md border bg-card p-1 text-muted-foreground transition hover:text-red-600"><Trash2 className="size-3.5" /></button>
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* what we can and cannot see */}
      <div className="mt-4 rounded-2xl border bg-card p-5">
        <h3 className="text-sm font-bold">What we can and cannot see</h3>
        <ul className="mt-3 grid gap-2 text-[13px] text-muted-foreground sm:grid-cols-2">
          <li className="flex gap-2"><b className="text-emerald-600 dark:text-emerald-400">✓</b> We store: the sealed bytes, file size, and when it was uploaded.</li>
          <li className="flex gap-2"><b className="text-red-600 dark:text-red-400">✗</b> We cannot see the contents — not us, not a breach, not a subpoena. There is no key on our side.</li>
          <li className="flex gap-2"><b className="text-emerald-600 dark:text-emerald-400">✓</b> File names: encrypted too — this list is decrypted on your device after unlock.</li>
          <li className="flex gap-2"><b className="text-red-600 dark:text-red-400">✗</b> We cannot reset your passphrase. The recovery key is the only fallback — by design.</li>
        </ul>
      </div>
    </div>
  );
}
