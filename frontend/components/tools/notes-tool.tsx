'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  Loader2, Plus, Trash2, Search, NotebookPen, LogIn, Tag as TagIcon, X, Check, Cloud, Sparkles,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  listNotes, createNote, updateNote, deleteNote, notesSignedIn, NotesApiError, type Note,
} from '@/lib/notes-api';

const SAVE_DEBOUNCE = 900;

function fmtWhen(iso: string): string {
  const d = new Date(iso), now = new Date();
  const mins = Math.round((now.getTime() - d.getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  if (mins < 1440) return `${Math.round(mins / 60)}h ago`;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function NotesTool() {
  const [phase, setPhase] = useState<'loading' | 'signin' | 'ready'>('loading');
  const [notes, setNotes] = useState<Note[]>([]);
  const [cap, setCap] = useState<number | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [capHit, setCapHit] = useState(false);
  const [saving, setSaving] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const notesRef = useRef<Note[]>(notes); // latest notes for the debounced save closure

  useEffect(() => {
    if (!notesSignedIn()) { setPhase('signin'); return; }
    let alive = true;
    listNotes().then((r) => {
      if (!alive) return;
      setNotes(r.notes); setCap(r.cap); setActiveId(r.notes[0]?.id ?? null); setPhase('ready');
    }).catch((e) => { if (alive) { setError(e instanceof NotesApiError ? e.message : 'Could not load your notes.'); setPhase('signin'); } });
    return () => { alive = false; };
  }, []);

  useEffect(() => { notesRef.current = notes; }, [notes]);

  const active = notes.find((n) => n.id === activeId) || null;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return notes;
    return notes.filter((n) => n.title.toLowerCase().includes(q) || n.content.toLowerCase().includes(q) || n.tags.some((t) => t.toLowerCase().includes(q)));
  }, [notes, query]);

  const atCap = cap != null && notes.length >= cap;

  const addNote = useCallback(async () => {
    setError(null); setCapHit(false);
    if (atCap) { setCapHit(true); return; }
    try {
      const { note } = await createNote({ title: '', content: '', tags: [] });
      setNotes((ns) => [note, ...ns]); setActiveId(note.id);
    } catch (e) {
      if (e instanceof NotesApiError && e.code === 'note-cap') { setCapHit(true); return; }
      setError(e instanceof NotesApiError ? e.message : 'Could not create the note.');
    }
  }, [atCap]);

  // Optimistic edit + debounced save.
  const edit = useCallback((patch: Partial<Pick<Note, 'title' | 'content' | 'tags'>>) => {
    if (!activeId) return;
    setNotes((ns) => ns.map((n) => (n.id === activeId ? { ...n, ...patch, updatedAt: new Date().toISOString() } : n)));
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      const target = notesRef.current.find((n) => n.id === activeId);
      if (!target) return;
      setSaving(true);
      try { await updateNote(target.id, { title: target.title, content: target.content, tags: target.tags }); }
      catch { setError('Could not save — check your connection.'); }
      finally { setSaving(false); }
    }, SAVE_DEBOUNCE);
  }, [activeId]);

  const remove = useCallback(async (id: string) => {
    if (!window.confirm('Delete this note? This can’t be undone.')) return;
    try {
      await deleteNote(id);
      setNotes((ns) => { const next = ns.filter((n) => n.id !== id); if (activeId === id) setActiveId(next[0]?.id ?? null); return next; });
      setCapHit(false);
    } catch { setError('Could not delete — please try again.'); }
  }, [activeId]);

  const addTag = useCallback((raw: string) => {
    const t = raw.trim().replace(/,/g, '');
    if (!active || !t || active.tags.includes(t) || active.tags.length >= 12) return;
    edit({ tags: [...active.tags, t] });
  }, [active, edit]);

  if (phase === 'loading') return <div className="flex h-72 items-center justify-center rounded-2xl border bg-card"><Loader2 className="size-6 animate-spin text-muted-foreground" /></div>;

  if (phase === 'signin') {
    return (
      <div className="rounded-2xl border bg-card p-10 text-center shadow-soft">
        <span className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-cyan-500/10 text-cyan-600 dark:text-cyan-400"><NotebookPen className="size-7" /></span>
        <h2 className="mt-4 text-lg font-bold">Your notes, on every device</h2>
        <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">Smart Notes sync to your account, so they’re there whether you’re on your laptop or your phone. Sign in to start.</p>
        {error && <p className="mx-auto mt-3 max-w-sm text-sm text-amber-700 dark:text-amber-400">{error}</p>}
        <Button asChild className="mt-5"><Link href="/login"><LogIn className="mr-1.5 size-4" /> Sign in</Link></Button>
      </div>
    );
  }

  return (
    <div>
      <div className="grid gap-4 md:grid-cols-[280px_1fr]">
        {/* list */}
        <aside className="flex flex-col rounded-2xl border bg-card">
          <div className="flex items-center gap-2 border-b p-3">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search notes…"
                className="w-full rounded-lg border bg-background py-2 pl-8 pr-2 text-sm outline-none focus:border-cyan-500" />
            </div>
            <Button size="icon" onClick={() => void addNote()} className="size-9 shrink-0 bg-cyan-600 text-white hover:bg-cyan-700" aria-label="New note"><Plus className="size-4" /></Button>
          </div>
          <div className="max-h-[440px] flex-1 overflow-auto p-2">
            {filtered.length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">{query ? 'No notes match.' : 'No notes yet — tap + to write one.'}</p>}
            {filtered.map((n) => (
              <button key={n.id} onClick={() => setActiveId(n.id)}
                className={`mb-1 w-full rounded-lg px-3 py-2 text-left transition ${n.id === activeId ? 'bg-cyan-500/10 ring-1 ring-cyan-500/30' : 'hover:bg-muted/50'}`}>
                <p className="truncate text-sm font-semibold">{n.title || 'Untitled'}</p>
                <p className="truncate text-xs text-muted-foreground">{n.content.replace(/\s+/g, ' ').trim() || 'No text'}</p>
                <p className="mt-0.5 text-[10.5px] text-muted-foreground/70">{fmtWhen(n.updatedAt)}</p>
              </button>
            ))}
          </div>
          {cap != null && (
            <div className="border-t px-3 py-2 text-center text-[11px] text-muted-foreground">
              {notes.length} / {cap} notes · <Link href="/pricing" className="font-semibold text-cyan-600 hover:underline dark:text-cyan-400">Pro = unlimited</Link>
            </div>
          )}
        </aside>

        {/* editor */}
        <section className="rounded-2xl border bg-card p-4">
          {capHit && (
            <div className="mb-3 flex items-center gap-2 rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2.5 text-sm">
              <Sparkles className="size-4 shrink-0 text-amber-600 dark:text-amber-400" />
              <span>You’ve reached {cap} notes on the free plan. <Link href="/pricing" className="font-semibold underline">Upgrade to Pro</Link> for unlimited notes.</span>
            </div>
          )}
          {error && <div className="mb-3 rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-700 dark:text-amber-400">{error} <button onClick={() => setError(null)}><X className="ml-1 inline size-3" /></button></div>}

          {!active ? (
            <div className="flex h-72 flex-col items-center justify-center gap-3 text-center text-muted-foreground">
              <NotebookPen className="size-8 opacity-50" />
              <p className="text-sm">Pick a note on the left, or tap + to start a new one.</p>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2">
                <input value={active.title} onChange={(e) => edit({ title: e.target.value })} maxLength={255} placeholder="Title"
                  className="flex-1 bg-transparent text-lg font-bold outline-none placeholder:text-muted-foreground/50" />
                <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                  {saving ? <><Loader2 className="size-3 animate-spin" /> Saving</> : <><Check className="size-3 text-emerald-500" /> Saved</>}
                </span>
                <button onClick={() => void remove(active.id)} className="rounded p-1.5 text-muted-foreground hover:text-red-600" aria-label="Delete note"><Trash2 className="size-4" /></button>
              </div>
              <textarea value={active.content} onChange={(e) => edit({ content: e.target.value })} maxLength={20000} placeholder="Start writing…"
                className="mt-3 h-64 w-full resize-none bg-transparent text-sm leading-relaxed outline-none placeholder:text-muted-foreground/40" />
              <div className="mt-2 flex flex-wrap items-center gap-1.5 border-t pt-3">
                <TagIcon className="size-3.5 text-muted-foreground" />
                {active.tags.map((t) => (
                  <span key={t} className="inline-flex items-center gap-1 rounded-full bg-cyan-500/10 px-2 py-0.5 text-[11px] font-medium text-cyan-700 dark:text-cyan-400">
                    {t}<button onClick={() => edit({ tags: active.tags.filter((x) => x !== t) })}><X className="size-2.5" /></button>
                  </span>
                ))}
                <input placeholder="add tag…" onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addTag((e.target as HTMLInputElement).value); (e.target as HTMLInputElement).value = ''; } }}
                  className="w-20 bg-transparent text-[12px] outline-none placeholder:text-muted-foreground/40" />
              </div>
            </>
          )}
        </section>
      </div>

      <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-cyan-500/40 bg-cyan-500/10 p-3.5 text-[13px] leading-relaxed text-foreground">
        <Cloud className="mt-0.5 size-4 shrink-0 text-cyan-600 dark:text-cyan-400" />
        <p><b>Synced to your account.</b> Notes are saved to your DiemDesk account so they’re on every device you sign in on. (For files that must be encrypted so even we can’t read them, use the <Link href="/file-vault" className="font-semibold underline">File Vault</Link>.)</p>
      </div>
    </div>
  );
}
