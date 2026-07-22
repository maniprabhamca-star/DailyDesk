'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  Loader2, Plus, Trash2, GripVertical, ImagePlus, Check, X, ExternalLink, Copy,
  Eye, EyeOff, LogIn, Sparkles, Link2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { THEME_LIST, EMPTY_BIO, type BioConfig, type BioLink } from '@/lib/bio-themes';
import { BioPageView } from '@/components/bio/bio-page-view';
import {
  getBio, createBio, updateBio, checkHandle, bioSignedIn, BioApiError,
} from '@/lib/bio-api';

const PUBLIC_BASE = 'diemdesk.com/u/';
const AVATAR_MAX = 280 * 1024; // keep the data URL small

export function LinkInBioTool() {
  const [phase, setPhase] = useState<'loading' | 'signin' | 'claim' | 'edit'>('loading');
  const [slug, setSlug] = useState('');
  const [claimSlug, setClaimSlug] = useState('');
  const [claim, setClaim] = useState<{ checking: boolean; ok: boolean | null; reason: string | null }>({ checking: false, ok: null, reason: null });
  const [config, setConfig] = useState<BioConfig>(EMPTY_BIO);
  const [published, setPublished] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const avatarRef = useRef<HTMLInputElement>(null);
  const dragIdx = useRef<number | null>(null);

  useEffect(() => {
    if (!bioSignedIn()) { setPhase('signin'); return; }
    let alive = true;
    getBio().then((s) => {
      if (!alive) return;
      if (s.exists && s.slug && s.config) { setSlug(s.slug); setConfig(s.config); setPublished(s.published ?? true); setPhase('edit'); }
      else setPhase('claim');
    }).catch((e) => { if (alive) { setError(e instanceof BioApiError ? e.message : 'Could not load your page.'); setPhase(e instanceof BioApiError && e.code === 'pro-required' ? 'claim' : 'signin'); } });
    return () => { alive = false; };
  }, []);

  // Debounced handle availability check on the claim screen.
  useEffect(() => {
    const s = claimSlug.trim().toLowerCase();
    if (phase !== 'claim' || s.length < 3) { setClaim({ checking: false, ok: null, reason: null }); return; }
    setClaim((c) => ({ ...c, checking: true }));
    const t = setTimeout(() => {
      checkHandle(s).then((r) => setClaim({ checking: false, ok: r.available, reason: r.reason }))
        .catch(() => setClaim({ checking: false, ok: null, reason: null }));
    }, 450);
    return () => clearTimeout(t);
  }, [claimSlug, phase]);

  const patch = useCallback((p: Partial<BioConfig>) => setConfig((c) => ({ ...c, ...p })), []);

  const onAvatar = useCallback(async (f?: File) => {
    if (!f || !f.type.startsWith('image/')) return;
    // Downscale to 400px square so the stored data URL stays small.
    const bmp = await createImageBitmap(f);
    const size = 400;
    const c = document.createElement('canvas'); c.width = c.height = size;
    const ctx = c.getContext('2d')!;
    const s = Math.max(size / bmp.width, size / bmp.height);
    ctx.drawImage(bmp, (size - bmp.width * s) / 2, (size - bmp.height * s) / 2, bmp.width * s, bmp.height * s);
    bmp.close();
    let q = 0.85, url = c.toDataURL('image/jpeg', q);
    while (url.length > AVATAR_MAX && q > 0.4) { q -= 0.1; url = c.toDataURL('image/jpeg', q); }
    c.width = c.height = 0;
    if (url.length > AVATAR_MAX) { setError('That image is too large even after shrinking — try a simpler one.'); return; }
    patch({ avatar: url });
  }, [patch]);

  const addLink = () => setConfig((c) => ({ ...c, links: [...c.links, { label: '', url: '' }] }));
  const setLink = (i: number, l: Partial<BioLink>) => setConfig((c) => ({ ...c, links: c.links.map((x, j) => (j === i ? { ...x, ...l } : x)) }));
  const delLink = (i: number) => setConfig((c) => ({ ...c, links: c.links.filter((_, j) => j !== i) }));
  const reorder = (from: number, to: number) => setConfig((c) => {
    if (from === to) return c;
    const n = [...c.links]; const [m] = n.splice(from, 1); n.splice(to, 0, m); return { ...c, links: n };
  });

  const doClaim = useCallback(async () => {
    const s = claimSlug.trim().toLowerCase();
    if (!claim.ok || saving) return;
    setSaving(true); setError(null);
    try {
      const r = await createBio(s, config);
      setSlug(r.slug); setPhase('edit'); setSavedAt(Date.now());
    } catch (e) { setError(e instanceof BioApiError ? e.message : 'Could not create your page.'); }
    finally { setSaving(false); }
  }, [claimSlug, claim.ok, saving, config]);

  const save = useCallback(async (nextPublished?: boolean) => {
    if (saving) return;
    setSaving(true); setError(null);
    try {
      await updateBio(config, undefined, nextPublished);
      if (typeof nextPublished === 'boolean') setPublished(nextPublished);
      setSavedAt(Date.now());
    } catch (e) { setError(e instanceof BioApiError ? e.message : 'Could not save — please try again.'); }
    finally { setSaving(false); }
  }, [config, saving]);

  const publicUrl = `https://${PUBLIC_BASE}${slug}`;
  const copyUrl = () => { void navigator.clipboard.writeText(publicUrl).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); }); };

  // ---- screens ----------------------------------------------------------------
  if (phase === 'loading') return <div className="flex h-72 items-center justify-center rounded-2xl border bg-card"><Loader2 className="size-6 animate-spin text-muted-foreground" /></div>;

  if (phase === 'signin') {
    return (
      <div className="rounded-2xl border bg-card p-10 text-center shadow-soft">
        <span className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-pink-500/10 text-pink-600 dark:text-pink-400"><Link2 className="size-7" /></span>
        <h2 className="mt-4 text-lg font-bold">Build your link page</h2>
        <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">Your Link in Bio lives at your own diemdesk.com/u/handle. Sign in to claim yours.</p>
        <Button asChild className="mt-5"><Link href="/login"><LogIn className="mr-1.5 size-4" /> Sign in</Link></Button>
      </div>
    );
  }

  const editor = (
    <div className="space-y-5">
      {/* handle bar (edit mode) */}
      {phase === 'edit' && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border bg-card p-3">
          <span className="flex items-center gap-1.5 text-sm font-semibold"><Link2 className="size-4 text-pink-500" /> {PUBLIC_BASE}{slug}</span>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <Button size="sm" variant="outline" onClick={copyUrl}>{copied ? <Check className="mr-1 size-3.5" /> : <Copy className="mr-1 size-3.5" />}{copied ? 'Copied' : 'Copy link'}</Button>
            <Button size="sm" variant="outline" asChild><a href={publicUrl} target="_blank" rel="noopener noreferrer"><ExternalLink className="mr-1 size-3.5" /> Visit</a></Button>
            <Button size="sm" variant="outline" onClick={() => void save(!published)}>
              {published ? <><Eye className="mr-1 size-3.5" /> Live</> : <><EyeOff className="mr-1 size-3.5" /> Hidden</>}
            </Button>
          </div>
        </div>
      )}

      {/* profile */}
      <div className="rounded-xl border bg-card p-4">
        <div className="flex items-center gap-4">
          <button onClick={() => avatarRef.current?.click()} className="group relative size-16 shrink-0 overflow-hidden rounded-full border bg-muted">
            {config.avatar
              // eslint-disable-next-line @next/next/no-img-element
              ? <img src={config.avatar} alt="" className="size-full object-cover" />
              : <span className="flex size-full items-center justify-center text-muted-foreground"><ImagePlus className="size-5" /></span>}
            <span className="absolute inset-0 hidden items-center justify-center bg-black/40 text-[10px] font-semibold text-white group-hover:flex">Change</span>
          </button>
          <input ref={avatarRef} type="file" accept="image/*" className="hidden" onChange={(e) => { void onAvatar(e.target.files?.[0]); e.target.value = ''; }} />
          <div className="min-w-0 flex-1 space-y-2">
            <input value={config.displayName} onChange={(e) => patch({ displayName: e.target.value })} maxLength={60} placeholder="Display name"
              className="w-full rounded-lg border bg-background px-3 py-2 text-sm font-semibold outline-none focus:border-pink-500 focus:ring-2 focus:ring-pink-500/20" />
            <input value={config.bio} onChange={(e) => patch({ bio: e.target.value })} maxLength={200} placeholder="A short bio (optional)"
              className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:border-pink-500 focus:ring-2 focus:ring-pink-500/20" />
          </div>
        </div>
      </div>

      {/* theme */}
      <div className="rounded-xl border bg-card p-4">
        <p className="mb-2.5 text-xs font-bold uppercase tracking-wider text-muted-foreground">Theme</p>
        <div className="flex flex-wrap gap-2">
          {THEME_LIST.map((t) => (
            <button key={t.id} onClick={() => patch({ theme: t.id })} title={t.name}
              style={{ background: t.pageBg }}
              className={`size-9 rounded-lg border-2 transition ${config.theme === t.id ? 'border-pink-500 ring-2 ring-pink-500/30' : 'border-white/20'}`} />
          ))}
        </div>
      </div>

      {/* links */}
      <div className="rounded-xl border bg-card p-4">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Links</p>
          <Button size="sm" variant="outline" onClick={addLink}><Plus className="mr-1 size-3.5" /> Add link</Button>
        </div>
        <div className="space-y-2">
          {config.links.length === 0 && <p className="py-4 text-center text-sm text-muted-foreground">No links yet — add your first above.</p>}
          {config.links.map((l, i) => (
            <div key={i} draggable
              onDragStart={() => (dragIdx.current = i)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => { if (dragIdx.current != null) reorder(dragIdx.current, i); dragIdx.current = null; }}
              className="flex items-center gap-2 rounded-lg border bg-muted/20 p-2">
              <GripVertical className="size-4 shrink-0 cursor-grab text-muted-foreground" />
              <div className="grid min-w-0 flex-1 gap-1.5 sm:grid-cols-2">
                <input value={l.label} onChange={(e) => setLink(i, { label: e.target.value })} maxLength={60} placeholder="Label (e.g. Instagram)"
                  className="rounded-md border bg-background px-2.5 py-1.5 text-sm outline-none focus:border-pink-500" />
                <input value={l.url} onChange={(e) => setLink(i, { url: e.target.value })} maxLength={400} placeholder="URL or @handle link"
                  className="rounded-md border bg-background px-2.5 py-1.5 text-sm outline-none focus:border-pink-500" />
              </div>
              <button onClick={() => delLink(i)} className="shrink-0 rounded p-1 text-muted-foreground hover:text-red-600"><Trash2 className="size-4" /></button>
            </div>
          ))}
        </div>
      </div>

      {error && <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-700 dark:text-amber-400">{error}</div>}

      {phase === 'claim' ? (
        <div className="rounded-xl border bg-card p-4">
          <p className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">Claim your handle</p>
          <div className="flex items-center gap-2 rounded-lg border bg-background px-3 focus-within:border-pink-500 focus-within:ring-2 focus-within:ring-pink-500/20">
            <span className="text-sm text-muted-foreground">{PUBLIC_BASE}</span>
            <input value={claimSlug} onChange={(e) => setClaimSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))} maxLength={30} placeholder="your-handle"
              className="min-w-0 flex-1 bg-transparent py-2.5 text-sm outline-none" />
            {claim.checking ? <Loader2 className="size-4 animate-spin text-muted-foreground" />
              : claim.ok === true ? <Check className="size-4 text-emerald-500" />
              : claim.ok === false ? <X className="size-4 text-red-500" /> : null}
          </div>
          {claim.reason && <p className="mt-1.5 text-xs text-muted-foreground">{claim.reason}</p>}
          <Button onClick={() => void doClaim()} disabled={!claim.ok || saving} className="mt-3 w-full bg-pink-600 text-white hover:bg-pink-700">
            {saving ? <Loader2 className="mr-1.5 size-4 animate-spin" /> : <Sparkles className="mr-1.5 size-4" />} Create my page
          </Button>
        </div>
      ) : (
        <div className="flex items-center gap-3">
          <Button onClick={() => void save()} disabled={saving} className="bg-pink-600 text-white hover:bg-pink-700">
            {saving ? <Loader2 className="mr-1.5 size-4 animate-spin" /> : <Check className="mr-1.5 size-4" />} Save changes
          </Button>
          {savedAt && !saving && <span className="text-xs text-muted-foreground">Saved</span>}
        </div>
      )}
    </div>
  );

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
      {editor}
      {/* live preview — a phone frame showing the real page render */}
      <div className="lg:sticky lg:top-20 lg:self-start">
        <p className="mb-2 text-center text-xs font-semibold text-muted-foreground">Live preview</p>
        <div className="mx-auto w-[300px] overflow-hidden rounded-[28px] border-[6px] border-slate-800 shadow-xl">
          <div className="h-[560px] overflow-y-auto">
            <BioPageView config={config} />
          </div>
        </div>
      </div>
    </div>
  );
}
